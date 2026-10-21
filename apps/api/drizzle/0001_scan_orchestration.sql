CREATE TYPE "scan_mode" AS ENUM ('deterministic', 'adaptive', 'hybrid');
CREATE TYPE "scan_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE "mock_behavior" AS ENUM ('success', 'failure', 'timeout');

CREATE TABLE "assessment_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "fixture_ref" text NOT NULL,
  "description" text,
  "authorization_confirmed" boolean NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "assessment_targets_fixture_ref_format" CHECK ("fixture_ref" ~ '^lab://[a-z0-9][a-z0-9-]{1,62}$')
);
CREATE UNIQUE INDEX "assessment_targets_fixture_ref_unique" ON "assessment_targets" ("fixture_ref");

CREATE TABLE "scan_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_id" uuid NOT NULL REFERENCES "assessment_targets"("id") ON DELETE RESTRICT,
  "mode" "scan_mode" NOT NULL,
  "status" "scan_status" DEFAULT 'queued' NOT NULL,
  "mock_behavior" "mock_behavior" DEFAULT 'success' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "lease_owner" text,
  "lease_expires_at" timestamp with time zone,
  "cancel_requested_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "scan_jobs_attempt_bounds" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 5)
);
CREATE INDEX "scan_jobs_claim_idx" ON "scan_jobs" ("status", "next_attempt_at", "lease_expires_at", "created_at");

CREATE TABLE "scan_job_transitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "from_status" "scan_status",
  "to_status" "scan_status" NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "mock_scan_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL UNIQUE REFERENCES "scan_jobs"("id") ON DELETE CASCADE,
  "contract_version" text NOT NULL,
  "scanner_version" text NOT NULL,
  "outcome" text NOT NULL,
  "summary" text NOT NULL,
  "observations" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
