// The Mini Arcade's games (Stage 10): what the lobby, the game page and the leaderboards show.
// The API has the same list with the score limits (api/src/arcade/games.ts).

import type { GameId } from "@/lib/api/arcade";

export type GameInfo = {
  id: GameId;
  name: string;
  emoji: string;
  tagline: string;
  howTo: string[]; // shown next to the game
  accent: string; // Tailwind gradient for the card
  better: "higher" | "lower";
  unit: string;
};

export const GAMES: GameInfo[] = [
  {
    id: "worm",
    name: "Hungry Worm",
    emoji: "🐛",
    tagline: "Eat everything. Don't bite yourself.",
    howTo: [
      "Steer with the arrow keys, WASD, a swipe, or the buttons under the board.",
      "Every snack makes you longer and a little faster. Chillies are extra spicy: double points.",
      "Hit a wall or your own tail and it's over.",
    ],
    accent: "from-lime-400 to-emerald-500",
    better: "higher",
    unit: "pts",
  },
  {
    id: "pairs",
    name: "Silly Pairs",
    emoji: "🦆",
    tagline: "Find the 8 pairs of very silly animals.",
    howTo: ["Flip two cards. Same animal? They stay open.", "Find all 8 pairs in as few moves as you can.", "Fewer moves is better."],
    accent: "from-sky-400 to-indigo-500",
    better: "lower",
    unit: "moves",
  },
  {
    id: "bonk",
    name: "Bonk-a-Blob",
    emoji: "🤪",
    tagline: "Bonk the blobs. Never bonk the cat.",
    howTo: [
      "Blobs pop out of the holes: tap them before they hide (+10).",
      "A golden star blob is worth +30. Bonking the cat costs 20.",
      "Hit several in a row for a combo bonus. You have 30 seconds.",
    ],
    accent: "from-fuchsia-400 to-pink-500",
    better: "higher",
    unit: "pts",
  },
  {
    id: "pancakes",
    name: "Pancake Tower",
    emoji: "🥞",
    tagline: "Stack them high. Wobbly is fine.",
    howTo: [
      "A pancake slides above the stack: tap, click or press Space to drop it.",
      "The part that hangs over the edge falls off, so the next one is smaller.",
      "A perfect drop makes the pancake grow back a little.",
    ],
    accent: "from-amber-300 to-orange-500",
    better: "higher",
    unit: "pancakes",
  },
  {
    id: "reflex",
    name: "Too Early!",
    emoji: "🐢",
    tagline: "Wait for green… wait for it…",
    howTo: [
      "Tap (or press Space) the moment the screen turns green.",
      "Tap too early and the chicken laughs at you: that round starts again.",
      "Your score is your average over 5 rounds. Lower is faster.",
    ],
    accent: "from-rose-400 to-red-500",
    better: "lower",
    unit: "ms",
  },
  {
    id: "odd",
    name: "Odd Emoji Out",
    emoji: "🙃",
    tagline: "One of these is not like the others.",
    howTo: [
      "Tap the one emoji that's different. The grid grows as you go.",
      "A wrong tap costs 3 seconds. You have 60 seconds.",
      "Each one you find is 1 point.",
    ],
    accent: "from-violet-400 to-purple-600",
    better: "higher",
    unit: "pts",
  },
];

export function getGame(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}

export function formatScore(game: GameInfo, score: number): string {
  return `${score.toLocaleString("en")} ${game.unit}`;
}
