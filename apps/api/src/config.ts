import { z } from "zod";

const blankAsUndefined = (value: unknown) => value === "" ? undefined : value;
const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
    message: "DATABASE_URL must use the PostgreSQL protocol"
  }),
  DATABASE_SSL: z.preprocess(blankAsUndefined, z.enum(["true", "false"]).default("true"))
});
const environmentSchema = databaseEnvironmentSchema.extend({
  API_PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  WEB_ORIGIN: z.preprocess(blankAsUndefined, z.string().url().default("http://localhost:5173")),
  SCANNER_BASE_URL: z.preprocess(blankAsUndefined, z.string().url().default("http://localhost:8000")),
  SCANNER_REQUEST_TIMEOUT_MS: z.preprocess(blankAsUndefined, z.coerce.number().int().min(100).max(30_000).default(3000)),
  API_AUTH_TOKEN: z.string().min(32),
  SCANNER_SERVICE_TOKEN: z.string().min(32),
  WORKER_POLL_INTERVAL_MS: z.preprocess(blankAsUndefined, z.coerce.number().int().min(100).max(60_000).default(1000)),
  WORKER_LEASE_MS: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1000).max(300_000).default(15_000)),
  WORKER_CONCURRENCY: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(10).default(2)),
  SCAN_EXECUTION_TIMEOUT_MS: z.preprocess(blankAsUndefined, z.coerce.number().int().min(100).max(30_000).default(5000)),
  SCAN_MAX_ATTEMPTS: z.preprocess(blankAsUndefined, z.coerce.number().int().min(1).max(5).default(3)),
  SCAN_RETRY_DELAY_MS: z.preprocess(blankAsUndefined, z.coerce.number().int().min(100).max(60_000).default(500))
});

export type AppConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
  port: number;
  webOrigin: string;
  scannerBaseUrl: string;
  scannerRequestTimeoutMs: number;
  apiAuthToken: string;
  scannerServiceToken: string;
  workerPollIntervalMs: number;
  workerLeaseMs: number;
  workerConcurrency: number;
  scanExecutionTimeoutMs: number;
  scanMaxAttempts: number;
  scanRetryDelayMs: number;
};

export function loadDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): Pick<AppConfig, "databaseUrl" | "databaseSsl"> {
  const result = databaseEnvironmentSchema.safeParse(environment);
  if (!result.success) throw new Error(`Invalid database configuration: ${z.prettifyError(result.error)}`);
  return { databaseUrl: result.data.DATABASE_URL, databaseSsl: result.data.DATABASE_SSL === "true" };
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }

  return {
    databaseUrl: result.data.DATABASE_URL,
    databaseSsl: result.data.DATABASE_SSL === "true",
    port: result.data.API_PORT,
    webOrigin: result.data.WEB_ORIGIN,
    scannerBaseUrl: result.data.SCANNER_BASE_URL.replace(/\/$/, ""),
    scannerRequestTimeoutMs: result.data.SCANNER_REQUEST_TIMEOUT_MS,
    apiAuthToken: result.data.API_AUTH_TOKEN,
    scannerServiceToken: result.data.SCANNER_SERVICE_TOKEN,
    workerPollIntervalMs: result.data.WORKER_POLL_INTERVAL_MS,
    workerLeaseMs: result.data.WORKER_LEASE_MS,
    workerConcurrency: result.data.WORKER_CONCURRENCY,
    scanExecutionTimeoutMs: result.data.SCAN_EXECUTION_TIMEOUT_MS,
    scanMaxAttempts: result.data.SCAN_MAX_ATTEMPTS,
    scanRetryDelayMs: result.data.SCAN_RETRY_DELAY_MS
  };
}

