import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { requireBearer } from "./auth.js";
import type { Store } from "./store.js";

const id = z.uuid();
const targetCreate = z.object({ name: z.string().trim().min(1).max(100), fixtureRef: z.string().regex(/^lab:\/\/[a-z0-9][a-z0-9-]{1,62}$/), description: z.string().trim().max(500).optional(), authorizationConfirmed: z.literal(true) }).strict();
const targetUpdate = z.object({ name: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(500).nullable().optional() }).strict().refine((v) => Object.keys(v).length > 0);
const scanCreate = z.object({ targetId: id, mode: z.enum(["deterministic", "adaptive", "hybrid"]) }).strict();
const labScenario = z.object({ scenarioId: z.string().regex(/^LAB-[0-9]{3}-(SECURE|VULNERABLE)$/) }).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }): T | undefined {
  const result = schema.safeParse(value);
  if (!result.success) { reply.code(400).send({ error: "invalid_request", details: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }); return; }
  return result.data;
}

export function registerRoutes(app: FastifyInstance, store: Store, config: AppConfig) {
  const auth = { preHandler: requireBearer(config.apiAuthToken) };
  const scanner = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${config.scannerBaseUrl}${path}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${config.scannerServiceToken}`, ...init?.headers }, signal: AbortSignal.timeout(config.scannerRequestTimeoutMs) });
    const body = await response.json();
    if (!response.ok) return { status: response.status, body };
    return { status: 200, body };
  };
  app.post("/api/v1/targets", auth, async (request, reply) => { const body = parse(targetCreate, request.body, reply); if (!body) return; try { return reply.code(201).send(await store.createTarget(body)); } catch (error) { if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "fixture_ref_exists" }); throw error; } });
  app.get("/api/v1/targets", auth, async () => store.listTargets());
  app.get("/api/v1/targets/:id", auth, async (request, reply) => { const targetId = parse(id, (request.params as { id: string }).id, reply); if (!targetId) return; const found = await store.getTarget(targetId); return found ?? reply.code(404).send({ error: "target_not_found" }); });
  app.patch("/api/v1/targets/:id", auth, async (request, reply) => { const targetId = parse(id, (request.params as { id: string }).id, reply); const body = parse(targetUpdate, request.body, reply); if (!targetId || !body) return; const found = await store.updateTarget(targetId, body); return found ?? reply.code(404).send({ error: "target_not_found" }); });
  app.post("/api/v1/scans", auth, async (request, reply) => { const body = parse(scanCreate, request.body, reply); if (!body) return; const created = await store.createJob({ ...body, mockBehavior: "success", maxAttempts: config.scanMaxAttempts }); return created ? reply.code(202).send(created) : reply.code(404).send({ error: "authorized_target_not_found" }); });
  app.get("/api/v1/scans", auth, async () => store.listJobs());
  app.get("/api/v1/scans/:id", auth, async (request, reply) => { const jobId = parse(id, (request.params as { id: string }).id, reply); if (!jobId) return; const found = await store.getJob(jobId); return found ?? reply.code(404).send({ error: "scan_not_found" }); });
  app.post("/api/v1/scans/:id/cancel", auth, async (request, reply) => { const jobId = parse(id, (request.params as { id: string }).id, reply); if (!jobId) return; const found = await store.cancelJob(jobId); return found ?? reply.code(404).send({ error: "scan_not_found" }); });
  app.get("/api/v1/lab/scenarios", auth, async (_request, reply) => { const result = await scanner("/internal/v1/lab/scenarios"); return reply.code(result.status).send(result.body); });
  app.post("/api/v1/lab/runs", auth, async (request, reply) => { const body = parse(labScenario, request.body, reply); if (!body) return; const result = await scanner("/internal/v1/lab/runs", { method: "POST", body: JSON.stringify({ scenario_id: body.scenarioId, run_id: randomUUID() }) }); return reply.code(result.status).send(result.body); });
  app.post("/api/v1/lab/reset", auth, async (request, reply) => { const body = parse(labScenario, request.body, reply); if (!body) return; const result = await scanner("/internal/v1/lab/reset", { method: "POST", body: JSON.stringify({ scenario_id: body.scenarioId }) }); return reply.code(result.status).send(result.body); });
}
