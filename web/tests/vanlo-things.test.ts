// Stage 18: things on the floor of a secret realm: urns and crates, shrines, the wandering merchant, decorations.
import { describe, expect, it } from "vitest";
import { DIRS, isFloor, same, type Pos } from "@/features/games/van-lo/engine/grid";
import { distances } from "@/features/games/van-lo/engine/path";
import { makeRng } from "@/features/games/van-lo/engine/rng";
import { newGame, stats } from "@/features/games/van-lo/logic/player";
import { makeEnemy, makeFloor } from "@/features/games/van-lo/logic/realm";
import { BLOCKING, type Game, type Thing } from "@/features/games/van-lo/logic/types";
import { act, purse, startRun } from "@/features/games/van-lo/logic/world";

// A run with nothing on the floor, and a free tile next to you
function emptyRun(seed = 21) {
  const g = newGame("Mai", seed);
  startRun(g);
  const r = g.run!;
  r.floor.enemies = [];
  r.floor.things = [];
  const dir = DIRS.find((d) => isFloor(r.floor, r.pos.x + d.x, r.pos.y + d.y) && isFloor(r.floor, r.pos.x + 2 * d.x, r.pos.y + 2 * d.y))!;
  const next: Pos = { x: r.pos.x + dir.x, y: r.pos.y + dir.y };
  return { g, r, dir, next };
}
const put = (g: Game, t: Omit<Thing, "uid">) => {
  const thing = { uid: `t${g.run!.floor.things.length}`, ...t } as Thing;
  g.run!.floor.things.push(thing);
  return thing;
};

describe("floors have more things on them", () => {
  it.each([1, 2, 3, 4, 5, 6])("urns, decorations and maybe a merchant, and the goal can still be reached (seed %i)", (seed) => {
    const g = newGame("Test", seed);
    let merchants = 0;
    for (const depth of [1, 2, 3, 4]) {
      const { floor, start } = makeFloor(g, makeRng(seed * 13 + depth), "vu-an-coc", depth);
      const pots = floor.things.filter((t) => t.kind === "urn" || t.kind === "crate");
      expect(pots.length).toBeGreaterThanOrEqual(1);
      expect(floor.things.filter((t) => t.kind === "deco").length).toBeGreaterThan(4);
      merchants += floor.things.filter((t) => t.kind === "merchant").length;
      // No two things share a tile, nothing on the start
      const spots = floor.things.map((t) => `${t.pos.x},${t.pos.y}`);
      expect(new Set(spots).size).toBe(spots.length);
      expect(floor.things.some((t) => same(t.pos, start))).toBe(false);
      // The stairs can be reached even if the merchant never moves (urns and crates can be smashed)
      const merchant = floor.things.find((t) => t.kind === "merchant");
      const blocked = (p: Pos) => !!merchant && same(p, merchant.pos);
      const goal = floor.things.find((t) => t.kind === "stairs")?.pos;
      if (goal) {
        const tiles = floor.tiles.split("");
        if (merchant) tiles[merchant.pos.y * floor.w + merchant.pos.x] = "#";
        const reach = distances({ ...floor, tiles: tiles.join("") }, start);
        expect(reach.has(goal.y * floor.w + goal.x)).toBe(true);
        expect(blocked(goal)).toBe(false);
      }
    }
    expect(merchants).toBeLessThanOrEqual(4);
  });
});

describe("urns and crates", () => {
  it("walking into one smashes it: a turn passes, you don't move, maybe there's loot", () => {
    let found = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { g, r, dir, next } = emptyRun(seed);
      put(g, { kind: "urn", pos: next });
      const from = { ...r.pos };
      const turn = r.turn;
      const before = r.loot.stones + Object.values(r.loot.bag).reduce((a, b) => a + (b ?? 0), 0);
      const res = act(g, { type: "move", dir });
      expect(res.ok).toBe(true);
      expect(res.fx.some((f) => f.type === "break")).toBe(true);
      expect(r.pos).toEqual(from);
      expect(r.turn).toBe(turn + 1);
      expect(r.floor.things.some((t) => t.kind === "urn")).toBe(false);
      if (r.loot.stones + Object.values(r.loot.bag).reduce((a, b) => a + (b ?? 0), 0) > before) found++;
    }
    expect(found).toBeGreaterThan(8); // most of them have something inside
  });

  it("enemies can't walk through them", () => {
    const { g, r, dir, next } = emptyRun();
    put(g, { kind: "crate", pos: next });
    const foe = makeEnemy(g, "hung", 1, { x: r.pos.x + 2 * dir.x, y: r.pos.y + 2 * dir.y });
    foe.awake = true;
    r.floor.enemies.push(foe);
    act(g, { type: "wait" });
    expect(same(foe.pos, next)).toBe(false);
    expect(BLOCKING).toContain("crate");
  });
});

describe("shrines", () => {
  it("praying once gives a blessing; the shrine then goes quiet", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const { g, r, dir, next } = emptyRun(seed);
      const shrine = put(g, { kind: "shrine", pos: next });
      const stones = r.loot.stones;
      const res = act(g, { type: "move", dir });
      expect(res.fx.some((f) => f.type === "bless")).toBe(true);
      expect(shrine.used).toBe(true);
      const bless = r.status.find((s) => s.kind === "bless-atk" || s.kind === "bless-def" || s.kind === "regen");
      kinds.add(bless?.kind ?? (r.loot.stones > stones ? "stones" : "none"));
      // Step off and back on: nothing more
      const n = r.status.length;
      act(g, { type: "move", dir: { x: -dir.x, y: -dir.y } });
      const again = act(g, { type: "move", dir });
      expect(again.fx.some((f) => f.type === "bless")).toBe(false);
      expect(r.status.length).toBeLessThanOrEqual(n);
    }
    expect(kinds.has("none")).toBe(false);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it("the regen blessing heals you each turn", () => {
    const { g, r } = emptyRun();
    const max = stats(g.player).hp;
    g.player.hp = Math.round(max / 2);
    r.status.push({ kind: "regen", turns: 10, value: 3 });
    act(g, { type: "wait" });
    act(g, { type: "wait" });
    expect(g.player.hp).toBeGreaterThan(Math.round(max / 2));
  });
});

describe("the wandering merchant", () => {
  it("bumping opens the shop; buying takes stones (trip first) and gives the item, without using a turn", () => {
    const { g, r, dir, next } = emptyRun();
    const m = put(g, { kind: "merchant", pos: next, offers: [{ id: "hoi-xuan", price: 40 }] });
    const res = act(g, { type: "move", dir });
    expect(res.ok).toBe(false);
    expect(res.shop).toBe(m.uid);

    g.player.stones = 30;
    r.loot.stones = 20;
    expect(purse(g)).toBe(50);
    const turn = r.turn;
    const bought = act(g, { type: "buy", uid: m.uid, index: 0 });
    expect(bought.ok).toBe(true);
    expect(r.turn).toBe(turn);
    expect(r.loot.stones).toBe(0);
    expect(g.player.stones).toBe(10);
    expect(r.loot.bag["hoi-xuan"]).toBe(1);
    expect(m.offers![0].sold).toBe(true);
    expect(act(g, { type: "buy", uid: m.uid, index: 0 }).ok).toBe(false); // sold out
  });

  it("you can't buy what you can't afford, or from across the room", () => {
    const { g, r, next } = emptyRun();
    const m = put(g, { kind: "merchant", pos: next, offers: [{ id: "hoi-linh", price: 999 }] });
    g.player.stones = 10;
    r.loot.stones = 0;
    expect(act(g, { type: "buy", uid: m.uid, index: 0 }).reason).toBe("not enough stones");
    g.player.stones = 5000;
    m.pos = { x: r.pos.x + 5, y: r.pos.y };
    expect(act(g, { type: "buy", uid: m.uid, index: 0 }).reason).toBe("too far");
  });
});
