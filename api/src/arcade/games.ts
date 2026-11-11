// Mini Arcade (Stage 10): the games the API accepts scores for, and what a good score is.
// The games themselves run in the browser (web/features/arcade); the API only keeps the high scores.
//
// The browser sends the score, so a determined person could send a fake one (open DevTools, POST 9999).
// The limits below stop silly numbers, not cheating. Real anti-cheat means the SERVER runs the game
// and only trusts the players' moves: that's what the planned Arcade Online does.

export type GameRule = {
  name: string;
  better: "higher" | "lower"; // e.g. points: higher; reaction time or moves: lower
  min: number;
  max: number;
  unit: string; // shown after the score, e.g. "pts", "ms"
};

export const GAMES = {
  worm: { name: "Hungry Worm", better: "higher", min: 0, max: 10_000, unit: "pts" },
  pairs: { name: "Silly Pairs", better: "lower", min: 8, max: 999, unit: "moves" },
  bonk: { name: "Bonk-a-Blob", better: "higher", min: 0, max: 5_000, unit: "pts" },
  pancakes: { name: "Pancake Tower", better: "higher", min: 0, max: 1_000, unit: "pancakes" },
  reflex: { name: "Too Early!", better: "lower", min: 80, max: 5_000, unit: "ms" },
  odd: { name: "Odd Emoji Out", better: "higher", min: 0, max: 1_000, unit: "pts" },
} as const satisfies Record<string, GameRule>;

export type GameId = keyof typeof GAMES;
export const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

export function isBetter(game: GameId, a: number, b: number | null): boolean {
  if (b === null) return true;
  return GAMES[game].better === "higher" ? a > b : a < b;
}
