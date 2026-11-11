// "Cache-aside": look in Valkey first; on a miss, load from PostgreSQL and keep a copy for next time.
//
//   request → Valkey has "tips:list"? ── yes → answer (HIT, ~0.2 ms)
//                                     └─ no  → SELECT from PostgreSQL → save copy for 5 min → answer (MISS)
//
// Every copy has an expiry (TTL), so stale data fixes itself. When we change data
// ourselves, we delete the copy straight away (invalidate).

import { valkey, valkeyReady } from "./client.js";

export type Cached<T> = { value: T; hit: boolean };

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<Cached<T>> {
  if (valkeyReady()) {
    try {
      const hit = await valkey.get(key);
      if (hit !== null) return { value: JSON.parse(hit) as T, hit: true };
    } catch {
      // Valkey hiccup: just load from the database
    }
  }

  const value = await load();
  if (valkeyReady()) {
    // EX = expire after N seconds. Not awaited: the visitor shouldn't wait for the cache write.
    valkey.set(key, JSON.stringify(value), "EX", ttlSeconds).catch(() => {});
  }
  return { value, hit: false };
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (!valkeyReady() || keys.length === 0) return;
  await valkey.del(...keys).catch(() => {});
}
