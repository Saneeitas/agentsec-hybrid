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

