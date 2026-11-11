// Stage 10: the Mini Arcade's game rules (no drawing, no timers).
import { describe, expect, it } from "vitest";
import { GAMES } from "@/features/arcade/games";
import { pick, points, upTime } from "@/features/arcade/logic/bonk";
import { gridSize, newRound } from "@/features/arcade/logic/odd";
import { isMatch, newDeck } from "@/features/arcade/logic/pairs";
import { land } from "@/features/arcade/logic/pancakes";
import { animalFor, average } from "@/features/arcade/logic/reflex";
import { newGame, step, tickMs, turn, type WormState } from "@/features/arcade/logic/worm";

// A "random" that always returns the same numbers, so tests don't change from run to run
const fixed = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("Hungry Worm", () => {
  const game = (patch: Partial<WormState>): WormState => ({ ...newGame(8, fixed(0)), ...patch });

  it("moves one cell per step", () => {
    const g = game({ worm: [{ x: 3, y: 3 }, { x: 2, y: 3 }], dir: "right", snack: { x: 0, y: 0, emoji: "🍎", spicy: false } });
    expect(step(g).worm).toEqual([{ x: 4, y: 3 }, { x: 3, y: 3 }]);
  });

  it("grows and scores when it eats; chillies are worth double", () => {
    const g = game({ worm: [{ x: 3, y: 3 }, { x: 2, y: 3 }], dir: "right", snack: { x: 4, y: 3, emoji: "🍎", spicy: false } });
    const after = step(g, fixed(0.5));
    expect(after.worm).toHaveLength(3);
    expect(after).toMatchObject({ score: 10, eaten: 1 });
    const spicy = step({ ...g, snack: { x: 4, y: 3, emoji: "🌶️", spicy: true } }, fixed(0.5));
    expect(spicy.score).toBe(20);
  });

  it("dies at the wall and when it bites itself", () => {
    expect(step(game({ worm: [{ x: 7, y: 1 }], dir: "right" })).alive).toBe(false);
    const loop = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }];
    expect(step(game({ worm: loop, dir: "down", snack: { x: 0, y: 0, emoji: "🍎", spicy: false } })).alive).toBe(false);
  });

  it("can't turn straight back, and speeds up as it eats", () => {
    expect(turn("right", "left")).toBe("right");
    expect(turn("right", "up")).toBe("up");
    expect(tickMs(0)).toBeGreaterThan(tickMs(10));
    expect(tickMs(1000)).toBe(65);
  });

  it("never puts a snack on the worm", () => {
    const g = newGame(4, fixed(0));
    for (const c of g.worm) expect(c.x === g.snack.x && c.y === g.snack.y).toBe(false);
  });
});

describe("Silly Pairs", () => {
  it("deals 8 pairs: every animal exactly twice", () => {
    const deck = newDeck(8, fixed(0.1, 0.7, 0.4));
    expect(deck).toHaveLength(16);
    const counts = new Map<number, number>();
    for (const c of deck) counts.set(c.animal, (counts.get(c.animal) ?? 0) + 1);
    expect([...counts.values()]).toEqual(Array(8).fill(2));
  });

  it("matches only two different cards with the same animal", () => {
    const deck = [
      { id: 0, animal: 1 },
      { id: 1, animal: 1 },
      { id: 2, animal: 2 },
    ];
    expect(isMatch(deck, 0, 1)).toBe(true);
    expect(isMatch(deck, 0, 0)).toBe(false);
    expect(isMatch(deck, 0, 2)).toBe(false);
  });
});

describe("Pancake Tower", () => {
  const below = { x: 100, w: 200 };
  it("cuts off the part hanging over the edge", () => {
    expect(land(below, { x: 150, w: 200 }, 200)).toEqual({ slab: { x: 150, w: 150 }, perfect: false, cut: { x: 300, w: 50 } });
    expect(land(below, { x: 40, w: 200 }, 200)).toEqual({ slab: { x: 100, w: 140 }, perfect: false, cut: { x: 40, w: 60 } });
  });
  it("a perfect drop grows back a little, never wider than the first", () => {
    expect(land({ x: 100, w: 100 }, { x: 103, w: 100 }, 200)).toMatchObject({ perfect: true, slab: { x: 97, w: 106 } });
    expect(land(below, { x: 102, w: 200 }, 200)).toMatchObject({ perfect: true, slab: { x: 100, w: 200 } });
  });
  it("misses completely", () => {
    expect(land(below, { x: 320, w: 100 }, 200)).toBeNull();
  });
});

describe("Too Early!", () => {
  it("averages and names your speed", () => {
    expect(average([200, 300, 250])).toBe(250);
    expect(animalFor(180).emoji).toBe("🐆");
    expect(animalFor(700).emoji).toBe("🦥");
  });
});

describe("Odd Emoji Out", () => {
  it("grows the grid from 2×2 to at most 7×7", () => {
    expect(gridSize(0)).toBe(2);
    expect(gridSize(2)).toBe(3);
    expect(gridSize(500)).toBe(7);
  });
  it("puts the odd one inside the grid, different from the rest", () => {
    for (let level = 0; level < 20; level++) {
      const r = newRound(level, fixed(0.99, 0.2, 0.99));
      expect(r.oddIndex).toBeLessThan(r.size * r.size);
      expect(r.odd).not.toBe(r.common);
    }
  });
});

describe("Bonk-a-Blob", () => {
  it("scores blobs, stars and the cat, with a combo bonus", () => {
    expect(points("blob", 0)).toBe(10);
    expect(points("star", 0)).toBe(30);
    expect(points("blob", 3)).toBe(16);
    expect(points("blob", 50)).toBe(30); // the bonus stops at +20
    expect(points("cat", 5)).toBe(-20);
  });
  it("pops things up for less time as the round goes on", () => {
    expect(upTime(0)).toBeGreaterThan(upTime(29_000));
    expect(pick(fixed(0.05))).toBe("star");
    expect(pick(fixed(0.2))).toBe("cat");
    expect(pick(fixed(0.9))).toBe("blob");
  });
});

it("lists 6 games with different ids", () => {
  expect(new Set(GAMES.map((g) => g.id)).size).toBe(6);
});
