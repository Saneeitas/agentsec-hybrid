import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const environment = { DATABASE_URL: "postgresql://user:password@db.example.test:5432/postgres", API_AUTH_TOKEN: "operator-test-token-with-at-least-32-characters", SCANNER_SERVICE_TOKEN: "scanner-test-token-with-at-least-32-characters" };
  it("enables validated database TLS by default", () => {
    const config = loadConfig(environment);
    expect(config.databaseSsl).toBe(true);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() => loadConfig({ ...environment, DATABASE_URL: "https://example.test/database" })).toThrow("PostgreSQL protocol");
  });
});

