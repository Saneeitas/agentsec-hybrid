import type { LaboratoryTarget, MockBehavior, MockScanResult, ScanJob, ScanMode, ScanStatus } from "@asf/contracts";
import type { Sql } from "postgres";

type Timestamp = Date | string;
type TargetRow = { id: string; name: string; fixture_ref: string; description: string | null; authorization_confirmed: boolean; created_at: Timestamp; updated_at: Timestamp };
type JobRow = { id: string; target_id: string; mode: ScanMode; status: ScanStatus; mock_behavior: MockBehavior; attempts: number; max_attempts: number; error_code: string | null; created_at: Timestamp; updated_at: Timestamp; started_at: Timestamp | null; completed_at: Timestamp | null; cancel_requested_at: Timestamp | null };
type ResultRow = { job_id: string; contract_version: "v1"; scanner_version: string; outcome: "completed"; summary: string; observations: MockScanResult["observations"] };

const iso = (value: Timestamp) => new Date(value).toISOString();
function target(row: TargetRow): LaboratoryTarget {
  return { id: row.id, name: row.name, fixtureRef: row.fixture_ref, description: row.description, authorizationConfirmed: true, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function job(row: JobRow, result: ResultRow | null = null): ScanJob {
  return { id: row.id, targetId: row.target_id, mode: row.mode, status: row.status, mockBehavior: row.mock_behavior, attempts: row.attempts, maxAttempts: row.max_attempts, errorCode: row.error_code, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), startedAt: row.started_at ? iso(row.started_at) : null, completedAt: row.completed_at ? iso(row.completed_at) : null, cancelRequestedAt: row.cancel_requested_at ? iso(row.cancel_requested_at) : null, result: result ? { contractVersion: result.contract_version, jobId: result.job_id, outcome: result.outcome, summary: result.summary, scannerVersion: result.scanner_version, observations: result.observations } : null };
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
  async createJob(input: { targetId: string; mode: ScanMode; mockBehavior: MockBehavior; maxAttempts: number }): Promise<ScanJob | null> {
    return this.sql.begin(async (tx) => {
      const [allowed] = await tx<{ id: string }[]>`SELECT id FROM assessment_targets WHERE id=${input.targetId} AND authorization_confirmed=true`;
      if (!allowed) return null;
      const [row] = await tx<JobRow[]>`INSERT INTO scan_jobs (target_id, mode, mock_behavior, max_attempts) VALUES (${input.targetId}, ${input.mode}, ${input.mockBehavior}, ${input.maxAttempts}) RETURNING *`;
      await tx`INSERT INTO scan_job_transitions (job_id, from_status, to_status, reason) VALUES (${row!.id}, NULL, 'queued', 'created')`;
      return job(row!);
    });
  }
  async listJobs(): Promise<ScanJob[]> { const rows = await this.sql<JobRow[]>`SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT 100`; return Promise.all(rows.map((row) => this.withResult(row))); }
  async getJob(id: string): Promise<ScanJob | null> { const [row] = await this.sql<JobRow[]>`SELECT * FROM scan_jobs WHERE id=${id}`; return row ? this.withResult(row) : null; }
  private async withResult(row: JobRow): Promise<ScanJob> { const [result] = await this.sql<ResultRow[]>`SELECT job_id, contract_version, scanner_version, outcome, summary, observations FROM mock_scan_results WHERE job_id=${row.id}`; return job(row, result ?? null); }
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
