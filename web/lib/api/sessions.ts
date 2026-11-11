// Focus sessions. Called from the browser only (needs the browser's client id).

import { apiFetch } from "./client";
import { clientId } from "./clientId";

export type Mode = "focus" | "short" | "long";
export type DaySummary = { date: string; sessions: number; minutes: number };
export type Summary = { timeZone: string; today: DaySummary; days: DaySummary[]; total: number };

export function saveSession(mode: Mode, minutes: number): Promise<unknown> {
  return apiFetch("/api/sessions", {
    method: "POST",
    headers: { "X-Client-Id": clientId() },
    body: JSON.stringify({ mode, minutes }),
  });
}

export function getSummary(days = 7): Promise<Summary> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g. "Asia/Ho_Chi_Minh"
  return apiFetch<Summary>(`/api/sessions/summary?tz=${encodeURIComponent(tz)}&days=${days}`, {
    headers: { "X-Client-Id": clientId() },
  });
}
