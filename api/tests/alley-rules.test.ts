// Stage 23 · Ngõ Pháo: the rules with a fake clock (no network, no database).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as A from "../src/arena/alley.js";
import { H, W, walkFor } from "../src/arena/alley-move.js";

const seats = (n: number, bot = false): A.Seat[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: i, hat: 0, bot }));

/** A match on an empty alley (no crates), already playing at time 0 */
function emptyGame(n = 2) {
  const g = A.newAlleyMatch(seats(n), "old-town", 1, -A.T.countdown);
  g.tiles = A.MAPS["old-town"].join("").split("");
  A.stepAlley(g, 0, 0); // countdown over
  expect(g.phase).toBe("playing");
  return g;
}
const put = (g: A.AlleyGame, id: string, tx: number, ty: number) => Object.assign(g.players.find((p) => p.id === id)!, { x: tx + 0.5, y: ty + 0.5 });
/** Run the game from `from` to `to` in 50 ms steps */
function run(g: A.AlleyGame, from: number, to: number) {
  for (let t = from + 50; t <= to; t += 50) A.stepAlley(g, t, 50);
}

describe("the alley", () => {
  it("has three 13 × 11 maps where every floor tile can be reached and the corners are free", () => {
    for (const id of A.MAP_IDS) {
      const rows = A.MAPS[id];
      expect(rows).toHaveLength(H);
      for (const r of rows) expect(r).toHaveLength(W);
      // flood fill from the top-left corner
      const seen = new Set(["0,0"]);
      const todo = [[0, 0]];
      while (todo.length) {
        const [x, y] = todo.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || rows[ny][nx] !== "." || seen.has(`${nx},${ny}`)) continue;
          seen.add(`${nx},${ny}`);
          todo.push([nx, ny]);
        }
      }
      expect(seen.size, id).toBe(rows.join("").split("").filter((c) => c === ".").length);
      for (const [x, y] of [[0, 0], [12, 0], [0, 10], [12, 10]]) expect(rows[y][x]).toBe(".");
    }
  });

  it("scatters crates but keeps everyone's start corner clear", () => {
    const g = A.newAlleyMatch(seats(4), "market", 7, 0);
    const crates = g.tiles.filter((c) => c === "c").length;
    expect(crates).toBeGreaterThan(40);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [12, 10], [11, 10], [12, 9]]) expect(g.tiles[y * W + x]).toBe(".");
  });

  it("keeps the browser's copy of the walking code identical to the server's", () => {
    const api = readFileSync(path.join(import.meta.dirname, "../src/arena/alley-move.ts"), "utf8");
    const web = readFileSync(path.join(import.meta.dirname, "../../web/features/arena/alley/alley-move.ts"), "utf8");
    expect(web).toBe(api);
  });
});

describe("walking", () => {
  const world = { tiles: A.MAPS["old-town"].join(""), bombBlocks: () => false };
  it("stops at a wall and slides round a corner when slightly off-centre", () => {
    // From (0,1) going right: (1,1) is a wall, so we stop in the middle of our tile
    expect(walkFor(0.3, 1.5, 2, 2, world)).toMatchObject({ x: 0.5, y: 1.5, bumped: { tx: 1, ty: 1 } });
    // Slightly above the middle: slides up into row 0, where the way is open
    const r = walkFor(0.5, 1.4, 2, 0.05, world);
    expect(r.y).toBeLessThan(1.4);
    // Walking along an open row keeps you in its middle
    const along = walkFor(0.5, 0.6, 2, 1, world);
    expect(along).toMatchObject({ y: 0.5, bumped: null });
    expect(along.x).toBeCloseTo(1.5);
  });
  it("never leaves the alley", () => {
    expect(walkFor(0.5, 0.5, 4, 3, world).x).toBe(0.5);
    expect(walkFor(0.5, 0.5, 1, 3, world).y).toBe(0.5);
  });
});

describe("firecrackers", () => {
  it("pop after 2.5 s in a cross that stops at walls, breaks crates and knocks people out", () => {
    const g = emptyGame(3);
    put(g, "p0", 0, 0);
    put(g, "p1", 4, 0); // in line, 4 tiles away: out of reach (range 2)
    put(g, "p2", 2, 0); // in reach
    g.tiles[0 * W + 0] = ".";
    g.tiles[2 * W + 0] = "c"; // a crate two tiles below
    expect(A.drop(g, "p0", 0)).toBe(true);
    expect(A.drop(g, "p0", 0)).toBe(false); // one at a time to start with
    A.setDir(g, "p0", 3); // walk down to (0,1), out of the bomb's tile... still in the cross!
    run(g, 0, 2400);
    expect(g.bombs).toHaveLength(1);
    run(g, 2400, 2550);
    expect(g.bombs).toHaveLength(0);
    expect(g.tiles[2 * W + 0]).toBe("."); // crate gone
    const byId = Object.fromEntries(g.players.map((p) => [p.id, p]));
    expect(byId.p2.alive).toBe(false);
    expect(byId.p2.ghost).toBe(true);
    expect(byId.p1.alive).toBe(true);
    expect(byId.p0.alive).toBe(false); // tripped on own cracker
    expect(byId.p0.stats.selfOuts).toBe(1);
    expect(byId.p0.stats.outs).toBe(1);
    expect(byId.p0.stats.crates).toBe(1);
  });

  it("set each other off (a chain)", () => {
    const g = emptyGame(2);
    put(g, "p0", 0, 0);
    A.drop(g, "p0", 0);
    const p0 = g.players[0];
    p0.bombs = 2;
    put(g, "p0", 2, 0);
    A.drop(g, "p0", 1000); // would pop at 3500
    put(g, "p0", 6, 4);
    run(g, 0, 2550);
    expect(g.bombs).toHaveLength(0); // both went off at 2500
  });

  it("can't be walked back onto once you've left them", () => {
    const g = emptyGame(2);
    put(g, "p0", 2, 0);
    A.drop(g, "p0", 0);
    A.setDir(g, "p0", 2);
    run(g, 0, 600); // walked right, off the firecracker
    A.setDir(g, "p0", 4);
    run(g, 600, 1500);
    expect(g.players[0].x).toBeGreaterThanOrEqual(3.5); // blocked by its own firecracker
  });

  it("slide when kicked", () => {
    const g = emptyGame(2);
    put(g, "p1", 4, 0);
    A.drop(g, "p1", 0);
    put(g, "p1", 12, 10);
    put(g, "p0", 2, 0);
    g.players[0].kick = true;
    A.setDir(g, "p0", 2);
    run(g, 0, 1000);
    expect(g.bombs[0].tx).toBeGreaterThan(6);
  });

  it("a shield takes one hit", () => {
    const g = emptyGame(2);
    put(g, "p0", 0, 0);
    put(g, "p1", 1, 0);
    g.players[1].shield = true;
    A.drop(g, "p0", 0);
    put(g, "p0", 0, 4);
    run(g, 0, 3000);
    expect(g.players[1].alive).toBe(true);
    expect(g.players[1].shield).toBe(false);
  });
});

describe("ghosts, the lion and the lanterns", () => {
  it("a ghost's tiny cracker only stuns, and only every 10 s", () => {
    const g = emptyGame(3);
    const ghost = g.players[2];
    Object.assign(ghost, { alive: false, ghost: true, tinyReadyAt: 0 });
    put(g, "p2", 4, 0);
    put(g, "p0", 4, 0);
    put(g, "p1", 12, 10);
    expect(A.drop(g, "p2", 0)).toBe(true);
    expect(A.drop(g, "p2", 100)).toBe(false); // cooling down
    run(g, 0, 1600);
    expect(g.players[0].alive).toBe(true);
    expect(g.players[0].stunUntil).toBeGreaterThan(1500);
    expect(ghost.stats.teases).toBe(1);
  });

  it("after 90 s, lantern rings fill the alley from the edges and knock out whoever is there", () => {
    const g = emptyGame(2);
    g.lionAt = 0; // no lion in this test
    put(g, "p0", 0, 0); // edge: ring 0
    put(g, "p1", 6, 5); // the middle
    run(g, 0, 90_000);
    expect(g.rings).toBe(1);
    expect(g.tiles[0]).toBe("L");
    expect(g.players[0].alive).toBe(false);
    expect(g.phase).toBe("roundEnd");
    expect(g.roundWinner).toBe("p1");
    expect(g.players[1].score).toBe(1);
  });

  it("the lion dance pushes people out of its row", () => {
    const g = emptyGame(2);
    put(g, "p0", 6, 0);
    put(g, "p1", 12, 10);
    g.lionAt = 50;
    g.random = () => 0; // row 0, walking right
    run(g, 0, 3000);
    expect(Math.floor(g.players[0].y)).toBe(1); // pushed down to row 1
  });
});

describe("a whole match", () => {
  it("first to 3 round wins takes it, with awards", () => {
    const g = A.newAlleyMatch(seats(4, true), "rooftops", 3, 0);
    let t = 0;
    while (g.phase !== "matchEnd" && t < 1_800_000) {
      t += 50;
      A.stepAlley(g, t, 50);
    }
    expect(g.phase).toBe("matchEnd");
    const champ = g.players.find((p) => p.id === g.matchWinner)!;
    expect(champ.score).toBe(A.WINS_NEEDED);
    expect(A.awards(g).length).toBeGreaterThan(0);
    const view = A.alleyView(g, t);
    expect(view.matchWinner).toBe(champ.id);
    expect(view.tiles).toHaveLength(W * H);
  });

  it("bots don't throw rounds away: most rounds last over 30 s", () => {
    const lengths: number[] = [];
    for (const seed of [11, 12, 13]) {
      const g = A.newAlleyMatch(seats(4, true), "old-town", seed, 0);
      let t = 0;
      let round = 1;
      let start = A.T.countdown;
      while (g.phase !== "matchEnd" && t < 1_800_000) {
        t += 50;
        A.stepAlley(g, t, 50);
        if (g.phase === "roundEnd" && round === g.round) {
          lengths.push(t - start);
          round++;
        }
        if (g.phase === "playing" && g.playStartedAt > start) start = g.playStartedAt;
      }
    }
    const long = lengths.filter((ms) => ms > 30_000).length;
    expect(long / lengths.length).toBeGreaterThan(0.7);
  });
});
