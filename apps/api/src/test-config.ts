import type { AppConfig } from "./config.js";

export const testConfig: AppConfig = {
  databaseUrl: "postgresql://user:password@db.example.test:5432/postgres",
  databaseSsl: true,
  port: 3000,
  webOrigin: "http://localhost:5173",
  scannerBaseUrl: "http://scanner.test",
  scannerRequestTimeoutMs: 1000,
  apiAuthToken: "operator-test-token-with-at-least-32-characters",
  scannerServiceToken: "scanner-test-token-with-at-least-32-characters",
  workerPollIntervalMs: 100,
  workerLeaseMs: 1000,
  workerConcurrency: 1,
  scanExecutionTimeoutMs: 500,
  scanMaxAttempts: 3,
  scanRetryDelayMs: 100
};
