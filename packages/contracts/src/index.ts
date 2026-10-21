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
  result: MockScanResult | null;
};

