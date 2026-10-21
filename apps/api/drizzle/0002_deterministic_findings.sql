CREATE TABLE "deterministic_scan_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL UNIQUE REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "contract_version" text NOT NULL, "scanner_version" text NOT NULL,
  "engine_version" text NOT NULL, "manifest_schema_version" text NOT NULL,
  "fixture_version" text NOT NULL, "summary" text NOT NULL,
  "counts" jsonb NOT NULL, "evaluations" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "deterministic_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "finding_id" text NOT NULL, "fingerprint" text NOT NULL,
  "rule_id" text NOT NULL, "rule_version" text NOT NULL,
  "category" text NOT NULL, "severity" text NOT NULL,
  "target_ref" text NOT NULL, "affected_resource" text NOT NULL,
  "rationale" text NOT NULL, "evidence" jsonb NOT NULL,
  "remediation" text NOT NULL, "observed_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deterministic_findings_severity" CHECK ("severity" IN ('low','medium','high','critical'))
);
CREATE UNIQUE INDEX "deterministic_findings_job_finding_unique" ON "deterministic_findings" ("job_id", "finding_id");
CREATE INDEX "deterministic_findings_job_severity_idx" ON "deterministic_findings" ("job_id", "severity");
