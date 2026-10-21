import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadDatabaseConfig } from "../config.js";
import { createDatabase } from "./client.js";

const database = createDatabase(loadDatabaseConfig());

try {
  await migrate(database.db, { migrationsFolder: "drizzle" });
  console.info("Database migrations completed");
} finally {
  await database.close();
}

