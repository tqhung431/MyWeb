// Stage 22: the game server's own program (docker service "arena", `npm run arena` in development).
// It shares Nook's database and sign-in, but runs apart from the API so games never slow the rest down.
import { createServer } from "node:http";
import { attachArena } from "./arena/server.js";
import { config } from "./config.js";
import { waitForValkey } from "./valkey/client.js";

const http = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
    return;
  }
  res.writeHead(404).end();
});

await waitForValkey(1500); // the live feed ("… won a chess game") goes through Valkey to the API's sockets
attachArena(http);
http.listen(config.ARENA_PORT, config.HOST, () => console.log(`Nook Arena listening on http://${config.HOST}:${config.ARENA_PORT}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => http.close(() => process.exit(0)));
