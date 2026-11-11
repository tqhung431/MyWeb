// Silly Pairs: 8 animals, each twice, shuffled.

export const ANIMALS = [
  { emoji: "🐸", says: "Ribbit!" },
  { emoji: "🦆", says: "Quack!" },
  { emoji: "🐙", says: "Blub blub" },
  { emoji: "🦥", says: "…zzz…" },
  { emoji: "🐧", says: "Waddle!" },
  { emoji: "🦄", says: "Sparkle!" },
  { emoji: "🐌", says: "Slooow" },
  { emoji: "🦖", says: "RAWR!" },
  { emoji: "🐷", says: "Oink!" },
  { emoji: "🐔", says: "Bawk!" },
  { emoji: "🦉", says: "Hoo?" },
  { emoji: "🐳", says: "Splash!" },
];

export type Card = { id: number; animal: number };

export function newDeck(pairs = 8, random = Math.random): Card[] {
  // pick `pairs` different animals, then put each in twice
  const picked = shuffle([...ANIMALS.keys()], random).slice(0, pairs);
  const cards = shuffle([...picked, ...picked], random);
  return cards.map((animal, id) => ({ id, animal }));
}

export function shuffle<T>(list: T[], random = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isMatch(deck: Card[], a: number, b: number): boolean {
  return a !== b && deck[a].animal === deck[b].animal;
}
