// Small pure functions: no React, no browser. Easy to test (see tests/focus-logic.test.ts).

import type { DaySummary, Mode } from "@/lib/api/sessions";

export const MODES: Record<Mode, { label: string; short: string; minutes: number }> = {
  focus: { label: "Focus", short: "Focus", minutes: 25 },
  short: { label: "Short break", short: "Break", minutes: 5 },
  long: { label: "Long break", short: "Long", minutes: 15 },
};

export const MODE_OPTIONS = (Object.keys(MODES) as Mode[]).map((value) => ({ value, label: MODES[value].short }));

export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// Days in a row with at least one focus session, counting back from today.
// If today has none yet, the streak from yesterday still counts (you have until midnight).
export function streak(days: DaySummary[]): number {
  let count = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].sessions > 0) count++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return count;
}

export function weekdayLabel(isoDate: string): string {
  // Noon avoids time-zone edge cases turning the date into the previous day.
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en", { weekday: "short" });
}
