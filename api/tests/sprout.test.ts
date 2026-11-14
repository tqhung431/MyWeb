// Stage 26 · Mầm Thú: the Five Elements, growing, battles, the island maps, and a bot that plays the whole island
// (befriend, train, grow, beat every shrine keeper) to check the numbers are fair.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as S from "../src/arena/sprout.js";
import { AREAS, MAP_H, MAP_W, findTile, pathTo, tileAt, walkable } from "../../web/features/arena/sprout/island.js";

const fight = (b: S.Battle, mine: (b: S.Battle) => S.BattleAction = (x) => S.aiAction(x, 0)) => {
  for (let i = 0; i < 400 && !b.over; i++) S.playTurn(b, mine(b), S.aiAction(b, 1));
  return b;
};

/** Plays the island like a sensible person would: returns how it went */
export function playIsland(seed: number) {
  const r = S.rng(seed);
  let uid = 1;
  const team: S.Creature[] = [S.makeCreature(uid++, "giot", 5)];
  const pick = <T>(list: { species: T; weight: number }[]) => {
    let x = r() * list.reduce((n, w) => n + w.weight, 0);
    for (const w of list) if ((x -= w.weight) < 0) return w.species;
    return list[0].species;
  };
  const heal = () => team.forEach((c) => (c.hp = S.statsOf(c).hp));
  const out: { area: string; wildBattles: number; keeperWon: boolean; levels: number[] }[] = [];
  for (const area of AREAS) {
    // befriend one new sproutling here (a different element when possible), at the area's top level
    const owned = new Set(team.map((c) => S.SPECIES[c.species].element));
    const fresh = area.wild.find((w) => !owned.has(S.SPECIES[w.species].element)) ?? area.wild[0];
    team.push(S.makeCreature(uid++, fresh.species, area.levels[1]));
    let wildBattles = 0;
    const target = Math.max(...area.keeper.team.map(([, l]) => l)) - 1;
    const train = () => {
      // the three best go first; train until the lowest of them is near the keeper's level
      team.sort((a, b) => b.level - a.level);
      while (Math.min(...team.slice(0, 3).map((c) => c.level)) < target && wildBattles < 300) {
        heal();
        const level = area.levels[0] + Math.floor(r() * (area.levels[1] - area.levels[0] + 1));
        const wild = S.makeCreature(0, pick(area.wild), level);
        // put the lowest-level one in front so it gets the experience
        const order = [...team.slice(0, 3)].sort((a, b) => a.level - b.level);
        const b = fight(S.newBattle(order, [wild], seed * 1000 + wildBattles, true));
        wildBattles++;
        if (b.winner === 0) {
          const fought = b.sides[0].team.filter((f) => f.hp > 0);
          for (const f of fought) S.gainXp(team.find((c) => c.uid === f.uid)!, Math.ceil(S.xpFor(wild) / fought.length));
        }
        for (const c of team) if (S.canGrow(c)) S.grow(c);
        team.sort((a, b) => b.level - a.level);
      }
    };
    train();
    let keeperWon = false;
    for (let attempt = 0; attempt < 3 && !keeperWon; attempt++) {
      heal();
      const keeper = area.keeper.team.map(([sp, l], i) => S.makeCreature(1000 + i, sp, l));
      const b = fight(S.newBattle(team.slice(0, 3), keeper, seed * 77 + attempt));
      keeperWon = b.winner === 0;
      if (!keeperWon) {
        wildBattles -= 0; // a loss: train a little more, then try again
        const before = wildBattles;
        const extra = target + attempt + 1;
        while (Math.min(...team.slice(0, 3).map((c) => c.level)) < extra && wildBattles < before + 60) {
          heal();
          const wild = S.makeCreature(0, pick(area.wild), area.levels[1]);
          const wb = fight(S.newBattle(team.slice(0, 3), [wild], seed * 31 + wildBattles, true));
          wildBattles++;
          if (wb.winner === 0) for (const f of wb.sides[0].team.filter((x) => x.hp > 0)) S.gainXp(team.find((c) => c.uid === f.uid)!, S.xpFor(wild));
          for (const c of team) if (S.canGrow(c)) S.grow(c);
        }
      }
    }
    out.push({ area: area.id, wildBattles, keeperWon, levels: team.slice(0, 3).map((c) => c.level) });
  }
  return out;
}

describe("Mầm Thú", () => {
  it("keeps the browser's copy of the rules identical to the server's", () => {
    const api = readFileSync(path.join(import.meta.dirname, "../src/arena/sprout.ts"), "utf8");
    const web = readFileSync(path.join(import.meta.dirname, "../../web/features/arena/sprout/sprout.ts"), "utf8");
    expect(web).toBe(api);
  });

  it("follows the Five Elements: each feeds the next and tames the one two steps on", () => {
    expect(S.feeds("water")).toBe("wood");
    expect(S.feeds("metal")).toBe("water");
    expect(S.tames("water")).toBe("fire");
    expect(S.tames("fire")).toBe("metal");
    expect(S.tames("metal")).toBe("wood");
    expect(S.tames("wood")).toBe("earth");
    expect(S.tames("earth")).toBe("water");
    expect(S.elementMul("water", "fire")).toBe(1.5);
    expect(S.elementMul("fire", "water")).toBe(0.6);
    expect(S.elementMul("water", "wood")).toBe(1);
    // every species' moves exist, every grown form is reachable, 12 sproutlings you can meet + 5 grown forms
    for (const sp of S.SPECIES_IDS) for (const [, m] of S.SPECIES[sp].learn) expect(S.MOVES[m], `${sp} ${m}`).toBeTruthy();
    expect(S.SPECIES_IDS.filter((s) => !S.SPECIES[s].grown)).toHaveLength(12);
    expect(S.SPECIES_IDS.filter((s) => S.SPECIES[s].grown)).toHaveLength(5);
  });

  it("levels up, learns moves (4 at most) and grows only when old enough", () => {
    const c = S.makeCreature(1, "thanHong", 5);
    expect(c.moves).toEqual(["nuzzle", "emberPounce"]);
    expect(S.canGrow(c)).toBe(false);
    expect(S.grow(c)).toBe(false);
    const hp = S.statsOf(c).hp;
    const r = S.gainXp(c, 10_000);
    expect(c.level).toBe(S.MAX_LEVEL);
    expect(r.learned).toEqual(["warmGlow", "lanternDrift", "hearthBlaze"]);
    expect(c.moves).toHaveLength(4);
    expect(S.statsOf(c).hp).toBeGreaterThan(hp);
    expect(S.canGrow(c)).toBe(true);
    expect(S.grow(c)).toBe(true);
    expect(c.species).toBe("bepLua");
    expect(S.statsOf(c).atk).toBeGreaterThan(S.statsOf({ species: "thanHong", level: 30 }).atk);
  });

  it("battles: switching goes first and costs the move, the faster one hits first, a fainted one must be replaced", () => {
    const fast = S.makeCreature(1, "kimChi", 10);
    const slow = S.makeCreature(2, "gom", 10);
    const b = S.newBattle([fast, S.makeCreature(3, "cheo", 10)], [slow], 1);
    S.playTurn(b, { t: "move", i: 0 }, { t: "move", i: 0 });
    const moves = b.log.filter((e) => e.t === "move");
    expect(moves.map((e) => (e as { side: number }).side)).toEqual([0, 1]);
    // switching: the switch happens, then only the other side moves
    S.playTurn(b, { t: "switch", to: 1 }, { t: "move", i: 0 });
    expect(b.log[0]).toMatchObject({ t: "switch", side: 0, to: 1 });
    expect(b.log.filter((e) => e.t === "move")).toHaveLength(1);
    expect(S.activeOf(b, 0).uid).toBe(3);
    // knock our active one out: we must pick the next one before anything else happens
    S.activeOf(b, 0).hp = 1;
    S.activeOf(b, 1).sleep = 0;
    for (let i = 0; i < 20 && !b.needSwitch[0]; i++) S.playTurn(b, { t: "move", i: 0 }, { t: "move", i: S.activeOf(b, 1).moves.indexOf("potRoll") >= 0 ? S.activeOf(b, 1).moves.indexOf("potRoll") : 0 });
    expect(b.needSwitch[0]).toBe(true);
    expect(S.checkAction(b, 0, { t: "move", i: 0 })).toBe("Pick who goes next");
    S.playTurn(b, { t: "switch", to: 0 }, { t: "move", i: 0 });
    expect(b.needSwitch[0]).toBe(false);
    expect(S.activeOf(b, 0).uid).toBe(1);
  });

  it("the elements matter: Water hits Fire hard, Fire barely scratches Water; guard and sleep work", () => {
    const water = S.makeCreature(1, "giot", 10);
    const fire = S.makeCreature(2, "thanHong", 10);
    const b = S.newBattle([water], [fire], 3);
    const w = S.activeOf(b, 0);
    const f = S.activeOf(b, 1);
    expect(S.baseDamage(w, f, S.MOVES.splash)).toBeGreaterThan(2 * S.baseDamage(f, w, S.MOVES.emberPounce));
    // guard: much less damage this turn
    // (the guard goes up first because the bell beetle is faster than the clay pot)
    const g = S.newBattle([S.makeCreature(1, "chuongNho", 10)], [S.makeCreature(2, "gom", 10)], 4);
    const guardI = S.activeOf(g, 0).moves.indexOf("bellGuard");
    const potI = S.activeOf(g, 1).moves.indexOf("potRoll");
    S.playTurn(g, { t: "move", i: guardI }, { t: "move", i: potI });
    const hit = g.log.find((e) => e.t === "damage") as { amount: number } | undefined;
    if (hit) expect(hit.amount).toBeLessThan(S.baseDamage(S.activeOf(g, 1), S.activeOf(g, 0), S.MOVES.potRoll) * 0.5);
    // sleep: a sleeping sproutling skips its turn
    const s = S.newBattle([S.makeCreature(1, "namLun", 10)], [S.makeCreature(2, "datSet", 10)], 5);
    S.activeOf(s, 1).sleep = 2;
    S.playTurn(s, { t: "move", i: 0 }, { t: "move", i: 0 });
    expect(s.log.some((e) => e.t === "status" && e.side === 1 && e.what === "asleep")).toBe(true);
    expect(s.log.filter((e) => e.t === "move" && e.side === 1)).toHaveLength(0);
  });

  it("a friend on the bench whose element feeds the fighter gives it a little health each turn", () => {
    const b = S.newBattle([S.makeCreature(1, "mamTre", 10), S.makeCreature(2, "giot", 10)], [S.makeCreature(3, "gom", 10)], 6);
    S.activeOf(b, 0).hp = Math.round(S.statsOf(S.activeOf(b, 0)).hp / 2);
    S.playTurn(b, { t: "move", i: 0 }, { t: "move", i: 0 });
    expect(b.log.some((e) => e.t === "heal" && e.side === 0 && e.fed)).toBe(true);
    const lonely = S.newBattle([S.makeCreature(1, "mamTre", 10), S.makeCreature(2, "thanHong", 10)], [S.makeCreature(3, "gom", 10)], 6);
    S.playTurn(lonely, { t: "move", i: 0 }, { t: "move", i: 0 });
    expect(lonely.log.some((e) => e.t === "heal" && e.fed)).toBe(false);
  });

  it("wild sproutlings: knocked out = they run home; calm and sleepy ones are easier to befriend", () => {
    const b = S.newBattle([S.makeCreature(1, "giot", 20)], [S.makeCreature(2, "thanHong", 3)], 7, true);
    fight(b);
    expect(b.over).toBe(true);
    expect(b.ended).toBe("win");
    const wild = S.newBattle([S.makeCreature(1, "giot", 5)], [S.makeCreature(2, "mamTre", 5)], 8, true);
    const w = S.activeOf(wild, 1);
    const full = S.befriendBonus(w, { species: "cheo" });
    w.hp = 3;
    w.sleep = 1;
    expect(S.befriendBonus(w, { species: "cheo" })).toBeGreaterThan(full + 0.3);
    expect(full).toBeCloseTo(0.1); // Water feeds Wood: a friend of the family
    S.playTurn(wild, { t: "befriend" }, { t: "move", i: 0 });
    expect(wild.ended).toBe("befriend");
    expect(S.checkAction(S.newBattle([S.makeCreature(1, "giot", 5)], [S.makeCreature(2, "gom", 5)], 1), 0, { t: "befriend" })).toBe("Only with wild sproutlings");
  });

  it("the island: six areas of 20×12, villagers stand on their tiles, the keeper can be reached, wild sproutlings exist", () => {
    expect(AREAS).toHaveLength(6);
    for (const [i, a] of AREAS.entries()) {
      expect(a.rows).toHaveLength(MAP_H);
      for (const row of a.rows) expect(row).toHaveLength(MAP_W);
      for (const v of a.villagers) expect(tileAt(a, v.x, v.y), `${a.id} ${v.name}`).toBe("V");
      expect(a.rows.join("").split("V")).toHaveLength(a.villagers.length + 1);
      const keeper = findTile(a, "K")!;
      const shrine = findTile(a, "S")!;
      expect(keeper && shrine).toBeTruthy();
      expect(pathTo(a, a.enter, keeper, false), a.id).not.toBeNull();
      expect(pathTo(a, a.enter, shrine, false), a.id).not.toBeNull();
      // closed gate until the keeper is beaten (not on the last area)
      if (i < AREAS.length - 1) {
        const gate = findTile(a, "G")!;
        expect(walkable(a, gate[0], gate[1], false)).toBe(false);
        expect(pathTo(a, a.enter, gate, true)?.at(-1)).toEqual(gate);
      } else expect(findTile(a, "G")).toBeNull();
      if (i > 0) expect(tileAt(a, 0, a.enter[1])).toBe("<");
      expect(a.rows.join("")).toContain(",");
      for (const w of a.wild) expect(S.SPECIES[w.species].grown).toBeFalsy();
    }
  });

  it("is fair: a bot that befriends one sproutling per area and trains a bit beats every keeper", () => {
    for (const seed of [1, 2, 3]) {
      const run = playIsland(seed);
      expect(run.every((a) => a.keeperWon), JSON.stringify(run)).toBe(true);
      // not too grindy: under 25 wild battles per area on average
      expect(run.reduce((n, a) => n + a.wildBattles, 0) / run.length, JSON.stringify(run)).toBeLessThan(25);
    }
  });
});
