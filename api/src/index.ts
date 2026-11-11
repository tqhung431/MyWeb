import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/client.js";

const server = createApp().listen(config.PORT, config.HOST, () => {
  console.log(`API listening on http://${config.HOST}:${config.PORT}`);
});

// Ctrl+C: stop taking requests, then close database connections.
process.on("SIGINT", () => {
  server.close(() => void pool.end().then(() => process.exit(0)));
});
