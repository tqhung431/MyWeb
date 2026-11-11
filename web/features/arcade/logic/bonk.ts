// Bonk-a-Blob: what pops out of a hole, and what bonking it is worth.

export type Popper = "blob" | "star" | "cat";
export const BLOBS = ["😜", "🤪", "😝", "🥴", "😛"];
export const ROUND_MS = 30_000;
export const HOLES = 9;

export function pick(random = Math.random): Popper {
  const r = random();
  if (r < 0.12) return "star";
  if (r < 0.3) return "cat";
  return "blob";
}

export function points(kind: Popper, combo: number): number {
  if (kind === "cat") return -20;
  const base = kind === "star" ? 30 : 10;
  return base + Math.min(combo, 10) * 2; // +2 for each hit in a row, up to +20
}

// They stay up less as the round goes on: 1.1 s at the start, 0.55 s at the end.
export function upTime(elapsedMs: number): number {
  return Math.round(1100 - (550 * Math.min(elapsedMs, ROUND_MS)) / ROUND_MS);
}
