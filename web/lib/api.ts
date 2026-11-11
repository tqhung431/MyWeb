// Talking to the Stage 3 API.
//
// Two callers, two addresses:
// - Server Components run on the Next.js server and use API_URL.
// - Browser code can only see variables starting with NEXT_PUBLIC_.
// On your PC both are http://localhost:4000. In Stage 7 (Docker) they will differ.

const SERVER_API = process.env.API_URL ?? "http://localhost:4000";
const BROWSER_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ---- Tips (called from Server Components) -----------------------------------

export type TipSummary = { slug: string; title: string; summary: string; minutes: number };
export type Tip = TipSummary & { body: string[] };

export async function getTips(): Promise<TipSummary[]> {
  // no-store: ask the API on every request, so new tips in the database show up at once
  const res = await fetch(`${SERVER_API}/api/tips`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API answered ${res.status}`);
  return res.json();
}

export async function getTip(slug: string): Promise<Tip | null> {
  const res = await fetch(`${SERVER_API}/api/tips/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API answered ${res.status}`);
  return res.json();
}

// ---- Focus sessions (called from the browser) -------------------------------

export type Mode = "focus" | "short" | "long";
export type DaySummary = { date: string; sessions: number; minutes: number };
export type Summary = { timeZone: string; today: DaySummary; days: DaySummary[]; total: number };

// A random id for this browser, kept in localStorage. Stage 4 replaces it with a real login.
function clientId(): string {
  const KEY = "clientId";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: anonymous for this visit only
  }
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json", "X-Client-Id": clientId() };
}

export async function saveSession(mode: Mode, minutes: number): Promise<void> {
  const res = await fetch(`${BROWSER_API}/api/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ mode, minutes }),
  });
  if (!res.ok) throw new Error(`API answered ${res.status}`);
}

export async function getSummary(days = 7): Promise<Summary> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Ho_Chi_Minh"
  const res = await fetch(`${BROWSER_API}/api/sessions/summary?tz=${encodeURIComponent(tz)}&days=${days}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`API answered ${res.status}`);
  return res.json();
}
