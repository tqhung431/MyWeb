import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { closeQueue } from "./jobs/queue.js";
import { attachRealtime } from "./realtime/server.js";
import { valkey } from "./valkey/client.js";

const server = createApp().listen(config.PORT, config.HOST, () => {
  console.log(`API listening on http://${config.HOST}:${config.PORT}`);
  // Stage 29: pages only say "Admin isn't enabled"; the reason is here, for the person who runs Nook
  if (config.ADMIN_PASSCODE && config.ADMIN_PASSCODE.length < 16)
    console.warn("Admin is off: ADMIN_PASSCODE in .env is shorter than 16 characters (docs/stage-27.md).");
});
// Stage 6: WebSockets on the same port, at /api/realtime
const io = await attachRealtime(server);

// Ctrl+C: stop taking requests, then close database connections.
async function shutdown() {
  io.disconnectSockets(true);
  server.close(async () => {
    await closeQueue();
    valkey.disconnect();
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
