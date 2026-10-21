export const API_VERSION = "v1" as const;

export type ServiceHealth = {
  service: "api" | "scanner";
  status: "ok";
  version: string;
};

export type PlatformStatus = {
  api: ServiceHealth;
  scanner: ServiceHealth;
};

export const scanModes = ["deterministic", "adaptive", "hybrid"] as const;
export type ScanMode = (typeof scanModes)[number];
export const scanStatuses = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type ScanStatus = (typeof scanStatuses)[number];
export const mockBehaviors = ["success", "failure", "timeout"] as const;
export type MockBehavior = (typeof mockBehaviors)[number];

export type LaboratoryTarget = {
  id: string;
  name: string;
  fixtureRef: string;
  description: string | null;
  authorizationConfirmed: true;
  createdAt: string;
  updatedAt: string;
};

export type MockScanResult = {
  contractVersion: "v1";
  jobId: string;
  outcome: "completed";
  summary: string;
  scannerVersion: string;
  observations: Array<{ type: "mock_observation"; message: string }>;
};

export type RuleOutcome = "passed" | "failed" | "not_applicable" | "unknown";
export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type RuleEvaluation = { ruleId: string; ruleVersion: string; category: string; description: string; outcome: RuleOutcome; affectedResource: string; rationale: string };
export type DeterministicFinding = { findingId: string; fingerprint: string; ruleId: string; ruleVersion: string; category: string; severity: FindingSeverity; targetRef: string; affectedResource: string; rationale: string; evidence: Record<string, unknown>; remediation: string; scanId: string; observedAt: string };
export type DeterministicScanResult = { contractVersion: "v1"; jobId: string; outcome: "completed"; summary: string; scannerVersion: string; engineVersion: string; manifestSchemaVersion: "agent-deployment/v1"; fixtureVersion: string; evaluations: RuleEvaluation[]; findings: DeterministicFinding[]; counts: { evaluated: number; passed: number; failed: number; notApplicable: number; unknown: number } };
export type ScanResult = MockScanResult | DeterministicScanResult;

export type ScanJob = {
  id: string;
  targetId: string;
  mode: ScanMode;
  status: ScanStatus;
  mockBehavior: MockBehavior;
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelRequestedAt: string | null;
  result: ScanResult | null;
};

