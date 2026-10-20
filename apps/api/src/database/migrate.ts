import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadConfig } from "../config.js";
import { createDatabase } from "./client.js";

const database = createDatabase(loadConfig());

try {
  await migrate(database.db, { migrationsFolder: "drizzle" });
  console.info("Database migrations completed");
} finally {
  await database.close();
}

