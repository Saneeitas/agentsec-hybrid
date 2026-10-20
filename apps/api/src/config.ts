import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), {
    message: "DATABASE_URL must use the PostgreSQL protocol"
  }),
  DATABASE_SSL: z.enum(["true", "false"]).default("true"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SCANNER_BASE_URL: z.string().url().default("http://localhost:8000"),
  SCANNER_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3000)
});

export type AppConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
  port: number;
  webOrigin: string;
  scannerBaseUrl: string;
  scannerRequestTimeoutMs: number;
};

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
    scannerRequestTimeoutMs: result.data.SCANNER_REQUEST_TIMEOUT_MS
  };
}

