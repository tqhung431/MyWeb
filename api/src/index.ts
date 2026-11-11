import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { closeQueue } from "./jobs/queue.js";
import { valkey } from "./valkey/client.js";

const server = createApp().listen(config.PORT, config.HOST, () => {
  console.log(`API listening on http://${config.HOST}:${config.PORT}`);
});

// Ctrl+C: stop taking requests, then close database connections.
async function shutdown() {
  server.close(async () => {
    await closeQueue();
    valkey.disconnect();
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
