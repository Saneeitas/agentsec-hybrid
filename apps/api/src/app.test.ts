import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { testConfig as config } from "./test-config.js";

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

