// Two small guards: CSRF protection and rate limiting.

import type { Request, RequestHandler } from "express";
import { config } from "../config.js";
import { HttpError } from "./errors.js";

// --- CSRF ---------------------------------------------------------------------
// A bad website could make your browser send a POST to our API, and the browser would
// attach your login cookie. Three layers stop that:
//  1. SameSite=Lax cookie: not sent on cross-site POSTs (set in auth/sessions.ts)
//  2. Only JSON bodies: an HTML form on another site can't send Content-Type: application/json
//  3. Origin check (below): browsers say where a request came from; it must be our site

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const allowedOrigin = new URL(config.PUBLIC_URL).origin;

export const sameOrigin: RequestHandler = (req, _res, next) => {
  if (!UNSAFE.has(req.method)) return next();
  const origin = req.get("origin");
  // No Origin header = not a browser (curl, tests, server-to-server): cookies aren't the risk there.
  if (origin && origin !== allowedOrigin) throw new HttpError(403, "Cross-site request blocked");
  const hasBody = Number(req.get("content-length") ?? 0) > 0 || req.get("transfer-encoding") !== undefined;
  if (hasBody && !req.is("application/json")) {
    throw new HttpError(415, "Send JSON");
  }
  next();
};

// --- Rate limiting --------------------------------------------------------------
// Counts requests per key in a time window, in memory. Good enough for one server.
// Stage 5 moves the counters to Valkey so several API servers share them.

type Options = { windowMs: number; max: number; key?: (req: Request) => string };

export function rateLimit({ windowMs, max, key = (req) => req.ip ?? "unknown" }: Options): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count++;

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HttpError(429, "Too many attempts. Please wait a few minutes.");
    }

    if (hits.size > 10_000) {
      for (const [k2, v] of hits) if (v.resetAt <= now) hits.delete(k2); // tidy old entries
    }
    next();
  };
}
