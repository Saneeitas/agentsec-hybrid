import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AppConfig } from "../config.js";
import * as schema from "./schema.js";

export function createDatabase(config: Pick<AppConfig, "databaseUrl" | "databaseSsl">) {
  const client = postgres(config.databaseUrl, {
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });

  return {
    db: drizzle(client, { schema }),
    client,
    close: () => client.end()
  };
}

