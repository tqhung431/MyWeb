// Odd Emoji Out: a grid of the same emoji, with one that's slightly different.

export const PAIRS: [string, string][] = [
  ["🙂", "🙃"],
  ["😀", "😃"],
  ["😺", "😸"],
  ["🐶", "🐕"],
  ["🍏", "🍎"],
  ["🌑", "🌚"],
  ["😴", "😪"],
  ["🐻", "🐨"],
  ["🌕", "🌝"],
  ["😗", "😙"],
  ["🦊", "🐱"],
  ["🍋", "🍊"],
  ["⏰", "⏲️"],
  ["🐭", "🐹"],
  ["😐", "😑"],
  ["🐳", "🐋"],
  ["🌲", "🌳"],
  ["🐢", "🦎"],
];

export type Round = {
  size: number;
  common: string;
  odd: string;
  oddIndex: number;
};

// Level 0 → 2×2, then bigger every 2 finds, up to 7×7.
export function gridSize(level: number): number {
  return Math.min(7, 2 + Math.floor(level / 2));
}

export function newRound(level: number, random = Math.random): Round {
  const size = gridSize(level);
  const [a, b] = PAIRS[Math.floor(random() * PAIRS.length)];
  const flip = random() < 0.5;
  return {
    size,
    common: flip ? b : a,
    odd: flip ? a : b,
    oddIndex: Math.floor(random() * size * size),
  };
}

export const ROUND_SECONDS = 60;
export const WRONG_PENALTY_S = 3;
