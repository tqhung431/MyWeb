// Focus sessions. Called from the browser only (needs the browser's client id).

import { apiFetch } from "./client";
import { clientId } from "./clientId";
import { timeZone } from "./timezone";

export type Mode = "focus" | "short" | "long";
export type DaySummary = { date: string; sessions: number; minutes: number };
export type Summary = { timeZone: string; today: DaySummary; days: DaySummary[]; total: number };

export function saveSession(mode: Mode, minutes: number): Promise<unknown> {
  return apiFetch("/api/sessions", {
    method: "POST",
    headers: { "X-Client-Id": clientId(), "X-Time-Zone": timeZone() },
    body: JSON.stringify({ mode, minutes }),
  });
}

export function getSummary(days = 7): Promise<Summary> {
  const tz = timeZone();
  return apiFetch<Summary>(`/api/sessions/summary?tz=${encodeURIComponent(tz)}&days=${days}`, {
    headers: { "X-Client-Id": clientId() },
  });
}
