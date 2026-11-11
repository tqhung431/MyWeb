// Too Early!: how fast you are, in animal terms.

export const ROUNDS = 5;

export function average(times: number[]): number {
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

export function animalFor(ms: number): { emoji: string; label: string } {
  if (ms < 200) return { emoji: "🐆", label: "Cheetah reflexes" };
  if (ms < 250) return { emoji: "🐈", label: "Cat-quick" };
  if (ms < 300) return { emoji: "🐕", label: "Good dog" };
  if (ms < 400) return { emoji: "🧑", label: "A perfectly normal human" };
  if (ms < 550) return { emoji: "🐢", label: "Turtle mode" };
  return { emoji: "🦥", label: "Sloth (relaxed, at least)" };
}

// The wait before green: random, so you can't count it.
export function waitMs(random = Math.random): number {
  return 1500 + Math.floor(random() * 2500);
}

export const WAITING_LINES = ["Wait for it…", "Not yet…", "Patience, grasshopper…", "Steady…", "Hold it…", "Don't you dare…"];
export const EARLY_LINES = ["Too early! 🐔 Bawk bawk!", "Whoa, eager! 🐔", "The chicken saw that. 🐔", "Nope, not green! 🐔"];
