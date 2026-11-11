// Stage 13: changes made without a connection wait on this device and are sent later.
//
// sendOrKeep() tries the request. If the network is down (not "the API said no"), it keeps the request
// in localStorage and answers "kept". flush() sends what's waiting, oldest first; the OfflineSync
// component calls it when the browser is back online, when the page is opened, and every 30 s.
// Requests with the same key replace each other: ticking a habit on, off and on offline sends one request.

import { ApiError, apiFetch } from "./api/client";

type Kept = { key: string; path: string; method: string; body?: string; headers?: Record<string, string>; at: number };
const STORE = "nook.offline";
const listeners = new Set<(n: number) => void>();

function read(): Kept[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]") as Kept[];
  } catch {
    return [];
  }
}
function write(list: Kept[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    // storage full or blocked: nothing we can do
  }
  listeners.forEach((l) => l(list.length));
}

export function waitingCount(): number {
  return read().length;
}
export function onWaitingChange(listener: (n: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const isNetworkError = (e: unknown) => !(e instanceof ApiError) || e.status === 0; // fetch failed / timed out

export async function sendOrKeep<T>(
  key: string,
  path: string,
  init: { method: string; body?: unknown; headers?: Record<string, string> },
): Promise<{ sent: true; value: T } | { sent: false }> {
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  try {
    const value = await apiFetch<T>(path, { method: init.method, body, headers: init.headers });
    return { sent: true, value };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    write([...read().filter((k) => k.key !== key), { key, path, method: init.method, body, headers: init.headers, at: Date.now() }]);
    return { sent: false };
  }
}

let flushing: Promise<number> | null = null;

// Returns how many were sent. A request the API refuses (e.g. a deleted habit) is dropped, not retried forever.
// Only one flush runs at a time; calling it again meanwhile returns the same promise.
export function flush(): Promise<number> {
  // (.finally runs after the assignment, even when there's nothing to send. Clearing the flag inside the
  // async function itself would happen BEFORE the assignment in that case, and leave it stuck "busy".)
  flushing ??= send().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function send(): Promise<number> {
  let sent = 0;
  for (const k of read()) {
    try {
      await apiFetch(k.path, { method: k.method, body: k.body, headers: k.headers });
      sent++;
    } catch (e) {
      if (isNetworkError(e)) break; // still offline: try again later
    }
    write(read().filter((x) => !(x.key === k.key && x.at === k.at)));
  }
  return sent;
}
