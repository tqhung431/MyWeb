// Stage 16: Vân Lộ's engine and rules. Seeds make every "random" thing repeatable.
import { describe, expect, it } from "vitest";
import { fieldOfView } from "@/features/games/van-lo/engine/fov";
import { isFloor, line, type Grid } from "@/features/games/van-lo/engine/grid";
import { distances, findPath } from "@/features/games/van-lo/engine/path";
import { makeRng, seedFrom } from "@/features/games/van-lo/engine/rng";
import { ABILITIES, layerCost, TECHNIQUES } from "@/features/games/van-lo/logic/data";
import {
  buy,
  canPractise,
  equip,
  gainCultivation,
  meditate,
  needed,
  newGame,
  practise,
  readyForTribulation,
  refine,
  rollGear,
  sellGear,
  stats,
  toggleBound,
  unlockedAbilities,
} from "@/features/games/van-lo/logic/player";
import { makeFloor } from "@/features/games/van-lo/logic/realm";
import { newer, parseSave, toSave } from "@/features/games/van-lo/logic/save";
import { act, damage, finishRun, startRun, startTribulation, TRIBULATION_TURNS, visible, type Action } from "@/features/games/van-lo/logic/world";
import { makeEnemy } from "@/features/games/van-lo/logic/realm";

const room = (rows: string[]): Grid => ({ w: rows[0].length, h: rows.length, tiles: rows.join("") });

describe("engine", () => {
  it("the same seed gives the same numbers", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
    expect(seedFrom("frieren")).toBe(seedFrom("frieren"));
    expect(seedFrom("frieren")).not.toBe(seedFrom("himmel"));
  });

  it("can't see through walls", () => {
    const g = room(["#######", "#.....#", "#..#..#", "#.....#", "#######"]);
    const seen = fieldOfView(g, { x: 1, y: 2 }, 8);
    expect(seen.has(2 * 7 + 2)).toBe(true); // next to you
    expect(seen.has(2 * 7 + 3)).toBe(true); // the wall itself is seen
    expect(seen.has(2 * 7 + 5)).toBe(false); // behind the wall
    expect(seen.has(1 * 7 + 5)).toBe(true); // around it
  });

  it("finds a path around walls, without cutting corners", () => {
    const g = room(["#####", "#.#.#", "#.#.#", "#...#", "#####"]);
    const path = findPath(g, { x: 1, y: 1 }, { x: 3, y: 1 })!;
    expect(path.at(-1)).toEqual({ x: 3, y: 1 });
    expect(path.every((p) => isFloor(g, p.x, p.y))).toBe(true);
    expect(path).toHaveLength(6);
    expect(findPath(room(["#####", "#.#.#", "#####"]), { x: 1, y: 1 }, { x: 3, y: 1 })).toBeNull();
  });

  it("draws straight lines", () => {
    expect(line({ x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });
});

describe("secret realm floors", () => {
  it.each([1, 2, 3, 4, 5])("every floor tile is reachable, the goal is far away (seed %i)", (seed) => {
    const g = newGame("Test", seed);
    for (const depth of [1, 3, 5]) {
      const { floor, start } = makeFloor(g, makeRng(seed * 7 + depth), "vu-an-coc", depth);
      const reach = distances(floor, start);
      const floors = [...floor.tiles].filter((t) => t === ".").length;
      expect(reach.size).toBe(floors);
      const goal = depth === 5 ? floor.enemies.find((e) => e.kind === "mang-vuong")!.pos : floor.things.find((t) => t.kind === "stairs")!.pos;
      expect(reach.get(goal.y * floor.w + goal.x)).toBeGreaterThan(8);
      for (const e of floor.enemies) expect(isFloor(floor, e.pos.x, e.pos.y)).toBe(true);
      expect(floor.enemies.length).toBeGreaterThanOrEqual(depth === 5 ? 5 : 4);
    }
  });

  it("only the last floor has the boss, and no stairs", () => {
    const g = newGame("Test", 9);
    const last = makeFloor(g, makeRng(1), "vu-an-coc", 5).floor;
    expect(last.things.some((t) => t.kind === "stairs")).toBe(false);
    expect(last.enemies.filter((e) => e.kind === "mang-vuong")).toHaveLength(1);
  });
});

describe("cultivation", () => {
  it("fills layers one by one, and stops at Luyện Khí 9 for the tribulation", () => {
    const g = newGame("Lan", 1);
    const p = g.player;
    expect(gainCultivation(p, layerCost(0, 1) + 5)).toBe(1);
    expect(p.layer).toBe(2);
    expect(p.cultivation).toBe(5);
    gainCultivation(p, 1_000_000);
    expect(p.layer).toBe(9);
    expect(p.cultivation).toBe(needed(p));
    expect(readyForTribulation(p)).toBe(true);
  });

  it("meditation costs spirit stones; a better root cultivates faster", () => {
    const g = newGame("Lan", 1);
    g.player.stones = 30;
    g.player.root = ["kim"];
    const fast = meditate(g, 3);
    expect(fast.gained).toBe(3 * 48);
    expect(g.player.stones).toBe(0);
    expect(meditate(g).ok).toBe(false);
    const h = newGame("Mai", 1);
    h.player.root = ["kim", "moc", "thuy", "hoa"];
    h.player.stones = 10;
    expect(meditate(h).gained).toBe(24);
  });

  it("practising a method needs stones and realm; new levels unlock abilities", () => {
    const g = newGame("Lan", 1);
    const p = g.player;
    expect(canPractise(p, "thanh-phong")).toMatchObject({ ok: false, reason: "realm" });
    p.layer = 3;
    p.stones = 1000;
    expect(practise(g, "thanh-phong")).toEqual(["ngu-kiem"]);
    expect(p.skills).toContain("ngu-kiem");
    expect(unlockedAbilities(p)).toEqual(["kiem-khi", "ngu-kiem"]);
    expect(canPractise(p, "xich-diem").reason).toBe("unknown");
  });

  it("a method of your own element is stronger", () => {
    const wood = newGame("A", 1);
    wood.player.root = ["moc"];
    const metal = newGame("B", 1);
    metal.player.root = ["kim"];
    expect(stats(wood.player).atk).toBeGreaterThan(stats(metal.player).atk);
  });

  it("each of the 28 abilities comes from a method level", () => {
    expect(Object.keys(ABILITIES)).toHaveLength(28);
    for (const a of Object.values(ABILITIES)) expect(a.from[1]).toBeLessThanOrEqual(TECHNIQUES[a.from[0]].maxLevel);
  });
});

describe("gear and treasures", () => {
  it("equipping gear adds its stats; selling only unequipped gear", () => {
    const g = newGame("Lan", 3);
    const rng = makeRng(5);
    const item = rollGear(g, rng, 2);
    g.player.gear.push(item);
    const before = stats(g.player);
    equip(g, item.uid);
    const after = stats(g.player);
    expect(after.hp + after.def + after.qi + after.atk + after.crit).toBeGreaterThan(before.hp + before.def + before.qi + before.atk + before.crit);
    expect(sellGear(g, item.uid)).toBe(0);
    equip(g, item.uid);
    expect(sellGear(g, item.uid)).toBeGreaterThan(0);
  });

  it("refining needs beast cores; level 10 moves up a grade", () => {
    const g = newGame("Lan", 3);
    const t = g.player.treasures[0];
    g.player.stones = 100_000;
    expect(refine(g, t.uid)).toBe(false);
    g.player.bag["yeu-dan"] = 100;
    for (let i = 0; i < 9; i++) expect(refine(g, t.uid)).toBe(true);
    expect(t.level).toBe(10);
    expect(refine(g, t.uid)).toBe(true);
    expect(t).toMatchObject({ grade: 1, level: 1 });
  });

  it("Luyện Khí can bind one treasure", () => {
    const g = newGame("Lan", 3);
    g.player.treasures.push({ uid: "t9", kind: "tran-hon", grade: 0, level: 1 });
    expect(toggleBound(g, "t9")).toBe(false);
    expect(toggleBound(g, "t1")).toBe(true);
    expect(toggleBound(g, "t9")).toBe(true);
    expect(g.player.bound).toEqual(["t9"]);
  });

  it("buys from the shop with spirit stones", () => {
    const g = newGame("Lan", 3);
    g.player.stones = 30;
    expect(buy(g, "hoi-xuan")).toBe(true);
    expect(buy(g, "hoi-xuan")).toBe(false);
    expect(g.player.bag["hoi-xuan"]).toBe(3);
  });
});

describe("a run", () => {
  it("damage goes down with defence, never below 1", () => {
    const rng = makeRng(1);
    expect(damage(20, 0, rng).amount).toBeGreaterThan(damage(20, 20, makeRng(1)).amount);
    expect(damage(1, 1000, rng).amount).toBe(1);
  });

  it("bumping into an enemy attacks it; enemies come for you", () => {
    const g = newGame("Lan", 11);
    startRun(g);
    const r = g.run!;
    r.floor.enemies = [];
    const dir = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].find((d) => isFloor(r.floor, r.pos.x + d.x, r.pos.y + d.y))!;
    const foe = makeEnemy(g, "hung", 1, { x: r.pos.x + dir.x, y: r.pos.y + dir.y });
    r.floor.enemies.push(foe);
    const res = act(g, { type: "move", dir });
    expect(res.ok).toBe(true);
    expect(res.fx.some((f) => f.type === "hit" && !f.onPlayer)).toBe(true);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(g.player.intent).toBe(1);
  });

  it("can't walk into walls or use abilities without qi", () => {
    const g = newGame("Lan", 11);
    startRun(g);
    const r = g.run!;
    const wall = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].find((d) => !isFloor(r.floor, r.pos.x + d.x, r.pos.y + d.y));
    if (wall) expect(act(g, { type: "move", dir: wall }).ok).toBe(false);
    g.player.qi = 0;
    expect(act(g, { type: "ability", id: "kiem-khi", target: { x: r.pos.x + 1, y: r.pos.y } })).toMatchObject({ ok: false, reason: "qi" });
  });

  it("you always see where you stand, and the map remembers what you saw", () => {
    const g = newGame("Lan", 11);
    startRun(g);
    const r = g.run!;
    expect(visible(g).has(r.pos.y * r.floor.w + r.pos.x)).toBe(true);
    expect(r.floor.seen.includes("1")).toBe(true);
  });

  it("dying loses the run's loot but keeps the cultivation", () => {
    const g = newGame("Lan", 11);
    startRun(g);
    g.run!.loot.stones = 500;
    g.run!.loot.cultivation = 40;
    const stones = g.player.stones;
    finishRun(g, "dead");
    expect(g.player.stones).toBe(stones);
    expect(g.player.record.deaths).toBe(1);
    expect(g.run).toBeNull();
    expect(g.player.hp).toBe(stats(g.player).hp);
  });

  it("going home keeps the loot", () => {
    const g = newGame("Lan", 11);
    startRun(g);
    g.run!.loot.stones = 500;
    g.run!.loot.bag["yeu-dan"] = 2;
    finishRun(g, "home");
    expect(g.player.stones).toBe(560);
    expect(g.player.bag["yeu-dan"]).toBe(2);
  });

  it("a bot can play 600 random turns without breaking anything", () => {
    for (const seed of [1, 2, 3]) {
      const g = newGame("Bot", seed);
      g.player.layer = 9;
      startRun(g);
      const rng = makeRng(seed);
      let finished = 0;
      for (let i = 0; i < 600; i++) {
        if (!g.run) {
          startRun(g);
          continue;
        }
        const r = g.run;
        const roll = rng.next();
        const action: Action =
          roll < 0.05
            ? { type: "use" }
            : roll < 0.15
              ? { type: "ability", id: "kiem-khi", target: { x: r.pos.x + 1, y: r.pos.y } }
              : roll < 0.2
                ? { type: "treasure", uid: "t1", target: r.floor.enemies[0]?.pos }
                : { type: "move", dir: { x: rng.int(-1, 1), y: rng.int(-1, 1) } };
        const res = act(g, action);
        if (res.outcome !== "continue") {
          finishRun(g, res.outcome as "dead" | "home");
          finished++;
        } else {
          expect(g.player.hp).toBeGreaterThan(0);
          expect(isFloor(g.run!.floor, g.run!.pos.x, g.run!.pos.y)).toBe(true);
        }
      }
      expect(parseSave(toSave(g))).not.toBeNull();
      expect(finished + (g.run ? 1 : 0)).toBeGreaterThan(0);
    }
  });
});

describe("the tribulation", () => {
  const ready = () => {
    const g = newGame("Lan", 21);
    gainCultivation(g.player, 1_000_000);
    return g;
  };

  it("only starts at Luyện Khí 9 with full cultivation", () => {
    expect(startTribulation(newGame("Lan", 21))).toBe(false);
    const g = ready();
    expect(startTribulation(g)).toBe(true);
    expect(g.run!.kind).toBe("tribulation");
    expect(g.run!.strikes!.length).toBeGreaterThan(5);
  });

  it("lightning hits where it was marked; the Heart Demon comes after the waiting; beating it means Trúc Cơ", () => {
    const g = ready();
    startTribulation(g);
    const r = g.run!;
    g.player.hp = 100_000; // survive anything; we only check the rules here
    const marked = r.strikes!.map((p) => ({ ...p }));
    const onMe = marked.some((p) => p.x === r.pos.x && p.y === r.pos.y);
    const res = act(g, { type: "wait" });
    expect(res.fx.filter((f) => f.type === "bolt")).toHaveLength(marked.length);
    expect(res.fx.some((f) => f.type === "hit" && f.onPlayer)).toBe(onMe);
    for (let i = 1; i < TRIBULATION_TURNS; i++) act(g, { type: "wait" });
    const demon = g.run!.floor.enemies.find((e) => e.kind === "tam-ma")!;
    expect(demon).toBeDefined();
    demon.hp = 1;
    demon.pos = { x: r.pos.x + 1, y: r.pos.y };
    const win = act(g, { type: "move", dir: { x: 1, y: 0 } });
    expect(win.outcome).toBe("won");
    finishRun(g, "won");
    expect(g.player).toMatchObject({ major: 1, layer: 1 });
  });

  it("failing costs a quarter of the cultivation", () => {
    const g = ready();
    const before = g.player.cultivation;
    startTribulation(g);
    finishRun(g, "lost");
    expect(g.player.cultivation).toBe(Math.floor(before * 0.75));
    expect(g.player.major).toBe(0);
  });
});

describe("saves", () => {
  it("round-trips through JSON and refuses broken or old saves", () => {
    const g = newGame("Lan", 31);
    startRun(g);
    const back = parseSave(toSave(g))!;
    expect(back.player.name).toBe("Lan");
    expect(back.run!.floor.tiles).toBe(g.run!.floor.tiles);
    expect(parseSave("{nope")).toBeNull();
    expect(parseSave({ ...g, v: 0 })).toBeNull();
    expect(parseSave({ ...g, player: { ...g.player, layer: 99 } })).toBeNull();
    expect(parseSave({ ...g, player: { ...g.player, techniques: [{ id: "made-up", level: 1 }] } })).toBeNull();
  });

  it("keeps the newer of two saves", () => {
    const a = newGame("A", 1, 1000);
    const b = newGame("B", 1, 2000);
    expect(newer(a, b)).toBe(b);
    expect(newer(b, a)).toBe(b);
    expect(newer(null, a)).toBe(a);
  });

  it("a loaded game continues exactly the same way", () => {
    const g = newGame("Lan", 41);
    startRun(g);
    const copy = parseSave(toSave(g))!;
    const moves: Action[] = [{ type: "wait" }, { type: "wait" }, { type: "move", dir: { x: 1, y: 0 } }, { type: "wait" }];
    for (const m of moves) {
      act(g, m);
      act(copy, m);
    }
    expect(toSave(copy)).toBe(toSave(g));
  });
});
