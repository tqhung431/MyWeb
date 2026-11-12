// The Mini Arcade's games (Stage 10): what the lobby, the game page and the leaderboards show.
// The API has the same list with the score limits (api/src/arcade/games.ts).

import type { GameId } from "@/lib/api/arcade";

import { currentLang, LOCALE, tNow, tx } from "@/lib/i18n/core";
// Stage 21: texts in tx() (translated where shown); formatScore uses the page's language.
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
    name: tx("Hungry Worm"),
    emoji: "🐛",
    tagline: tx("Eat everything. Don't bite yourself."),
    howTo: [
      tx(tx("Steer with the arrow keys, WASD, a swipe, or the buttons under the board.")),
      tx(tx("Every snack makes you longer and a little faster. Chillies are extra spicy: double points.")),
      tx(tx("Hit a wall or your own tail and it's over.")),
    ],
    accent: "from-lime-400 to-emerald-500",
    better: "higher",
    unit: tx("pts"),
  },
  {
    id: "pairs",
    name: tx("Silly Pairs"),
    emoji: "🦆",
    tagline: tx("Find the 8 pairs of very silly animals."),
    howTo: [tx("Flip two cards. Same animal? They stay open."), tx("Find all 8 pairs in as few moves as you can."), tx("Fewer moves is better.")],
    accent: "from-sky-400 to-indigo-500",
    better: "lower",
    unit: tx("moves"),
  },
  {
    id: "bonk",
    name: tx("Bonk-a-Blob"),
    emoji: "🤪",
    tagline: tx("Bonk the blobs. Never bonk the cat."),
    howTo: [
      tx(tx("Blobs pop out of the holes: tap them before they hide (+10).")),
      tx(tx("A golden star blob is worth +30. Bonking the cat costs 20.")),
      tx(tx("Hit several in a row for a combo bonus. You have 30 seconds.")),
    ],
    accent: "from-fuchsia-400 to-pink-500",
    better: "higher",
    unit: tx("pts"),
  },
  {
    id: "pancakes",
    name: tx("Pancake Tower"),
    emoji: "🥞",
    tagline: tx("Stack them high. Wobbly is fine."),
    howTo: [
      tx(tx("A pancake slides above the stack: tap, click or press Space to drop it.")),
      tx(tx("The part that hangs over the edge falls off, so the next one is smaller.")),
      tx(tx("A perfect drop makes the pancake grow back a little.")),
    ],
    accent: "from-amber-300 to-orange-500",
    better: "higher",
    unit: tx("pancakes"),
  },
  {
    id: "reflex",
    name: tx("Too Early!"),
    emoji: "🐢",
    tagline: tx("Wait for green… wait for it…"),
    howTo: [
      tx(tx("Tap (or press Space) the moment the screen turns green.")),
      tx(tx("Tap too early and the chicken laughs at you: that round starts again.")),
      tx(tx("Your score is your average over 5 rounds. Lower is faster.")),
    ],
    accent: "from-rose-400 to-red-500",
    better: "lower",
    unit: tx("ms"),
  },
  {
    id: "odd",
    name: tx("Odd Emoji Out"),
    emoji: "🙃",
    tagline: tx("One of these is not like the others."),
    howTo: [
      tx(tx("Tap the one emoji that's different. The grid grows as you go.")),
      tx(tx("A wrong tap costs 3 seconds. You have 60 seconds.")),
      tx(tx("Each one you find is 1 point.")),
    ],
    accent: "from-violet-400 to-purple-600",
    better: "higher",
    unit: tx("pts"),
  },
];

export function getGame(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}

export function formatScore(game: GameInfo, score: number): string {
  return `${score.toLocaleString(LOCALE[currentLang()])} ${tNow(game.unit)}`;
}
