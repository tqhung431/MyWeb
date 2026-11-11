// A seeded random number generator (mulberry32). Same seed → same numbers, every time.
// The game keeps the generator's state in the save, so a loaded game continues exactly
// where it was, and tests can replay a whole run.

export type Rng = {
  next: () => number; // 0 ≤ n < 1
  int: (min: number, max: number) => number; // min ≤ n ≤ max
  pick: <T>(list: readonly T[]) => T;
  chance: (p: number) => boolean;
  state: () => number;
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    state: () => s,
  };
}

// A seed from a word ("frieren" → always the same world), or a random one
export function seedFrom(text?: string): number {
  if (!text) return Math.floor(Math.random() * 2 ** 32);
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return h >>> 0;
}
