// A random id for this browser (a "guest"), kept in localStorage.
// Each PC or browser is its own guest. Signing in moves the guest's history into the account.

const KEY = "clientId";
let memoryId: string | null = null; // used when storage is blocked

// crypto.randomUUID() only exists on "secure" pages: https:// or http://localhost.
// Other PCs open Nook as http://192.168.x.x:3000, which browsers treat as NOT secure,
// so we build the UUID ourselves from crypto.getRandomValues(), which works everywhere.
export function randomUUID(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function clientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= randomUUID();
    return memoryId;
  }
}
