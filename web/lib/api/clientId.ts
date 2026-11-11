// A random id for this browser, kept in localStorage.
// Stage 4 (login) replaces it with a real user account.

const KEY = "clientId";
let memoryId: string | null = null; // used when storage is blocked

export function clientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}
