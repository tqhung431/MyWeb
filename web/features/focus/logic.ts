// Small pure functions: no React, no browser. Easy to test (see tests/focus-logic.test.ts).

import type { DaySummary, Mode } from "@/lib/api/sessions";

export const MODES: Record<Mode, { label: string; short: string }> = {
  focus: { label: "Focus", short: "Focus" },
  short: { label: "Short break", short: "Break" },
  long: { label: "Long break", short: "Long" },
};

// Stage 7: you choose how long each mode lasts.
export type Durations = Record<Mode, number>; // minutes

export const DEFAULT_DURATIONS: Durations = { focus: 25, short: 5, long: 15 };

// The same limits the API checks (api/src/routes/me.ts)
export const LIMITS: Record<Mode, { min: number; max: number }> = {
  focus: { min: 1, max: 120 },
  short: { min: 1, max: 60 },
  long: { min: 1, max: 60 },
};

export const PRESETS: { name: string; hint: string; durations: Durations }[] = [
  { name: "Classic", hint: "Pomodoro", durations: { focus: 25, short: 5, long: 15 } },
  { name: "Quick", hint: "For tired days", durations: { focus: 15, short: 3, long: 10 } },
  { name: "Deep", hint: "Longer stretches", durations: { focus: 50, short: 10, long: 30 } },
  { name: "Flow", hint: "90-minute cycles", durations: { focus: 90, short: 20, long: 30 } },
];

// Whole minutes inside the limits; anything odd (text, NaN) falls back to the default.
export function cleanDurations(input: Partial<Record<Mode, unknown>> | null | undefined): Durations {
  const out = { ...DEFAULT_DURATIONS };
  for (const mode of Object.keys(LIMITS) as Mode[]) {
    const n = Math.round(Number(input?.[mode]));
    if (Number.isFinite(n)) out[mode] = Math.min(LIMITS[mode].max, Math.max(LIMITS[mode].min, n));
  }
  return out;
}

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
