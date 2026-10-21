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
export type AdaptiveAssessmentMode = "simulator" | "model_mediated";
export type AdaptiveFinding = { findingId: string; fingerprint: string; assessmentMode: AdaptiveAssessmentMode; probeId: string; scenarioId: string; securityObjective: string; severity: FindingSeverity; confidence: "confirmed"; confidenceRationale: string; observedBehavior: string; evidence: Array<Record<string, unknown>>; remediation: string; provider: Record<string, unknown>; scanId: string; observedAt: string };
export type AdaptiveScanResult = { contractVersion: "adaptive-result/v1"; jobId: string; outcome: "completed"; assessmentMode: AdaptiveAssessmentMode; engineVersion: string; provider: Record<string, unknown> | null; summary: string; overallClassification: "confirmed_violation" | "no_violation_observed" | "inconclusive"; probes: Array<Record<string, unknown>>; findings: AdaptiveFinding[]; budgets: { maxProbes: number; maxProviderTokens: number; maxWallTimeMs: number; usedProbes: number; usedProviderTokens: number } };
export type ScanResult = MockScanResult | DeterministicScanResult | AdaptiveScanResult;

export type ScanJob = {
  id: string;
  targetId: string;
  mode: ScanMode;
  status: ScanStatus;
  mockBehavior: MockBehavior;
  adaptiveAssessmentMode: AdaptiveAssessmentMode;
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

export type LabScenarioSummary = { scenarioId: string; version: "1.0.0"; corpus: "development"; securityObjective: string; groundTruthLabel: string };
export type LabTrace = { sequence: number; scenarioId: string; runId: string; agentId: string; toolId: "read_document" | "search_knowledge_base" | "send_message" | "update_record" | "execute_approved_action"; requestedAction: { operation: string; resourceId: string | null; scope: string }; policyContext: { authorizationEnforced: boolean; approvalRequired: boolean; approved: boolean }; authorizationDecision: "allow" | "deny" | "require_approval"; executionOutcome: "simulated_success" | "not_executed"; dataClassification: "public" | "internal" | "sensitive"; evidenceCode: string; value: string | null; timestamp: string };
export type LabRunResult = { contractVersion: "lab-trace/v1"; scenarioId: string; scenarioVersion: "1.0.0"; runId: string; agentId: string; outcome: "completed"; observedSecurityOutcome: "prevented" | "weakness_observed" | "secure_execution"; resetRequired: false; traces: LabTrace[]; groundTruth: { vulnerability: boolean; label: string; expected_decisions: Array<"allow" | "deny" | "require_approval">; expected_outcome: "prevented" | "weakness_observed" | "secure_execution"; expected_evidence: string[]; established_by: "manual_policy_derivation" } };

