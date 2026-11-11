// Two small guards: CSRF protection and rate limiting.

import type { Request, RequestHandler } from "express";
import { config } from "../config.js";
import { HttpError } from "./errors.js";

// --- CSRF ---------------------------------------------------------------------
// A bad website could make your browser send a POST to our API, and the browser would
// attach your login cookie. Three layers stop that:
//  1. SameSite=Lax cookie: not sent on cross-site POSTs (set in auth/sessions.ts)
//  2. Only JSON bodies: an HTML form on another site can't send Content-Type: application/json
//  3. Origin check (below): the page that sent the request must be on the site the browser opened
//
// MyWeb can be opened as localhost:3000, 192.168.1.20:3000, mypc.local:3000... so instead of one
// fixed address we compare the Origin with the Host the browser asked for. The Next.js proxy keeps
// that in X-Forwarded-Host. A bad site can't change either: the browser sets both.

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const sameOrigin: RequestHandler = (req, _res, next) => {
  if (!UNSAFE.has(req.method)) return next();

  const origin = req.get("origin");
  // No Origin header = not a browser (curl, tests, server-to-server): cookies aren't the risk there.
  if (origin && !isOwnSite(origin, req)) throw new HttpError(403, "Cross-site request blocked");

  const hasBody = Number(req.get("content-length") ?? 0) > 0 || req.get("transfer-encoding") !== undefined;
  if (hasBody && !req.is("application/json")) throw new HttpError(415, "Send JSON");
  next();
};

function isOwnSite(origin: string, req: Request): boolean {
  if (config.ALLOWED_ORIGINS.includes(origin)) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host; // "192.168.1.20:3000"
  } catch {
    return false; // "null" or garbage
  }
  const siteHost = req.get("x-forwarded-host") ?? req.get("host");
  return originHost === siteHost;
}

// --- Rate limiting --------------------------------------------------------------
// Counts requests per key in a time window, in memory. Good enough for one server.
// Stage 5 moves the counters to Valkey so several API servers share them.
//
// Note: behind the Next.js proxy every visitor arrives from 127.0.0.1, and the
// X-Forwarded-For header is whatever the browser sent. So we don't count per IP here;
// callers pick fairer keys (per email, per user, per browser). Stage 7's Caddy adds real IPs.

type Options = { windowMs: number; max: number; key: (req: Request) => string };

export function rateLimit({ windowMs, max, key }: Options): RequestHandler {
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
