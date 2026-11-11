// The queue rules (Stage 10), kept apart from React so tests can check them directly.
//
//   repeat "off"  → stop after the last song
//   repeat "all"  → after the last song, back to the first
//   repeat "one"  → the same song again when it ends (Next still moves on)
//   shuffle       → the queue is reordered at random, the song playing now stays first

export type Repeat = "off" | "all" | "one";
export const REPEATS: Repeat[] = ["off", "all", "one"];

export function nextRepeat(r: Repeat): Repeat {
  return REPEATS[(REPEATS.indexOf(r) + 1) % REPEATS.length];
}

// Which song comes after `index`? null = stop.
// auto = the song ended by itself (repeat "one" only applies then).
export function nextIndex(length: number, index: number, repeat: Repeat, auto: boolean): number | null {
  if (length === 0) return null;
  if (auto && repeat === "one") return index;
  if (index + 1 < length) return index + 1;
  return repeat === "off" ? null : 0;
}

export function previousIndex(length: number, index: number, repeat: Repeat): number | null {
  if (length === 0) return null;
  if (index > 0) return index - 1;
  return repeat === "off" ? null : length - 1;
}

// A random order (Fisher–Yates) with the song at `keep` moved to the front.
export function shuffled<T>(list: T[], keep: number, random: () => number = Math.random): T[] {
  const rest = list.filter((_, i) => i !== keep);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return keep >= 0 && keep < list.length ? [list[keep], ...rest] : rest;
}

// Remove one song; returns the new list and where the playing song now is (null = nothing left to play).
export function removeAt<T>(list: T[], index: number, remove: number): { list: T[]; index: number | null } {
  const next = list.filter((_, i) => i !== remove);
  if (next.length === 0) return { list: next, index: null };
  if (remove < index) return { list: next, index: index - 1 };
  if (remove > index) return { list: next, index };
  return { list: next, index: Math.min(index, next.length - 1) }; // removed the playing song: the next one plays
}

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
