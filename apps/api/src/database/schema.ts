import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const systemMetadata = pgTable("system_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const scanMode = pgEnum("scan_mode", ["deterministic", "adaptive", "hybrid"]);
export const scanStatus = pgEnum("scan_status", ["queued", "running", "completed", "failed", "cancelled"]);
export const mockBehavior = pgEnum("mock_behavior", ["success", "failure", "timeout"]);

export const assessmentTargets = pgTable("assessment_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  fixtureRef: text("fixture_ref").notNull(),
  description: text("description"),
  authorizationConfirmed: boolean("authorization_confirmed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("assessment_targets_fixture_ref_unique").on(table.fixtureRef)]);

export const scanJobs = pgTable("scan_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  targetId: uuid("target_id").notNull().references(() => assessmentTargets.id, { onDelete: "restrict" }),
  mode: scanMode("mode").notNull(),
  status: scanStatus("status").default("queued").notNull(),
  mockBehavior: mockBehavior("mock_behavior").default("success").notNull(),
  adaptiveAssessmentMode: text("adaptive_assessment_mode").default("simulator").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const scanJobTransitions = pgTable("scan_job_transitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }),
  fromStatus: scanStatus("from_status"),
  toStatus: scanStatus("to_status").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const mockScanResults = pgTable("mock_scan_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }).unique(),
  contractVersion: text("contract_version").notNull(),
  scannerVersion: text("scanner_version").notNull(),
  outcome: text("outcome").notNull(),
  summary: text("summary").notNull(),
  observations: jsonb("observations").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const deterministicScanResults = pgTable("deterministic_scan_results", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }).unique(),
  contractVersion: text("contract_version").notNull(), scannerVersion: text("scanner_version").notNull(), engineVersion: text("engine_version").notNull(), manifestSchemaVersion: text("manifest_schema_version").notNull(), fixtureVersion: text("fixture_version").notNull(), summary: text("summary").notNull(), counts: jsonb("counts").notNull(), evaluations: jsonb("evaluations").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const deterministicFindings = pgTable("deterministic_findings", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }), findingId: text("finding_id").notNull(), fingerprint: text("fingerprint").notNull(), ruleId: text("rule_id").notNull(), ruleVersion: text("rule_version").notNull(), category: text("category").notNull(), severity: text("severity").notNull(), targetRef: text("target_ref").notNull(), affectedResource: text("affected_resource").notNull(), rationale: text("rationale").notNull(), evidence: jsonb("evidence").notNull(), remediation: text("remediation").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("deterministic_findings_job_finding_unique").on(table.jobId, table.findingId)]);

export const adaptiveScanResults = pgTable("adaptive_scan_results", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }).unique(), contractVersion: text("contract_version").notNull(), assessmentMode: text("assessment_mode").notNull(), engineVersion: text("engine_version").notNull(), provider: jsonb("provider"), summary: text("summary").notNull(), overallClassification: text("overall_classification").notNull(), probes: jsonb("probes").notNull(), budgets: jsonb("budgets").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const adaptiveFindings = pgTable("adaptive_findings", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }), findingId: text("finding_id").notNull(), fingerprint: text("fingerprint").notNull(), assessmentMode: text("assessment_mode").notNull(), probeId: text("probe_id").notNull(), scenarioId: text("scenario_id").notNull(), securityObjective: text("security_objective").notNull(), severity: text("severity").notNull(), confidence: text("confidence").notNull(), confidenceRationale: text("confidence_rationale").notNull(), observedBehavior: text("observed_behavior").notNull(), evidence: jsonb("evidence").notNull(), remediation: text("remediation").notNull(), provider: jsonb("provider").notNull(), observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("adaptive_findings_job_finding_unique").on(table.jobId, table.findingId)]);

export const hybridScanReports = pgTable("hybrid_scan_reports", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }).unique(), contractVersion: text("contract_version").notNull(), outcome: text("outcome").notNull(), overallStatus: text("overall_status").notNull(), summary: text("summary").notNull(), targetMappingVersion: text("target_mapping_version").notNull(), correlationVersion: text("correlation_version").notNull(), mappingVersion: text("mapping_version").notNull(), componentStatus: jsonb("component_status").notNull(), componentErrors: jsonb("component_errors").notNull(), deterministicResult: jsonb("deterministic_result"), adaptiveResult: jsonb("adaptive_result"), counts: jsonb("counts").notNull(), generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const hybridCorrelations = pgTable("hybrid_correlations", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }), correlationId: text("correlation_id").notNull(), fingerprint: text("fingerprint").notNull(), outcome: text("outcome").notNull(), correlationRule: text("correlation_rule").notNull(), correlationVersion: text("correlation_version").notNull(), rationale: text("rationale").notNull(), provenance: jsonb("provenance").notNull(), limitations: jsonb("limitations").notNull()
}, (table) => [uniqueIndex("hybrid_correlations_job_id_unique").on(table.jobId, table.correlationId)]);

export const hybridUnifiedFindings = pgTable("hybrid_unified_findings", {
  id: uuid("id").defaultRandom().primaryKey(), jobId: uuid("job_id").notNull().references(() => scanJobs.id, { onDelete: "cascade" }), correlationId: text("correlation_id").notNull(), category: text("category").notNull(), severity: text("severity").notNull(), evidenceStrength: text("evidence_strength").notNull(), affectedComponents: jsonb("affected_components").notNull(), observedOutcomes: jsonb("observed_outcomes").notNull(), remediation: text("remediation").notNull()
}, (table) => [uniqueIndex("hybrid_unified_findings_job_id_unique").on(table.jobId, table.correlationId)]);

