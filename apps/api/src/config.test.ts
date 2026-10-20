import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("enables validated database TLS by default", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://user:password@db.example.test:5432/postgres" });
    expect(config.databaseSsl).toBe(true);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() => loadConfig({ DATABASE_URL: "https://example.test/database" })).toThrow("PostgreSQL protocol");
  });
});

