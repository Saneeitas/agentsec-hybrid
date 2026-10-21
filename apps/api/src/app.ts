import cors from "@fastify/cors";
import Fastify from "fastify";
import type { PlatformStatus, ServiceHealth } from "@asf/contracts";
import type { AppConfig } from "./config.js";
import type { Store } from "./store.js";
import { registerRoutes } from "./routes.js";

const version = "0.1.0";
type StatusError = { error: "scanner_unavailable" };

export function buildApp(config: AppConfig, store?: Store) {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_048_576,
    requestTimeout: 10_000
  });

  void app.register(cors, {
    origin: config.webOrigin,
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["authorization", "content-type"]
  });

  if (store) registerRoutes(app, store, config);

  app.get<{ Reply: ServiceHealth }>("/health", async () => ({
    service: "api",
    status: "ok",
    version
  }));

  app.get<{ Reply: PlatformStatus | StatusError }>("/api/v1/status", async (_request, reply) => {
    try {
      const response = await fetch(`${config.scannerBaseUrl}/health`, {
        signal: AbortSignal.timeout(config.scannerRequestTimeoutMs)
      });
      if (!response.ok) {
        throw new Error(`Scanner returned HTTP ${response.status}`);
      }
      const scanner = (await response.json()) as ServiceHealth;
      return {
        api: { service: "api", status: "ok", version },
        scanner
      };
    } catch (error) {
      app.log.warn({ error }, "Scanner health request failed");
      return reply.code(503).send({ error: "scanner_unavailable" });
    }
  });

  return app;
}

