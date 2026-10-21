import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database/client.js";
import { Store } from "./store.js";
import { ScanWorker } from "./worker.js";

const config = loadConfig();
const database = createDatabase(config);
const store = new Store(database.client);
const worker = new ScanWorker(store, config);
const app = buildApp(config, store);
app.addHook("onClose", async () => { worker.stop(); await database.close(); });

try {
  await app.listen({ host: "0.0.0.0", port: config.port });
  worker.start();
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

