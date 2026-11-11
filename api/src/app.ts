// Builds the Express app. Kept separate from index.ts so tests can use it without opening a port.
//
// A request passes through each app.use() in order, like stations on a line:
//   helmet → cookies → CSRF check → JSON body → who-is-this → route → (error handler)

import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { loadUser } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { sameOrigin } from "./middleware/security.js";
import { achievementsRouter } from "./routes/achievements.js";
import { arcadeRouter } from "./routes/arcade.js";
import { activityRouter } from "./routes/activity.js";
import { authRouter } from "./routes/auth.js";
import { companionRouter } from "./routes/companion.js";
import { meRouter } from "./routes/me.js";
import { musicRouter } from "./routes/music.js";
import { sessionsRouter } from "./routes/sessions.js";
import { tipsRouter } from "./routes/tips.js";
import { valkey, valkeyReady } from "./valkey/client.js";

export function createApp() {
  const app = express();

  // Stage 4: the browser reaches the API through the website (Next.js forwards /api/*),
  // so it's the same origin and CORS isn't needed any more. Every PC on the network uses
  // the same website address, and only the website talks to the API.
  // We don't trust X-Forwarded-For: the Next.js proxy passes on whatever the browser sent.
  app.set("trust proxy", config.TRUST_PROXY); // Stage 7: Caddy in front → 1 (see config.ts)

  app.use(helmet()); // safe default security headers
  app.use(cookieParser()); // req.cookies
  app.use(sameOrigin); // CSRF: unsafe requests must come from our own site, as JSON
  app.use(express.json({ limit: "10kb" })); // parse JSON bodies, refuse huge ones
  app.use(loadUser); // req.user from the login cookie

  // Is everything up? PostgreSQL is required; Valkey is optional (Nook falls back without it).
  app.get("/health", async (_req, res) => {
    await pool.query("select 1"); // throws → 500 if the database is down
    const valkeyUp = valkeyReady() && (await valkey.ping().then(() => true, () => false));
    res.json({ ok: true, database: "up", valkey: valkeyUp ? "up" : "down (running without cache)" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/tips", tipsRouter);
  app.use("/api/sessions", sessionsRouter);
  app.use("/api/achievements", achievementsRouter);
  app.use("/api/activity", activityRouter);
  app.use("/api/me", meRouter);
  app.use("/api/songs", musicRouter);
  app.use("/api/companion", companionRouter);
  app.use("/api/arcade", arcadeRouter);

  app.use(notFound);
  app.use(errorHandler); // must be last
  return app;
}
