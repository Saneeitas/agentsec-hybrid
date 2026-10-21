import { randomUUID } from "node:crypto";
import type { MockScanResult, ScanJob } from "@asf/contracts";
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
      const response = await this.request(`${this.config.scannerBaseUrl}/internal/v1/mock-scans`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.config.scannerServiceToken}` }, body: JSON.stringify({ job_id: job.id, target_ref: job.targetId, mode: job.mode, behavior: job.mockBehavior, delay_ms: job.mockBehavior === "timeout" ? this.config.scanExecutionTimeoutMs * 2 : 10 }), signal: AbortSignal.timeout(this.config.scanExecutionTimeoutMs) });
      if (!response.ok) throw new Error(response.status >= 500 ? "scanner_failure" : "scanner_rejected");
      const result = await response.json() as MockScanResult;
      if (result.contractVersion !== "v1" || result.jobId !== job.id || result.outcome !== "completed") throw new Error("invalid_scanner_response");
      await this.store.completeJob(job.id, this.owner, result);
    } catch (error) {
      const known = error instanceof Error && ["scanner_failure", "scanner_rejected", "invalid_scanner_response"].includes(error.message) ? error.message : "scanner_failure";
      const code = error instanceof DOMException && error.name === "TimeoutError" ? "scanner_timeout" : known;
      await this.store.failOrRetryJob(job.id, this.owner, code, this.config.scanRetryDelayMs);
    }
  }
}
