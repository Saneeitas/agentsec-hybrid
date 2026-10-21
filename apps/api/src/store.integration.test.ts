import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "./database/client.js";
import { Store } from "./store.js";
import { ScanWorker } from "./worker.js";
import { buildApp } from "./app.js";
import { testConfig } from "./test-config.js";
import type { HybridScanResult } from "@asf/contracts";

const url = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!url);

suite("PostgreSQL scan orchestration", () => {
  const database = createDatabase({ databaseUrl: url!, databaseSsl: false });
  const store = new Store(database.client);
  beforeAll(async () => { await database.client`SELECT 1`; });
  beforeEach(async () => { await database.client`TRUNCATE hybrid_unified_findings, hybrid_correlations, hybrid_scan_reports, adaptive_findings, adaptive_scan_results, deterministic_findings, deterministic_scan_results, mock_scan_results, scan_job_transitions, scan_jobs, assessment_targets RESTART IDENTITY CASCADE`; });
  afterAll(async () => { await database.close(); });

  async function targetAndJob(behavior: "success" | "failure" | "timeout" = "success") {
    const target = await store.createTarget({ name: "Lab agent", fixtureRef: `lab://agent-${crypto.randomUUID().slice(0, 8)}` });
    const job = await store.createJob({ targetId: target.id, mode: "deterministic", mockBehavior: behavior, maxAttempts: 3 });
    return job!;
  }

  it("requires authentication and rejects out-of-scope targets", async () => {
    const app = buildApp(testConfig, store);
    expect((await app.inject({ method: "GET", url: "/api/v1/targets" })).statusCode).toBe(401);
    const response = await app.inject({ method: "POST", url: "/api/v1/targets", headers: { authorization: `Bearer ${testConfig.apiAuthToken}` }, payload: { name: "External", fixtureRef: "https://example.com", authorizationConfirmed: true } });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("persists targets and jobs before execution", async () => {
    const created = await targetAndJob();
    expect(created.status).toBe("queued");
    expect((await store.getJob(created.id))?.attempts).toBe(0);
  });

  it("lists, retrieves, and updates constrained targets", async () => {
    const created = await store.createTarget({ name: "Original", fixtureRef: "lab://target-crud" });
    expect(await store.listTargets()).toHaveLength(1);
    expect(await store.getTarget(created.id)).toMatchObject({ fixtureRef: "lab://target-crud" });
    expect(await store.updateTarget(created.id, { name: "Updated", description: "Synthetic only" })).toMatchObject({ name: "Updated", description: "Synthetic only" });
  });

  it("allows only one concurrent claimant", async () => {
    await targetAndJob();
    const claims = await Promise.all([store.claimJob("worker-a", 1000), store.claimJob("worker-b", 1000)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("persists structured evaluations and findings", async () => {
    const created = await targetAndJob();
    const response = new Response(JSON.stringify({ contractVersion: "v1", jobId: created.id, outcome: "completed", summary: "Deterministic complete", scannerVersion: "test", engineVersion: "1.0.0", manifestSchemaVersion: "agent-deployment/v1", fixtureVersion: "1.0.0", counts: { evaluated: 1, passed: 0, failed: 1, notApplicable: 0, unknown: 0 }, evaluations: [{ ruleId: "DET-001", ruleVersion: "1.0.0", category: "tool_permissions", description: "Wildcard", outcome: "failed", affectedResource: "tool/shell", rationale: "Wildcard present" }], findings: [{ findingId: "det-123", fingerprint: "abc", ruleId: "DET-001", ruleVersion: "1.0.0", category: "tool_permissions", severity: "high", targetRef: "lab://fixture", affectedResource: "tool/shell", rationale: "Wildcard present", evidence: { operations: ["*"] }, remediation: "Constrain operations", scanId: created.id, observedAt: "2026-10-21T00:00:00.000Z" }] }), { status: 200 });
    const worker = new ScanWorker(store, testConfig, vi.fn().mockResolvedValue(response));
    expect(await worker.runOnce()).toBe(true);
    const completed = await store.getJob(created.id);
    expect(completed).toMatchObject({ status: "completed", errorCode: null });
    expect(completed?.result?.summary).toBe("Deterministic complete");
    expect(completed?.result && "findings" in completed.result ? completed.result.findings : []).toHaveLength(1);
  });

  it("cancels queued jobs safely", async () => {
    const created = await targetAndJob();
    expect((await store.cancelJob(created.id))?.status).toBe("cancelled");
    expect(await store.claimJob("worker", 1000)).toBeNull();
  });

  it("honors cancellation requested during execution before persisting a result", async () => {
    const created = await targetAndJob();
    const claimed = await store.claimJob("worker", 1000);
    expect(claimed?.status).toBe("running");
    expect((await store.cancelJob(created.id))?.cancelRequestedAt).not.toBeNull();
    const persisted = await store.completeJob(created.id, "worker", { contractVersion: "v1", jobId: created.id, outcome: "completed", summary: "Too late", scannerVersion: "test", observations: [] });
    expect(persisted).toBe(false);
    expect(await store.getJob(created.id)).toMatchObject({ status: "cancelled", result: null });
  });

  it("retries failures and then marks the job failed", async () => {
    const created = await targetAndJob("failure");
    const config = { ...testConfig, scanRetryDelayMs: 0 };
    const worker = new ScanWorker(store, config, vi.fn().mockResolvedValue(new Response("failure", { status: 503 })));
    await worker.runOnce(); await worker.runOnce(); await worker.runOnce();
    const failed = await store.getJob(created.id);
    expect(failed?.status).toBe("failed"); expect(failed?.attempts).toBe(3);
  });

  it("records controlled timeouts and bounded retries", async () => {
    const created = await targetAndJob("timeout");
    const worker = new ScanWorker(store, { ...testConfig, scanRetryDelayMs: 0 }, vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    await worker.runOnce(); await worker.runOnce(); await worker.runOnce();
    expect(await store.getJob(created.id)).toMatchObject({ status: "failed", errorCode: "scanner_timeout", attempts: 3 });
  });

  it("recovers a job after an interrupted worker lease expires", async () => {
    const created = await targetAndJob();
    expect((await store.claimJob("dead-worker", 10))?.id).toBe(created.id);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const recovered = await store.claimJob("recovery-worker", 1000);
    expect(recovered).toMatchObject({ id: created.id, status: "running", attempts: 2 });
  });

  it("persists a complete hybrid report with provenance", async () => {
    const target = await store.createTarget({ name: "Hybrid agent", fixtureRef: "lab://vulnerable-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "hybrid", mockBehavior: "success", maxAttempts: 3 }))!;
    const unified = { correlationId: "cor-123", fingerprint: "fingerprint", outcome: "corroborated_weakness", category: "tool_permissions", severity: "high", evidenceStrength: "corroborated", sourceMethods: ["deterministic", "adaptive"], deterministicFindingRefs: ["det-1"], adaptiveFindingRefs: ["ada-1"], adaptiveProbeRefs: ["AP-001"], affectedComponents: ["tool/shell"], rationale: "Explicit mapping and runtime evidence", remediation: "Constrain and enforce", limitations: ["Synthetic laboratory only"], correlationRule: "det-adaptive-map/v1", correlationVersion: "1.0.0", observedOutcomes: ["configuration_detected", "weakness_observed"] };
    const result = { contractVersion: "hybrid-report/v1", jobId: created.id, outcome: "completed", overallStatus: "completed", summary: "One unique finding", targetMappingVersion: "hybrid-target-map/v1", componentStatus: { deterministic: "completed", adaptive: "completed", correlation: "completed" }, componentErrors: { deterministic: null, adaptive: null, correlation: null }, deterministicResult: null, adaptiveResult: null, correlationVersion: "1.0.0", mappingVersion: "det-adaptive-map/v1", unifiedFindings: [unified], counts: { totalUnique: 1, corroborated: 1, configurationOnly: 0, behaviorOnly: 0, mitigating: 0, inconclusive: 0, uncorrelated: 0 }, generatedAt: "2026-10-21T00:00:00.000Z" };
    await new ScanWorker(store, testConfig, vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))).runOnce();
    const completed = await store.getJob(created.id);
    expect(completed).toMatchObject({ status: "completed", errorCode: null });
    expect(completed?.result?.contractVersion).toBe("hybrid-report/v1");
    expect(completed?.result && "unifiedFindings" in completed.result ? completed.result.unifiedFindings[0]?.deterministicFindingRefs : []).toEqual(["det-1"]);
  });

  it("persists partial hybrid evidence but does not report job success", async () => {
    const target = await store.createTarget({ name: "Partial hybrid", fixtureRef: "lab://vulnerable-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "hybrid", mockBehavior: "success", maxAttempts: 3 }))!;
    const result = { contractVersion: "hybrid-report/v1", jobId: created.id, outcome: "partial", overallStatus: "partial_failure", summary: "Adaptive failed", targetMappingVersion: "hybrid-target-map/v1", componentStatus: { deterministic: "completed", adaptive: "failed", correlation: "completed" }, componentErrors: { deterministic: null, adaptive: "adaptive_component_failed", correlation: null }, deterministicResult: { findings: [] }, adaptiveResult: null, correlationVersion: "1.0.0", mappingVersion: "det-adaptive-map/v1", unifiedFindings: [], counts: { totalUnique: 0, corroborated: 0, configurationOnly: 0, behaviorOnly: 0, mitigating: 0, inconclusive: 0, uncorrelated: 0 }, generatedAt: "2026-10-21T00:00:00.000Z" };
    await new ScanWorker(store, testConfig, vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))).runOnce();
    const failed = await store.getJob(created.id);
    expect(failed).toMatchObject({ status: "failed", errorCode: "hybrid_partial_failure" });
    expect(failed?.result?.contractVersion).toBe("hybrid-report/v1");
  });

  it("cancels hybrid work before report persistence", async () => {
    const target = await store.createTarget({ name: "Hybrid cancel", fixtureRef: "lab://secure-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "hybrid", mockBehavior: "success", maxAttempts: 3 }))!;
    await store.claimJob("hybrid-worker", 1000);
    await store.cancelJob(created.id);
    const result = { contractVersion: "hybrid-report/v1", jobId: created.id, outcome: "completed", overallStatus: "completed", summary: "Late report", targetMappingVersion: "hybrid-target-map/v1", componentStatus: { deterministic: "completed", adaptive: "completed", correlation: "completed" }, componentErrors: {}, deterministicResult: null, adaptiveResult: null, correlationVersion: "1.0.0", mappingVersion: "det-adaptive-map/v1", unifiedFindings: [], counts: { totalUnique: 0, corroborated: 0, configurationOnly: 0, behaviorOnly: 0, mitigating: 0, inconclusive: 0, uncorrelated: 0 } } as HybridScanResult;
    expect(await store.completeHybridJob(created.id, "hybrid-worker", result)).toBe(false);
    expect(await store.getJob(created.id)).toMatchObject({ status: "cancelled", result: null });
  });

  it("retries hybrid transport failures within the existing budget", async () => {
    const target = await store.createTarget({ name: "Hybrid retry", fixtureRef: "lab://secure-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "hybrid", mockBehavior: "success", maxAttempts: 3 }))!;
    const worker = new ScanWorker(store, { ...testConfig, scanRetryDelayMs: 0 }, vi.fn().mockResolvedValue(new Response("timeout", { status: 503 })));
    await worker.runOnce(); await worker.runOnce(); await worker.runOnce();
    expect(await store.getJob(created.id)).toMatchObject({ status: "failed", errorCode: "scanner_failure", attempts: 3 });
  });

  it("persists adaptive probes, findings, provider metadata, and execution mode", async () => {
    const target = await store.createTarget({ name: "Adaptive lab", fixtureRef: "lab://vulnerable-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "adaptive", adaptiveAssessmentMode: "simulator", mockBehavior: "success", maxAttempts: 3 }))!;
    const finding = { findingId: "ada-123", fingerprint: "abc", assessmentMode: "simulator", probeId: "AP-001", scenarioId: "LAB-001-VULNERABLE", securityObjective: "Evaluate prompt injection", severity: "high", confidence: "confirmed", confidenceRationale: "Observed execution evidence", observedBehavior: "weakness_observed", evidence: [{ decision: "allow", outcome: "simulated_success" }], remediation: "Enforce gateway policy", provider: { provider: "mock", model: "deterministic-mock-v1" }, scanId: created.id, observedAt: "2026-10-21T00:00:00.000Z" };
    const result = { contractVersion: "adaptive-result/v1", jobId: created.id, outcome: "completed", assessmentMode: "simulator", engineVersion: "1.0.0", provider: { provider: "mock", model: "deterministic-mock-v1" }, summary: "Confirmed", overallClassification: "confirmed_violation", probes: [{ sequence: 1 }], findings: [finding], budgets: { maxProbes: 4, maxProviderTokens: 1024, maxWallTimeMs: 5000, usedProbes: 1, usedProviderTokens: 36 } };
    await new ScanWorker(store, testConfig, vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))).runOnce();
    const completed = await store.getJob(created.id);
    expect(completed).toMatchObject({ status: "completed", adaptiveAssessmentMode: "simulator" });
    expect(completed?.result?.contractVersion).toBe("adaptive-result/v1");
    expect(completed?.result && "findings" in completed.result ? completed.result.findings : []).toHaveLength(1);
  });

  it("retries adaptive provider failures within the existing attempt budget", async () => {
    const target = await store.createTarget({ name: "Adaptive retry", fixtureRef: "lab://secure-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "adaptive", mockBehavior: "success", maxAttempts: 3 }))!;
    const worker = new ScanWorker(store, { ...testConfig, scanRetryDelayMs: 0 }, vi.fn().mockResolvedValue(new Response("provider failure", { status: 503 })));
    await worker.runOnce(); await worker.runOnce(); await worker.runOnce();
    expect(await store.getJob(created.id)).toMatchObject({ status: "failed", errorCode: "scanner_failure", attempts: 3 });
  });

  it("honors cancellation before persisting an adaptive result", async () => {
    const target = await store.createTarget({ name: "Adaptive cancel", fixtureRef: "lab://secure-agent" });
    const created = (await store.createJob({ targetId: target.id, mode: "adaptive", mockBehavior: "success", maxAttempts: 3 }))!;
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { release = resolve; });
    const running = new ScanWorker(store, testConfig, vi.fn().mockReturnValue(pending)).runOnce();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await store.cancelJob(created.id);
    release(new Response(JSON.stringify({ contractVersion: "adaptive-result/v1", jobId: created.id, outcome: "completed", assessmentMode: "simulator", engineVersion: "1.0.0", provider: { provider: "mock" }, summary: "No violation", overallClassification: "no_violation_observed", probes: [], findings: [], budgets: { maxProbes: 4, maxProviderTokens: 1024, maxWallTimeMs: 5000, usedProbes: 0, usedProviderTokens: 0 } }), { status: 200 }));
    await running;
    expect(await store.getJob(created.id)).toMatchObject({ status: "cancelled", result: null });
  });
});
