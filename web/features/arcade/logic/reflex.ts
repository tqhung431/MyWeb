import { tx } from "@/lib/i18n/core";
// Too Early!: how fast you are, in animal terms.

export const ROUNDS = 5;

export function average(times: number[]): number {
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

export function animalFor(ms: number): { emoji: string; label: string } {
  if (ms < 200) return { emoji: "🐆", label: tx("Cheetah reflexes") };
  if (ms < 250) return { emoji: "🐈", label: tx("Cat-quick") };
  if (ms < 300) return { emoji: "🐕", label: tx("Good dog") };
  if (ms < 400) return { emoji: "🧑", label: tx("A perfectly normal human") };
  if (ms < 550) return { emoji: "🐢", label: tx("Turtle mode") };
  return { emoji: "🦥", label: tx("Sloth (relaxed, at least)") };
}

// The wait before green: random, so you can't count it.
export function waitMs(random = Math.random): number {
  return 1500 + Math.floor(random() * 2500);
}

export const WAITING_LINES = [tx("Wait for it…"), tx("Not yet…"), tx("Patience, grasshopper…"), tx("Steady…"), tx("Hold it…"), tx("Don't you dare…")];
export const EARLY_LINES = [tx("Too early! 🐔 Bawk bawk!"), tx("Whoa, eager! 🐔"), tx("The chicken saw that. 🐔"), tx("Nope, not green! 🐔")];
