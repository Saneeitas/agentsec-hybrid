import type { AdaptiveAssessmentMode, AdaptiveFinding, AdaptiveScanResult, DeterministicFinding, DeterministicScanResult, HybridScanResult, HybridUnifiedFinding, LaboratoryTarget, MockBehavior, MockScanResult, RuleEvaluation, ScanJob, ScanMode, ScanStatus } from "@asf/contracts";
import type { Sql } from "postgres";

type Timestamp = Date | string;
type TargetRow = { id: string; name: string; fixture_ref: string; description: string | null; authorization_confirmed: boolean; created_at: Timestamp; updated_at: Timestamp };
type JobRow = { id: string; target_id: string; mode: ScanMode; status: ScanStatus; mock_behavior: MockBehavior; adaptive_assessment_mode: AdaptiveAssessmentMode; attempts: number; max_attempts: number; error_code: string | null; created_at: Timestamp; updated_at: Timestamp; started_at: Timestamp | null; completed_at: Timestamp | null; cancel_requested_at: Timestamp | null };
type ResultRow = { job_id: string; contract_version: "v1"; scanner_version: string; outcome: "completed"; summary: string; observations: MockScanResult["observations"] };
type DeterministicResultRow = { job_id: string; contract_version: "v1"; scanner_version: string; engine_version: string; manifest_schema_version: "agent-deployment/v1"; fixture_version: string; summary: string; counts: DeterministicScanResult["counts"]; evaluations: RuleEvaluation[] };
type FindingRow = { finding_id: string; fingerprint: string; rule_id: string; rule_version: string; category: string; severity: DeterministicFinding["severity"]; target_ref: string; affected_resource: string; rationale: string; evidence: Record<string, unknown>; remediation: string; observed_at: Timestamp };
type AdaptiveResultRow = { job_id: string; contract_version: "adaptive-result/v1"; assessment_mode: AdaptiveAssessmentMode; engine_version: string; provider: Record<string, unknown> | null; summary: string; overall_classification: AdaptiveScanResult["overallClassification"]; probes: Array<Record<string, unknown>>; budgets: AdaptiveScanResult["budgets"] };
type AdaptiveFindingRow = { finding_id: string; fingerprint: string; assessment_mode: AdaptiveAssessmentMode; probe_id: string; scenario_id: string; security_objective: string; severity: AdaptiveFinding["severity"]; confidence: "confirmed"; confidence_rationale: string; observed_behavior: string; evidence: Array<Record<string, unknown>>; remediation: string; provider: Record<string, unknown>; observed_at: Timestamp };
type HybridReportRow = { job_id: string; contract_version: "hybrid-report/v1"; outcome: "completed" | "partial"; overall_status: "completed" | "partial_failure"; summary: string; target_mapping_version: string; correlation_version: string; mapping_version: string; component_status: HybridScanResult["componentStatus"]; component_errors: Record<string, string | null>; deterministic_result: DeterministicScanResult | null; adaptive_result: AdaptiveScanResult | null; counts: HybridScanResult["counts"]; generated_at: Timestamp };
type HybridRow = { correlation_id: string; fingerprint: string; outcome: HybridUnifiedFinding["outcome"]; correlation_rule: string; correlation_version: string; rationale: string; provenance: { sourceMethods: HybridUnifiedFinding["sourceMethods"]; deterministicFindingRefs: string[]; adaptiveFindingRefs: string[]; adaptiveProbeRefs: string[] }; limitations: string[]; category: string; severity: HybridUnifiedFinding["severity"]; evidence_strength: string; affected_components: string[]; observed_outcomes: string[]; remediation: string };

const iso = (value: Timestamp) => new Date(value).toISOString();
function target(row: TargetRow): LaboratoryTarget {
  return { id: row.id, name: row.name, fixtureRef: row.fixture_ref, description: row.description, authorizationConfirmed: true, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function job(row: JobRow, result: ScanJob["result"] = null): ScanJob {
  return { id: row.id, targetId: row.target_id, mode: row.mode, status: row.status, mockBehavior: row.mock_behavior, adaptiveAssessmentMode: row.adaptive_assessment_mode, attempts: row.attempts, maxAttempts: row.max_attempts, errorCode: row.error_code, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), startedAt: row.started_at ? iso(row.started_at) : null, completedAt: row.completed_at ? iso(row.completed_at) : null, cancelRequestedAt: row.cancel_requested_at ? iso(row.cancel_requested_at) : null, result };
}

export class Store {
  constructor(private readonly sql: Sql) {}

  async createTarget(input: { name: string; fixtureRef: string; description?: string }): Promise<LaboratoryTarget> {
    const [row] = await this.sql<TargetRow[]>`INSERT INTO assessment_targets (name, fixture_ref, description, authorization_confirmed) VALUES (${input.name}, ${input.fixtureRef}, ${input.description ?? null}, true) RETURNING *`;
    return target(row!);
  }
  async listTargets(): Promise<LaboratoryTarget[]> { return (await this.sql<TargetRow[]>`SELECT * FROM assessment_targets ORDER BY created_at DESC LIMIT 100`).map(target); }
  async getTarget(id: string): Promise<LaboratoryTarget | null> { const [row] = await this.sql<TargetRow[]>`SELECT * FROM assessment_targets WHERE id=${id}`; return row ? target(row) : null; }
  async updateTarget(id: string, input: { name?: string; description?: string | null }): Promise<LaboratoryTarget | null> {
    const [row] = await this.sql<TargetRow[]>`UPDATE assessment_targets SET name=COALESCE(${input.name ?? null}, name), description=CASE WHEN ${input.description === undefined} THEN description ELSE ${input.description ?? null} END, updated_at=now() WHERE id=${id} RETURNING *`;
    return row ? target(row) : null;
  }
  async createJob(input: { targetId: string; mode: ScanMode; mockBehavior: MockBehavior; maxAttempts: number; adaptiveAssessmentMode?: AdaptiveAssessmentMode }): Promise<ScanJob | null> {
    return this.sql.begin(async (tx) => {
      const [allowed] = await tx<{ id: string }[]>`SELECT id FROM assessment_targets WHERE id=${input.targetId} AND authorization_confirmed=true`;
      if (!allowed) return null;
      const [row] = await tx<JobRow[]>`INSERT INTO scan_jobs (target_id, mode, mock_behavior, adaptive_assessment_mode, max_attempts) VALUES (${input.targetId}, ${input.mode}, ${input.mockBehavior}, ${input.adaptiveAssessmentMode ?? "simulator"}, ${input.maxAttempts}) RETURNING *`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${row!.id}, NULL, 'queued', 'created')`;
      return job(row!);
    });
  }
  async listJobs(): Promise<ScanJob[]> { const rows = await this.sql<JobRow[]>`SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT 100`; return Promise.all(rows.map((row) => this.withResult(row))); }
  async getJob(id: string): Promise<ScanJob | null> { const [row] = await this.sql<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id}`; return row ? this.withResult(row) : null; }
  private async withResult(row: JobRow): Promise<ScanJob> {
    const [hybrid] = await this.sql<HybridReportRow[]>`SELECT * FROM hybrid_scan_reports WHERE job_id=${row.id}`;
    if (hybrid) {
      const findings = await this.sql<HybridRow[]>`SELECT c.correlation_id, c.fingerprint, c.outcome, c.correlation_rule, c.correlation_version, c.rationale, c.provenance, c.limitations, f.category, f.severity, f.evidence_strength, f.affected_components, f.observed_outcomes, f.remediation FROM hybrid_correlations c JOIN hybrid_unified_findings f ON f.job_id=c.job_id AND f.correlation_id=c.correlation_id WHERE c.job_id=${row.id} ORDER BY c.outcome, f.category, c.fingerprint`;
      return job(row, { contractVersion: hybrid.contract_version, jobId: hybrid.job_id, outcome: hybrid.outcome, overallStatus: hybrid.overall_status, summary: hybrid.summary, targetMappingVersion: hybrid.target_mapping_version, correlationVersion: hybrid.correlation_version, mappingVersion: hybrid.mapping_version, componentStatus: hybrid.component_status, componentErrors: hybrid.component_errors, deterministicResult: hybrid.deterministic_result, adaptiveResult: hybrid.adaptive_result, counts: hybrid.counts, generatedAt: iso(hybrid.generated_at), unifiedFindings: findings.map((item) => ({ correlationId: item.correlation_id, fingerprint: item.fingerprint, outcome: item.outcome, correlationRule: item.correlation_rule, correlationVersion: item.correlation_version, rationale: item.rationale, limitations: item.limitations, category: item.category, severity: item.severity, evidenceStrength: item.evidence_strength, affectedComponents: item.affected_components, observedOutcomes: item.observed_outcomes, remediation: item.remediation, sourceMethods: item.provenance.sourceMethods, deterministicFindingRefs: item.provenance.deterministicFindingRefs, adaptiveFindingRefs: item.provenance.adaptiveFindingRefs, adaptiveProbeRefs: item.provenance.adaptiveProbeRefs })) });
    }
    const [adaptive] = await this.sql<AdaptiveResultRow[]>`SELECT job_id, contract_version, assessment_mode, engine_version, provider, summary, overall_classification, probes, budgets FROM adaptive_scan_results WHERE job_id=${row.id}`;
    if (adaptive) {
      const findings = await this.sql<AdaptiveFindingRow[]>`SELECT finding_id, fingerprint, assessment_mode, probe_id, scenario_id, security_objective, severity, confidence, confidence_rationale, observed_behavior, evidence, remediation, provider, observed_at FROM adaptive_findings WHERE job_id=${row.id} ORDER BY probe_id`;
      return job(row, { contractVersion: adaptive.contract_version, jobId: adaptive.job_id, outcome: "completed", assessmentMode: adaptive.assessment_mode, engineVersion: adaptive.engine_version, provider: adaptive.provider, summary: adaptive.summary, overallClassification: adaptive.overall_classification, probes: adaptive.probes, budgets: adaptive.budgets, findings: findings.map((item) => ({ findingId: item.finding_id, fingerprint: item.fingerprint, assessmentMode: item.assessment_mode, probeId: item.probe_id, scenarioId: item.scenario_id, securityObjective: item.security_objective, severity: item.severity, confidence: item.confidence, confidenceRationale: item.confidence_rationale, observedBehavior: item.observed_behavior, evidence: item.evidence, remediation: item.remediation, provider: item.provider, scanId: row.id, observedAt: iso(item.observed_at) })) });
    }
    const [deterministic] = await this.sql<DeterministicResultRow[]>`SELECT job_id, contract_version, scanner_version, engine_version, manifest_schema_version, fixture_version, summary, counts, evaluations FROM deterministic_scan_results WHERE job_id=${row.id}`;
    if (deterministic) {
      const findings = await this.sql<FindingRow[]>`SELECT finding_id, fingerprint, rule_id, rule_version, category, severity, target_ref, affected_resource, rationale, evidence, remediation, observed_at FROM deterministic_findings WHERE job_id=${row.id} ORDER BY rule_id, affected_resource`;
      return job(row, { contractVersion: deterministic.contract_version, jobId: deterministic.job_id, outcome: "completed", summary: deterministic.summary, scannerVersion: deterministic.scanner_version, engineVersion: deterministic.engine_version, manifestSchemaVersion: deterministic.manifest_schema_version, fixtureVersion: deterministic.fixture_version, counts: deterministic.counts, evaluations: deterministic.evaluations, findings: findings.map((item) => ({ findingId: item.finding_id, fingerprint: item.fingerprint, ruleId: item.rule_id, ruleVersion: item.rule_version, category: item.category, severity: item.severity, targetRef: item.target_ref, affectedResource: item.affected_resource, rationale: item.rationale, evidence: item.evidence, remediation: item.remediation, scanId: row.id, observedAt: iso(item.observed_at) })) });
    }
    const [result] = await this.sql<ResultRow[]>`SELECT job_id, contract_version, scanner_version, outcome, summary, observations FROM mock_scan_results WHERE job_id=${row.id}`;
    return job(row, result ? { contractVersion: result.contract_version, jobId: result.job_id, outcome: result.outcome, summary: result.summary, scannerVersion: result.scanner_version, observations: result.observations } : null);
  }
  async cancelJob(id: string): Promise<ScanJob | null> {
    return this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} FOR UPDATE`;
      if (!current) return null;
      if (["completed", "failed", "cancelled"].includes(current.status)) return job(current);
      const next = current.status === "queued" ? "cancelled" : "running";
      const [row] = await tx<JobRow[]>`UPDATE scan_jobs SET status=${next}, cancel_requested_at=now(), completed_at=CASE WHEN ${next}='cancelled' THEN now() ELSE completed_at END, updated_at=now() WHERE id=${id} RETURNING *`;
      if (next === "cancelled") await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, ${current.status}, 'cancelled', 'user_requested')`;
      return job(row!);
    });
  }
  async claimJob(owner: string, leaseMs: number): Promise<ScanJob | null> {
    return this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE cancel_requested_at IS NULL AND attempts < max_attempts AND ((status='queued' AND next_attempt_at <= now()) OR (status='running' AND lease_expires_at < now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!current) return null;
      const [row] = await tx<JobRow[]>`UPDATE scan_jobs SET status='running', attempts=attempts+1, lease_owner=${owner}, lease_expires_at=now() + (${leaseMs} * interval '1 millisecond'), started_at=COALESCE(started_at, now()), updated_at=now() WHERE id=${current.id} RETURNING *`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${current.id}, ${current.status}, 'running', ${current.status === "running" ? "lease_recovered" : "claimed"})`;
      return job(row!);
    });
  }
  async completeJob(id: string, owner: string, result: MockScanResult): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} AND status='running' AND lease_owner=${owner} FOR UPDATE`;
      if (!current) return false;
      if (current.cancel_requested_at) { await tx`UPDATE scan_jobs SET status='cancelled', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=${id}`; await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'cancelled', 'cancelled_during_execution')`; return false; }
      await tx`INSERT INTO mock_scan_results (job_id, contract_version, scanner_version, outcome, summary, observations) VALUES (${id}, ${result.contractVersion}, ${result.scannerVersion}, ${result.outcome}, ${result.summary}, ${JSON.stringify(result.observations)}::jsonb)`;
      await tx`UPDATE scan_jobs SET status='completed', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, error_code=NULL, updated_at=now() WHERE id=${id}`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'completed', 'mock_result_persisted')`;
      return true;
    });
  }
  async completeDeterministicJob(id: string, owner: string, result: DeterministicScanResult): Promise<boolean> {
    if (result.findings.length > 100 || result.evaluations.length > 400) throw new Error("scanner_result_limit");
    return this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} AND status='running' AND lease_owner=${owner} FOR UPDATE`;
      if (!current) return false;
      if (current.cancel_requested_at) { await tx`UPDATE scan_jobs SET status='cancelled', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=${id}`; await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'cancelled', 'cancelled_during_execution')`; return false; }
      await tx`INSERT INTO deterministic_scan_results (job_id, contract_version, scanner_version, engine_version, manifest_schema_version, fixture_version, summary, counts, evaluations) VALUES (${id}, ${result.contractVersion}, ${result.scannerVersion}, ${result.engineVersion}, ${result.manifestSchemaVersion}, ${result.fixtureVersion}, ${result.summary}, ${JSON.stringify(result.counts)}::jsonb, ${JSON.stringify(result.evaluations)}::jsonb)`;
      for (const finding of result.findings) await tx`INSERT INTO deterministic_findings (job_id, finding_id, fingerprint, rule_id, rule_version, category, severity, target_ref, affected_resource, rationale, evidence, remediation, observed_at) VALUES (${id}, ${finding.findingId}, ${finding.fingerprint}, ${finding.ruleId}, ${finding.ruleVersion}, ${finding.category}, ${finding.severity}, ${finding.targetRef}, ${finding.affectedResource}, ${finding.rationale}, ${JSON.stringify(finding.evidence)}::jsonb, ${finding.remediation}, ${finding.observedAt})`;
      await tx`UPDATE scan_jobs SET status='completed', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, error_code=NULL, updated_at=now() WHERE id=${id}`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'completed', 'deterministic_result_persisted')`;
      return true;
    });
  }
  async completeAdaptiveJob(id: string, owner: string, result: AdaptiveScanResult): Promise<boolean> {
    if (result.findings.length > 100 || result.probes.length > 8) throw new Error("scanner_result_limit");
    return this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} AND status='running' AND lease_owner=${owner} FOR UPDATE`;
      if (!current) return false;
      if (current.cancel_requested_at) { await tx`UPDATE scan_jobs SET status='cancelled', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=${id}`; await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'cancelled', 'cancelled_during_execution')`; return false; }
      await tx`INSERT INTO adaptive_scan_results (job_id, contract_version, assessment_mode, engine_version, provider, summary, overall_classification, probes, budgets) VALUES (${id}, ${result.contractVersion}, ${result.assessmentMode}, ${result.engineVersion}, ${result.provider ? JSON.stringify(result.provider) : null}::jsonb, ${result.summary}, ${result.overallClassification}, ${JSON.stringify(result.probes)}::jsonb, ${JSON.stringify(result.budgets)}::jsonb)`;
      for (const finding of result.findings) await tx`INSERT INTO adaptive_findings (job_id, finding_id, fingerprint, assessment_mode, probe_id, scenario_id, security_objective, severity, confidence, confidence_rationale, observed_behavior, evidence, remediation, provider, observed_at) VALUES (${id}, ${finding.findingId}, ${finding.fingerprint}, ${finding.assessmentMode}, ${finding.probeId}, ${finding.scenarioId}, ${finding.securityObjective}, ${finding.severity}, ${finding.confidence}, ${finding.confidenceRationale}, ${finding.observedBehavior}, ${JSON.stringify(finding.evidence)}::jsonb, ${finding.remediation}, ${JSON.stringify(finding.provider)}::jsonb, ${finding.observedAt})`;
      await tx`UPDATE scan_jobs SET status='completed', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, error_code=NULL, updated_at=now() WHERE id=${id}`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'completed', 'adaptive_result_persisted')`;
      return true;
    });
  }
  async completeHybridJob(id: string, owner: string, result: HybridScanResult): Promise<boolean> {
    if (result.unifiedFindings.length > 200) throw new Error("scanner_result_limit");
    return this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} AND status='running' AND lease_owner=${owner} FOR UPDATE`;
      if (!current) return false;
      if (current.cancel_requested_at) { await tx`UPDATE scan_jobs SET status='cancelled', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=${id}`; await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'cancelled', 'cancelled_during_execution')`; return false; }
      await tx`INSERT INTO hybrid_scan_reports (job_id, contract_version, outcome, overall_status, summary, target_mapping_version, correlation_version, mapping_version, component_status, component_errors, deterministic_result, adaptive_result, counts, generated_at) VALUES (${id}, ${result.contractVersion}, ${result.outcome}, ${result.overallStatus}, ${result.summary}, ${result.targetMappingVersion}, ${result.correlationVersion}, ${result.mappingVersion}, ${JSON.stringify(result.componentStatus)}::jsonb, ${JSON.stringify(result.componentErrors)}::jsonb, ${result.deterministicResult ? JSON.stringify(result.deterministicResult) : null}::jsonb, ${result.adaptiveResult ? JSON.stringify(result.adaptiveResult) : null}::jsonb, ${JSON.stringify(result.counts)}::jsonb, ${result.generatedAt ?? new Date().toISOString()})`;
      for (const finding of result.unifiedFindings) {
        const provenance = { sourceMethods: finding.sourceMethods, deterministicFindingRefs: finding.deterministicFindingRefs, adaptiveFindingRefs: finding.adaptiveFindingRefs, adaptiveProbeRefs: finding.adaptiveProbeRefs };
        await tx`INSERT INTO hybrid_correlations (job_id, correlation_id, fingerprint, outcome, correlation_rule, correlation_version, rationale, provenance, limitations) VALUES (${id}, ${finding.correlationId}, ${finding.fingerprint}, ${finding.outcome}, ${finding.correlationRule}, ${finding.correlationVersion}, ${finding.rationale}, ${JSON.stringify(provenance)}::jsonb, ${JSON.stringify(finding.limitations)}::jsonb)`;
        await tx`INSERT INTO hybrid_unified_findings (job_id, correlation_id, category, severity, evidence_strength, affected_components, observed_outcomes, remediation) VALUES (${id}, ${finding.correlationId}, ${finding.category}, ${finding.severity}, ${finding.evidenceStrength}, ${JSON.stringify(finding.affectedComponents)}::jsonb, ${JSON.stringify(finding.observedOutcomes)}::jsonb, ${finding.remediation})`;
      }
      const next = result.overallStatus === "completed" ? "completed" : "failed";
      const errorCode = result.overallStatus === "completed" ? null : "hybrid_partial_failure";
      await tx`UPDATE scan_jobs SET status=${next}, completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, error_code=${errorCode}, updated_at=now() WHERE id=${id}`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', ${next}, ${result.overallStatus === "completed" ? "hybrid_report_persisted" : "hybrid_partial_report_persisted"})`;
      return true;
    });
  }
  async failJob(id: string, owner: string, errorCode: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} AND status='running' AND lease_owner=${owner} FOR UPDATE`;
      if (!current) return;
      const next = current.cancel_requested_at ? "cancelled" : "failed";
      await tx`UPDATE scan_jobs SET status=${next}, completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, error_code=${errorCode}, updated_at=now() WHERE id=${id}`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', ${next}, ${errorCode})`;
    });
  }
  async failOrRetryJob(id: string, owner: string, errorCode: string, retryDelayMs: number): Promise<void> {
    await this.sql.begin(async (tx) => {
      const [current] = await tx<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id} AND status='running' AND lease_owner=${owner} FOR UPDATE`;
      if (!current) return;
      if (current.cancel_requested_at) { await tx`UPDATE scan_jobs SET status='cancelled', completed_at=now(), lease_owner=NULL, lease_expires_at=NULL, error_code=${errorCode}, updated_at=now() WHERE id=${id}`; await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', 'cancelled', 'cancelled_during_execution')`; return; }
      const next = current.attempts >= current.max_attempts ? "failed" : "queued";
      await tx`UPDATE scan_jobs SET status=${next}, next_attempt_at=now() + (${retryDelayMs} * interval '1 millisecond'), completed_at=CASE WHEN ${next}='failed' THEN now() ELSE NULL END, lease_owner=NULL, lease_expires_at=NULL, error_code=${errorCode}, updated_at=now() WHERE id=${id}`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${id}, 'running', ${next}, ${errorCode})`;
    });
  }
}
