ALTER TABLE "scan_jobs" ADD COLUMN "adaptive_assessment_mode" text DEFAULT 'simulator' NOT NULL;
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_adaptive_mode" CHECK ("adaptive_assessment_mode" IN ('simulator','model_mediated'));
CREATE TABLE "adaptive_scan_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "job_id" uuid NOT NULL UNIQUE REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "contract_version" text NOT NULL, "assessment_mode" text NOT NULL, "engine_version" text NOT NULL, "provider" jsonb,
  "summary" text NOT NULL, "overall_classification" text NOT NULL, "probes" jsonb NOT NULL, "budgets" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "adaptive_results_mode" CHECK ("assessment_mode" IN ('simulator','model_mediated')),
  CONSTRAINT "adaptive_results_classification" CHECK ("overall_classification" IN ('confirmed_violation','no_violation_observed','inconclusive'))
);
CREATE TABLE "adaptive_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "job_id" uuid NOT NULL REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "finding_id" text NOT NULL, "fingerprint" text NOT NULL, "assessment_mode" text NOT NULL, "probe_id" text NOT NULL,
  "scenario_id" text NOT NULL, "security_objective" text NOT NULL, "severity" text NOT NULL, "confidence" text NOT NULL,
  "confidence_rationale" text NOT NULL, "observed_behavior" text NOT NULL, "evidence" jsonb NOT NULL, "remediation" text NOT NULL,
  "provider" jsonb NOT NULL, "observed_at" timestamp with time zone NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "adaptive_findings_mode" CHECK ("assessment_mode" IN ('simulator','model_mediated')),
  CONSTRAINT "adaptive_findings_severity" CHECK ("severity" IN ('low','medium','high','critical')),
  CONSTRAINT "adaptive_findings_confidence" CHECK ("confidence" = 'confirmed')
);
CREATE UNIQUE INDEX "adaptive_findings_job_finding_unique" ON "adaptive_findings" ("job_id", "finding_id");
