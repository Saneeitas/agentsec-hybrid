CREATE TABLE "hybrid_scan_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "job_id" uuid NOT NULL UNIQUE REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "contract_version" text NOT NULL, "outcome" text NOT NULL, "overall_status" text NOT NULL, "summary" text NOT NULL,
  "target_mapping_version" text NOT NULL, "correlation_version" text NOT NULL, "mapping_version" text NOT NULL,
  "component_status" jsonb NOT NULL, "component_errors" jsonb NOT NULL, "deterministic_result" jsonb, "adaptive_result" jsonb,
  "counts" jsonb NOT NULL, "generated_at" timestamp with time zone NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "hybrid_report_outcome" CHECK ("outcome" IN ('completed','partial')),
  CONSTRAINT "hybrid_report_status" CHECK ("overall_status" IN ('completed','partial_failure'))
);
CREATE TABLE "hybrid_correlations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "job_id" uuid NOT NULL REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "correlation_id" text NOT NULL, "fingerprint" text NOT NULL, "outcome" text NOT NULL, "correlation_rule" text NOT NULL,
  "correlation_version" text NOT NULL, "rationale" text NOT NULL, "provenance" jsonb NOT NULL, "limitations" jsonb NOT NULL,
  CONSTRAINT "hybrid_correlation_outcome" CHECK ("outcome" IN ('corroborated_weakness','configuration_only_weakness','behavior_only_weakness','contradictory_mitigating_evidence','inconclusive','uncorrelated'))
);
CREATE UNIQUE INDEX "hybrid_correlations_job_id_unique" ON "hybrid_correlations" ("job_id", "correlation_id");
CREATE TABLE "hybrid_unified_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "job_id" uuid NOT NULL REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "correlation_id" text NOT NULL, "category" text NOT NULL, "severity" text NOT NULL, "evidence_strength" text NOT NULL,
  "affected_components" jsonb NOT NULL, "observed_outcomes" jsonb NOT NULL, "remediation" text NOT NULL,
  CONSTRAINT "hybrid_unified_severity" CHECK ("severity" IN ('low','medium','high','critical'))
);
CREATE UNIQUE INDEX "hybrid_unified_findings_job_id_unique" ON "hybrid_unified_findings" ("job_id", "correlation_id");
