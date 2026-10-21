import { randomUUID } from "node:crypto";
import type { AdaptiveScanResult, DeterministicScanResult, ScanJob } from "@asf/contracts";
import type { AppConfig } from "./config.js";
import type { Store } from "./store.js";

export class ScanWorker {
  private readonly owner = randomUUID();
  private timer?: NodeJS.Timeout;
  private active = 0;
  private stopped = true;
  constructor(private readonly store: Store, private readonly config: AppConfig, private readonly request: typeof fetch = fetch) {}
  start() { if (!this.stopped) return; this.stopped = false; this.schedule(0); }
  stop() { this.stopped = true; if (this.timer) clearTimeout(this.timer); }
  private schedule(delay: number) { if (!this.stopped) this.timer = setTimeout(() => void this.poll(), delay); }
  async poll(): Promise<void> {
    if (this.stopped) return;
    try { while (this.active < this.config.workerConcurrency) { const job = await this.store.claimJob(this.owner, this.config.workerLeaseMs); if (!job) break; this.active++; void this.execute(job).finally(() => { this.active--; }); } }
    catch { console.error("Scan worker poll failed"); }
    finally { this.schedule(this.config.workerPollIntervalMs); }
  }
  async runOnce(): Promise<boolean> { const job = await this.store.claimJob(this.owner, this.config.workerLeaseMs); if (!job) return false; await this.execute(job); return true; }
  private async execute(job: ScanJob) {
    try {
      if (job.mode === "hybrid") { await this.store.failJob(job.id, this.owner, "unsupported_scan_mode"); return; }
      if (job.mockBehavior !== "success") {
        const mock = await this.request(`${this.config.scannerBaseUrl}/internal/v1/mock-scans`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.config.scannerServiceToken}` }, body: JSON.stringify({ job_id: job.id, target_ref: job.targetId, mode: job.mode, behavior: job.mockBehavior, delay_ms: job.mockBehavior === "timeout" ? this.config.scanExecutionTimeoutMs * 2 : 10 }), signal: AbortSignal.timeout(this.config.scanExecutionTimeoutMs) });
        if (!mock.ok) throw new Error(mock.status >= 500 ? "scanner_failure" : "scanner_rejected");
        throw new Error("invalid_scanner_response");
      }
      const target = await this.store.getTarget(job.targetId);
      if (!target) throw new Error("target_not_found");
      if (job.mode === "adaptive") {
        const response = await this.request(`${this.config.scannerBaseUrl}/internal/v1/adaptive-scans`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.config.scannerServiceToken}` }, body: JSON.stringify({ job_id: job.id, target_ref: target.fixtureRef, assessment_mode: job.adaptiveAssessmentMode }), signal: AbortSignal.timeout(this.config.scanExecutionTimeoutMs) });
        if (response.status === 422) { await this.store.failJob(job.id, this.owner, "unsupported_adaptive_target"); return; }
        if (!response.ok) throw new Error(response.status >= 500 ? "scanner_failure" : "scanner_rejected");
        const result = await response.json() as AdaptiveScanResult;
        if (result.contractVersion !== "adaptive-result/v1" || result.jobId !== job.id || result.outcome !== "completed" || !Array.isArray(result.probes) || !Array.isArray(result.findings)) throw new Error("invalid_scanner_response");
        await this.store.completeAdaptiveJob(job.id, this.owner, result);
        return;
      }
      const response = await this.request(`${this.config.scannerBaseUrl}/internal/v1/deterministic-scans`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.config.scannerServiceToken}` }, body: JSON.stringify({ job_id: job.id, fixture_ref: target.fixtureRef, mode: job.mode }), signal: AbortSignal.timeout(this.config.scanExecutionTimeoutMs) });
      if (response.status === 422) {
        const body = await response.json().catch(() => ({})) as { detail?: unknown };
        const code = typeof body.detail === "string" && ["unknown_fixture", "invalid_manifest", "unsupported_schema_version", "manifest_too_large"].includes(body.detail) ? body.detail : "scanner_rejected";
        await this.store.failJob(job.id, this.owner, code);
        return;
      }
      if (!response.ok) throw new Error(response.status >= 500 ? "scanner_failure" : "scanner_rejected");
      const result = await response.json() as DeterministicScanResult;
      if (result.contractVersion !== "v1" || result.jobId !== job.id || result.outcome !== "completed" || result.manifestSchemaVersion !== "agent-deployment/v1" || !Array.isArray(result.findings) || !Array.isArray(result.evaluations)) throw new Error("invalid_scanner_response");
      await this.store.completeDeterministicJob(job.id, this.owner, result);
    } catch (error) {
      const known = error instanceof Error && ["scanner_failure", "scanner_rejected", "invalid_scanner_response", "target_not_found", "scanner_result_limit"].includes(error.message) ? error.message : "scanner_failure";
      const code = error instanceof DOMException && error.name === "TimeoutError" ? "scanner_timeout" : known;
      await this.store.failOrRetryJob(job.id, this.owner, code, this.config.scanRetryDelayMs);
    }
  }
}
