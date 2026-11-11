// One connection to Valkey for the cache and rate limits.
//
// Valkey keeps data in memory, so reads take well under a millisecond. It's an optional
// speed-up: if it's down, every caller falls back (to PostgreSQL, or to in-memory counters),
// and Nook keeps working, only a little slower.

import { Redis } from "ioredis"; // Valkey speaks the same protocol as Redis, so the Redis client works
import { config } from "../config.js";

export const valkey = new Redis(config.VALKEY_URL, {
  // Fail fast instead of queuing commands while disconnected: we'd rather fall back right away.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  // Keep trying to reconnect in the background (every 1–5 s).
  retryStrategy: (times) => Math.min(times * 1000, 5000),
});

let warned = false;
valkey.on("error", (err) => {
  if (!warned) console.warn(`Valkey unavailable (${err.message}). Falling back; Nook keeps working.`);
  warned = true;
});
valkey.on("ready", () => {
  if (warned) console.log("Valkey connected again.");
  warned = false;
});

export const valkeyReady = () => valkey.status === "ready";

// For scripts and tests: wait (briefly) for the connection before using Valkey.
export function waitForValkey(timeoutMs = 2000): Promise<boolean> {
  if (valkeyReady()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onReady = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    function done(ok: boolean) {
      clearTimeout(timer);
      valkey.off("ready", onReady);
      resolve(ok);
    }
    valkey.once("ready", onReady);
  });
}
