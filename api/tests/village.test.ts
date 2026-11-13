// Stage 24 · Giữ Làng: the tower-defense rules (no network, no database), and that the browser's copy matches.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as V from "../src/arena/village.js";

const me: V.Player = { id: "me", name: "Me", side: null };
const run = (g: V.VillageGame, ms: number) => {
  for (let t = 0; t < ms; t += 50) V.stepVillage(g, 50);
};
/** Skip the building time and play until the wave is over (or the game) */
const playWave = (g: V.VillageGame) => {
  V.act(g, "me", { a: "next" });
  let guard = 0;
  while (g.phase === "wave" && guard++ < 20_000) V.stepVillage(g, 50);
};
/** A test helper: put one spirit on the path */
function addSpirit(g: V.VillageGame, kind: V.SpiritKind, d = 0, pathIndex: 0 | 1 = 0) {
  const s = V.SPIRITS[kind];
  const [x, y] = V.pointAt(V.routeOf(g.map, pathIndex, s.flying), d);
  g.spirits.push({ id: g.nextId++, kind, path: pathIndex, d, hp: s.hp, maxHp: s.hp, stunUntil: 0, x, y });
  g.phase = "wave";
  g.queue = [{ at: 1e9, kind: "fox", path: 0 }]; // keep the wave open
}

describe("Giữ Làng", () => {
  it("keeps the browser's copy of the rules identical to the server's", () => {
    const api = readFileSync(path.join(import.meta.dirname, "../src/arena/village.ts"), "utf8");
    const web = readFileSync(path.join(import.meta.dirname, "../../web/features/arena/village/village.ts"), "utf8");
    expect(web).toBe(api);
  });

  it("has three maps whose two paths stay on the map and end at the same granary, with spots on both sides", () => {
    for (const map of V.MAP_IDS) {
      const [a, b] = V.MAPS[map].paths;
      expect(a.at(-1)).toEqual(b.at(-1));
      for (const p of [...a, ...b]) {
        expect(p[0]).toBeGreaterThanOrEqual(0);
        expect(p[0]).toBeLessThan(V.COLS);
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(p[1]).toBeLessThan(V.ROWS);
      }
      // every segment is straight (only across or down)
      for (const path of [a, b]) for (let i = 1; i < path.length; i++) expect(path[i][0] === path[i - 1][0] || path[i][1] === path[i - 1][1]).toBe(true);
      const spots = V.buildSpots(map);
      expect(spots.filter((s) => s.side === 0).length).toBeGreaterThan(15);
      expect(spots.filter((s) => s.side === 1).length).toBeGreaterThan(15);
      const onPath = V.pathTiles(map);
      for (const s of spots) expect(onPath.has(`${s.tx},${s.ty}`)).toBe(false);
    }
  });

  it("builds, upgrades along a branch, and sells for 70%", () => {
    const g = V.newVillage("riverside", [me]);
    const spot = V.buildSpots("riverside")[0];
    expect(V.act(g, "me", { a: "build", tx: 0, ty: 1, kind: "archer" })).toBe("You can't build there"); // on the path
    expect(V.act(g, "me", { a: "build", tx: spot.tx, ty: spot.ty, kind: "archer" })).toBeNull();
    expect(g.coins.me).toBe(160 - 60);
    expect(V.act(g, "me", { a: "build", tx: spot.tx, ty: spot.ty, kind: "kite" })).toBe("There's already a defender there");
    const t = g.towers[0];
    expect(V.act(g, "me", { a: "upgrade", id: t.id })).toBe("Pick an upgrade");
    expect(V.act(g, "me", { a: "upgrade", id: t.id, branch: "a" })).toBeNull();
    expect(t).toMatchObject({ level: 2, branch: "a", spent: 60 + 54 });
    expect(V.act(g, "me", { a: "upgrade", id: t.id })).toBe("Not enough coins");
    g.coins.me = 500;
    V.act(g, "me", { a: "upgrade", id: t.id });
    expect(V.act(g, "me", { a: "upgrade", id: t.id })).toBe("It's as strong as it gets");
    V.act(g, "me", { a: "sell", id: t.id });
    expect(g.towers).toHaveLength(0);
    expect(g.coins.me).toBe(500 - 84 + Math.floor((60 + 54 + 84) * 0.7));
  });

  it("calling a wave early pays the seconds you skip", () => {
    const g = V.newVillage("terraces", [me]);
    run(g, 10_000);
    V.act(g, "me", { a: "next" });
    expect(g.coins.me).toBe(160 + 20);
    expect(g.phase).toBe("wave");
    expect(V.act(g, "me", { a: "next" })).toBe("A wave is already coming");
  });

  it("spirits that reach the granary steal rice; 20 sacks gone and the night is lost", () => {
    const g = V.newVillage("riverside", [me]);
    playWave(g);
    expect(g.cleared).toBe(1);
    expect(g.rice).toBe(20 - 6); // 6 foxes, nobody stopped them
    playWave(g);
    expect(g.rice).toBe(20 - 6 - 7);
    playWave(g);
    expect(g.phase).toBe("lost");
  });

  it("only kites hit paper-cranes; lanterns slow walkers; drums stun them", () => {
    const g = V.newVillage("festival", [me]);
    const spot = V.buildSpots("festival").find((s) => s.side === 0)!;
    V.act(g, "me", { a: "build", tx: spot.tx, ty: spot.ty, kind: "archer" });
    addSpirit(g, "crane", 0);
    const crane = g.spirits[0];
    Object.assign(crane, { x: spot.tx + 0.5, y: spot.ty + 0.5 });
    // an archer right next to it can't touch it
    V.stepVillage(g, 50);
    expect(g.spirits[0]?.hp ?? 0).toBe(crane.maxHp);
    // a kite can
    g.coins.me = 999;
    const other = V.buildSpots("festival").find((s) => s.tx !== spot.tx || s.ty !== spot.ty)!;
    V.act(g, "me", { a: "build", tx: other.tx, ty: other.ty, kind: "kite" });
    g.towers[1].tx = spot.tx;
    g.towers[1].ty = spot.ty;
    Object.assign(g.spirits[0], { d: 0 });
    V.stepVillage(g, 50);
    expect(g.spirits[0].hp).toBeLessThan(crane.maxHp);
  });

  it("lantern light slows, the drum stuns, and gourds split in two", () => {
    const slowGame = V.newVillage("riverside", [me]);
    const fastGame = V.newVillage("riverside", [me]);
    // a lantern beside the first stretch of path 0 (row 1)
    slowGame.coins.me = 999;
    expect(V.act(slowGame, "me", { a: "build", tx: 2, ty: 0, kind: "lantern" })).toBeNull();
    addSpirit(slowGame, "fox", 0.5);
    addSpirit(fastGame, "fox", 0.5);
    run(slowGame, 500);
    run(fastGame, 500);
    expect(slowGame.spirits[0].d).toBeLessThan(fastGame.spirits[0].d);

    const drum = V.newVillage("riverside", [me]);
    drum.coins.me = 999;
    V.act(drum, "me", { a: "build", tx: 2, ty: 0, kind: "drum" });
    addSpirit(drum, "turtle", 1.5);
    V.stepVillage(drum, 50);
    const d = drum.spirits[0].d;
    run(drum, 500);
    expect(drum.spirits[0].d).toBe(d); // frozen by the beat

    const split = V.newVillage("riverside", [me]);
    addSpirit(split, "gourd", 2);
    split.spirits[0].hp = 0;
    V.stepVillage(split, 50);
    expect(split.spirits.map((s) => s.kind)).toEqual(["gourdlet", "gourdlet"]);
  });

  it("in co-op, each player builds on their own side and keeps their own coins", () => {
    const g = V.newVillage("terraces", [
      { id: "ann", name: "Ann", side: 0 },
      { id: "bou", name: "Bou", side: 1 },
    ]);
    expect(g.coins).toEqual({ ann: 110, bou: 110 });
    const spots = V.buildSpots("terraces");
    const annSpot = spots.find((s) => s.side === 0)!;
    const bouSpot = spots.find((s) => s.side === 1)!;
    expect(V.act(g, "ann", { a: "build", tx: bouSpot.tx, ty: bouSpot.ty, kind: "archer" })).toBe("That's your partner's side");
    expect(V.act(g, "ann", { a: "build", tx: annSpot.tx, ty: annSpot.ty, kind: "archer" })).toBeNull();
    expect(V.act(g, "bou", { a: "sell", id: g.towers[0].id })).toBe("That's your partner's defender");
    expect(g.coins).toEqual({ ann: 50, bou: 110 });
  });

  it("saves between waves and loads back", () => {
    const g = V.newVillage("festival", [me]);
    const spot = V.buildSpots("festival")[3];
    V.act(g, "me", { a: "build", tx: spot.tx, ty: spot.ty, kind: "kite" });
    playWave(g);
    const save = V.saveOf(g)!;
    expect(save).toMatchObject({ map: "festival", cleared: 1 });
    const back = V.loadSave(JSON.parse(JSON.stringify(save)), me);
    expect(back).toMatchObject({ cleared: 1, rice: g.rice, phase: "build" });
    expect(back.coins.me).toBe(g.coins.me);
    expect(back.towers[0]).toMatchObject({ kind: "kite", tx: spot.tx, ty: spot.ty });
    V.act(g, "me", { a: "next" });
    expect(V.saveOf(g)).toBeNull(); // not in the middle of a wave
  });

  it("is winnable: a sensible build survives all 30 waves on every map, and none at all loses early", () => {
    for (const map of V.MAP_IDS) {
      const g = V.newVillage(map, [me]);
      const end = V.MAPS[map].paths[0].at(-1)!;
      const spots = V.buildSpots(map).sort((a, b) => Math.hypot(a.tx - end[0] + 3, a.ty - end[1]) - Math.hypot(b.tx - end[0] + 3, b.ty - end[1]));
      const plan: V.TowerKind[] = ["archer", "archer", "kite", "archer", "lantern", "archer", "cart", "kite", "drum", "archer", "kite", "archer", "lantern", "archer", "kite"];
      let i = 0;
      while (g.phase !== "won" && g.phase !== "lost") {
        for (;;) {
          const spot = spots.find((s) => !g.towers.some((t) => t.tx === s.tx && t.ty === s.ty));
          const kind = plan[i % plan.length];
          if (i < 22 && spot && g.coins.me >= V.TOWER_COST[kind]) {
            V.act(g, "me", { a: "build", tx: spot.tx, ty: spot.ty, kind });
            i++;
            continue;
          }
          const up = g.towers.filter((t) => t.level < 3 && (t.kind === "archer" || t.kind === "kite")).sort((a, b) => a.level - b.level)[0];
          if (up && i >= 10 && g.coins.me >= V.upgradeCost(up.kind, up.level)) {
            V.act(g, "me", { a: "upgrade", id: up.id, branch: "a" });
            continue;
          }
          break;
        }
        V.stepVillage(g, 50);
      }
      expect(g.phase, map).toBe("won");
      expect(V.scoreOf(g)).toBeGreaterThan(3500);

      const idle = V.newVillage(map, [me]);
      while (idle.phase !== "lost") V.stepVillage(idle, 100);
      expect(idle.cleared).toBeLessThan(4);
    }
  });
});
