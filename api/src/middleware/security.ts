// Two small guards: CSRF protection and rate limiting.

import type { Request, RequestHandler } from "express";
import { config } from "../config.js";
import { valkey, valkeyReady } from "../valkey/client.js";
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
// Counts requests per key in a time window ("fixed window").
//
// Stage 5: the counters live in Valkey, so several API servers share them, and a restart
// doesn't reset them. If Valkey is down, each server falls back to counting in its own memory.
//
// Note: behind the Next.js proxy every visitor arrives from 127.0.0.1, and the
// X-Forwarded-For header is whatever the browser sent. So we don't count per IP here;
// callers pick fairer keys (per email, per user, per browser). Stage 7's Caddy adds real IPs.

type Options = { name: string; windowMs: number; max: number; key: (req: Request) => string };

export function rateLimit({ name, windowMs, max, key }: Options): RequestHandler {
  const local = new Map<string, { count: number; resetAt: number }>();

  // In memory: used when Valkey is unavailable.
  function countLocally(k: string) {
    const now = Date.now();
    let entry = local.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      local.set(k, entry);
    }
    entry.count++;
    if (local.size > 10_000) for (const [k2, v] of local) if (v.resetAt <= now) local.delete(k2);
    return { count: entry.count, msLeft: entry.resetAt - now };
  }

  // In Valkey: INCR adds 1 and returns the new count, atomically, even with many servers.
  // PEXPIRE ... NX starts the window's timer only on the first hit.
  async function countInValkey(k: string) {
    const redisKey = `ratelimit:${name}:${k}`;
    const results = await valkey.multi().incr(redisKey).pexpire(redisKey, windowMs, "NX").pttl(redisKey).exec();
    if (!results) throw new Error("rate limit transaction failed");
    return { count: Number(results[0][1]), msLeft: Math.max(0, Number(results[2][1])) };
  }

  return async (req, res, next) => {
    const k = key(req);
    let result: { count: number; msLeft: number };
    try {
      result = valkeyReady() ? await countInValkey(k) : countLocally(k);
    } catch {
      result = countLocally(k);
    }

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - result.count)));
    if (result.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(result.msLeft / 1000))));
      throw new HttpError(429, "Too many attempts. Please wait a few minutes.");
    }
    next();
  };
}
