import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { testConfig as config } from "./test-config.js";
import type { Store } from "./store.js";

afterEach(() => vi.restoreAllMocks());

describe("health routes", () => {
  it("reports API health", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "api", status: "ok" });
    await app.close();
  });

  it("reports API-to-scanner communication", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ service: "scanner", status: "ok", version: "0.1.0" }), { status: 200 })));
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/api/v1/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json().scanner).toMatchObject({ service: "scanner", status: "ok" });
    await app.close();
  });

  it("returns a bounded error when the scanner is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/api/v1/status" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "scanner_unavailable" });
    await app.close();
  });
});

describe("laboratory proxy", () => {
  const authorization = { authorization: `Bearer ${config.apiAuthToken}` };
  const store = {} as Store;

  it("requires operator authentication", async () => {
    const app = buildApp(config, store);
    expect((await app.inject({ method: "GET", url: "/api/v1/lab/scenarios" })).statusCode).toBe(401);
    await app.close();
  });

  it("runs only a selected predefined scenario", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ contractVersion: "lab-trace/v1", scenarioId: "LAB-001-SECURE", outcome: "completed", traces: [] }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const app = buildApp(config, store);
    const response = await app.inject({ method: "POST", url: "/api/v1/lab/runs", headers: authorization, payload: { scenarioId: "LAB-001-SECURE" } });
    expect(response.statusCode).toBe(200);
    const sent = JSON.parse(request.mock.calls[0]![1].body as string);
    expect(sent).toMatchObject({ scenario_id: "LAB-001-SECURE" });
    expect(sent.run_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.actions).toBeUndefined();
    await app.close();
  });

  it("rejects caller-supplied actions and malformed scenario identifiers", async () => {
    const app = buildApp(config, store);
    const response = await app.inject({ method: "POST", url: "/api/v1/lab/runs", headers: authorization, payload: { scenarioId: "../escape", actions: [{ tool: "shell" }] } });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

