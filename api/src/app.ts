// Builds the Express app. Kept separate from index.ts so tests can use it without opening a port.
//
// A request passes through each app.use() in order, like stations on a line:
//   helmet → cookies → CSRF check → JSON body → who-is-this → route → (error handler)

import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pool } from "./db/client.js";
import { loadUser } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { sameOrigin } from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { sessionsRouter } from "./routes/sessions.js";
import { tipsRouter } from "./routes/tips.js";

export function createApp() {
  const app = express();

  // Stage 4: the browser now reaches the API through the website (Next.js rewrites /api/*),
  // so it's the same origin and CORS isn't needed any more.
  // req.ip comes from X-Forwarded-For when the request arrives from a local proxy.
  // Careful: Next.js passes that header on unchanged and doesn't add the real IP, so
  // until Caddy (Stage 7) sets it, the IP is only a hint. Logins are also limited per email.
  app.set("trust proxy", "loopback");

  app.use(helmet()); // safe default security headers
  app.use(cookieParser()); // req.cookies
  app.use(sameOrigin); // CSRF: unsafe requests must come from our own site, as JSON
  app.use(express.json({ limit: "10kb" })); // parse JSON bodies, refuse huge ones
  app.use(loadUser); // req.user from the login cookie

  app.get("/health", async (_req, res) => {
    await pool.query("select 1"); // also checks the database is reachable
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/tips", tipsRouter);
  app.use("/api/sessions", sessionsRouter);

  app.use(notFound);
  app.use(errorHandler); // must be last
  return app;
}
