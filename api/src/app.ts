// Builds the Express app. Kept separate from index.ts so tests can use it without opening a port.
//
// A request passes through each app.use() in order, like stations on a line:
//   helmet → cors → json body → route → (error handler if something threw)

import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { sessionsRouter } from "./routes/sessions.js";
import { tipsRouter } from "./routes/tips.js";

export function createApp() {
  const app = express();

  app.use(helmet()); // safe default security headers
  app.use(cors({ origin: config.WEB_ORIGIN })); // only our website may call us from a browser
  app.use(express.json({ limit: "10kb" })); // parse JSON bodies, refuse huge ones

  app.get("/health", async (_req, res) => {
    await pool.query("select 1"); // also checks the database is reachable
    res.json({ ok: true });
  });

  app.use("/api/tips", tipsRouter);
  app.use("/api/sessions", sessionsRouter);

  app.use(notFound);
  app.use(errorHandler); // must be last
  return app;
}
