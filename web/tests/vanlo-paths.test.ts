// Stage 17: the six paths, realms up to Nguyên Anh, crafting, and upgrading Stage 16 saves.
import { describe, expect, it } from "vitest";
import { DIRS, isFloor, type Pos } from "@/features/games/van-lo/engine/grid";
import { distances } from "@/features/games/van-lo/engine/path";
import { makeRng } from "@/features/games/van-lo/engine/rng";
import { canCraft, craft, RECIPES } from "@/features/games/van-lo/logic/craft";
import {
  ABILITIES,
  abilitiesOf,
  enemyStats,
  MAJOR_REALMS,
  PATHS,
  REALM_IDS,
  realmInfo,
  realmStats,
  TECHNIQUES,
  techniquesOf,
  TREASURES,
  type AbilityId,
  type PathId,
  type TreasureKind,
} from "@/features/games/van-lo/logic/data";
import { gainCultivation, learnTechnique, newGame, playerLevel, stats } from "@/features/games/van-lo/logic/player";
import { makeEnemy, makeFloor } from "@/features/games/van-lo/logic/realm";
import { parseSave, toSave } from "@/features/games/van-lo/logic/save";
import type { Game } from "@/features/games/van-lo/logic/types";
import { act, finishRun, startRun, startTribulation, tribulationPill, type Action } from "@/features/games/van-lo/logic/world";

const PATH_IDS = Object.keys(PATHS) as PathId[];

// An open room with you in the middle: easy to place enemies around
function arena(path: PathId, seed = 1): Game {
  const g = newGame("Thử", seed, 1, path);
  startRun(g);
  const r = g.run!;
  const w = 15;
  r.floor = {
    ...r.floor,
    w,
    h: 11,
    tiles: Array.from({ length: 11 }, (_, y) => (y === 0 || y === 10 ? "#".repeat(w) : `#${".".repeat(w - 2)}#`)).join(""),
    seen: "1".repeat(w * 11),
    things: [],
    enemies: [],
    allies: [],
  };
  r.pos = { x: 7, y: 5 };
  return g;
}
const foe = (g: Game, at: Pos, kind: Parameters<typeof makeEnemy>[1] = "hung") => {
  const e = makeEnemy(g, kind, 3, at);
  e.awake = true;
  g.run!.floor.enemies.push(e);
  return e;
};
// Everything learned, plenty of qi
function master(g: Game) {
  const p = g.player;
  for (const t of techniquesOf(p.path)) {
    if (!p.techniques.some((x) => x.id === t)) p.techniques.push({ id: t, level: 5 });
    else p.techniques.find((x) => x.id === t)!.level = 5;
  }
  p.qi = 10_000;
  p.hp = 10_000;
}

describe("paths", () => {
  it("has six paths; each starts with its own method, ability and treasure", () => {
    expect(PATH_IDS).toEqual(["kiem", "vo", "nho", "dao", "phat", "binh"]);
    for (const path of PATH_IDS) {
      const g = newGame("A", 1, 1, path);
      expect(g.player.path).toBe(path);
      expect(g.player.techniques).toEqual([{ id: PATHS[path].start, level: 1 }]);
      expect(TECHNIQUES[g.player.skills[0]?.length ? ABILITIES[g.player.skills[0]].from[0] : PATHS[path].start].path).toBe(path);
      expect(g.player.treasures[0].kind).toBe(PATHS[path].treasure);
      expect(abilitiesOf(path).length).toBe(path === "kiem" ? 8 : 4);
    }
    expect(Object.keys(TREASURES)).toHaveLength(11);
  });

  it("can only learn methods of its own path", () => {
    const g = newGame("A", 1, 1, "nho");
    expect(learnTechnique(g.player, "xich-diem")).toBe(false);
    expect(learnTechnique(g.player, "le-nhac")).toBe(true);
    expect(g.player.skills).toContain("xuan-thu");
  });

  // Every ability of every path, used for real in a small fight
  it.each(PATH_IDS)("every %s ability works on a sensible target", (path) => {
    for (const id of abilitiesOf(path)) {
      const g = arena(path);
      master(g);
      g.player.skills = [id];
      const a = ABILITIES[id];
      const near = foe(g, { x: 8, y: 5 });
      foe(g, { x: 10, y: 5 });
      if (a.spendAll) g.player.intent = 5;
      const target =
        a.target === "area"
          ? { x: 10, y: 5 }
          : a.target === "line" || (a.target === "dash" && a.finish)
            ? { x: 8, y: 5 }
            : a.target === "dash"
              ? { x: 7, y: 4 }
              : a.target === "self" || a.target === "around"
                ? undefined
                : near.pos;
      const res = act(g, { type: "ability", id, target });
      expect(res.ok, `${id}: ${res.reason}`).toBe(true);
      if (a.mult || a.finish)
        expect(
          res.fx.some((f) => f.type === "hit" && !f.onPlayer),
          id,
        ).toBe(true);
      if (a.summon) expect(g.run!.floor.allies!.length, id).toBeGreaterThan(0);
      if (a.spendAll) expect(g.player.intent, id).toBeLessThan(5);
      expect(act(g, { type: "ability", id, target }).reason ?? "ok", id).toMatch(a.cooldown > 0 ? /cooldown/ : /ok|target|wall|blocked/);
    }
  });

  it.each(Object.keys(TREASURES) as TreasureKind[])("the treasure %s works", (kind) => {
    const g = arena("kiem");
    master(g);
    g.player.treasures = [{ uid: "tx", kind, grade: 1, level: 3 }];
    g.player.bound = ["tx"];
    const near = foe(g, { x: 9, y: 5 });
    const info = TREASURES[kind];
    const res = act(g, { type: "treasure", uid: "tx", target: info.target === "area" || info.target === "enemy" ? near.pos : undefined });
    expect(res.ok, `${kind}: ${res.reason}`).toBe(true);
    expect(g.run!.cooldowns.tx).toBeGreaterThan(0);
  });
});

describe("path resources", () => {
  const hitOnce = (g: Game) => {
    foe(g, { x: 8, y: 5 }, "hung");
    act(g, { type: "move", dir: { x: 1, y: 0 } });
  };
  it("kiếm tu gains sword intent by hitting", () => {
    const g = arena("kiem");
    hitOnce(g);
    expect(g.player.intent).toBe(1);
  });
  it("võ giả gains blood vigour by hitting and by being hit", () => {
    const g = arena("vo", 3);
    g.player.hp = 10_000;
    foe(g, { x: 8, y: 5 }, "hung");
    for (let i = 0; i < 4; i++) act(g, { type: "wait" });
    expect(g.player.intent).toBeGreaterThanOrEqual(2);
  });
  it("nho gia gathers righteous qi every turn; binh gia every two", () => {
    const n = arena("nho");
    const b = arena("binh");
    for (let i = 0; i < 4; i++) {
      act(n, { type: "wait" });
      act(b, { type: "wait" });
    }
    expect(n.player.intent).toBe(4);
    expect(b.player.intent).toBe(2);
  });
  it("đạo gia gains dao charm from abilities; phật gia gains merit from defeats", () => {
    const d = arena("dao");
    master(d);
    foe(d, { x: 10, y: 5 });
    act(d, { type: "ability", id: "hoa-phu", target: { x: 10, y: 5 } });
    expect(d.player.intent).toBe(1);
    const p = arena("phat");
    const weak = foe(p, { x: 8, y: 5 }, "buc");
    weak.hp = 1;
    act(p, { type: "move", dir: { x: 1, y: 0 } });
    expect(p.player.intent).toBe(1);
  });
});

describe("binh gia soldiers", () => {
  it("summoned soldiers fight, and enemies may go for them", () => {
    const g = arena("binh", 5);
    master(g);
    g.player.skills = ["diem-binh"];
    act(g, { type: "ability", id: "diem-binh" });
    const allies = g.run!.floor.allies!;
    expect(allies).toHaveLength(2);
    const e = foe(g, { x: allies[0].pos.x + 1, y: allies[0].pos.y }, "hung");
    const before = e.hp;
    act(g, { type: "wait" });
    expect(e.hp).toBeLessThan(before);
  });
  it("you can swap places with your own soldier", () => {
    const g = arena("binh");
    master(g);
    g.player.skills = ["diem-binh"];
    act(g, { type: "ability", id: "diem-binh" });
    const a = g.run!.floor.allies![0];
    const spot = { ...a.pos };
    const res = act(g, { type: "move", dir: { x: spot.x - g.run!.pos.x, y: spot.y - g.run!.pos.y } });
    expect(res.ok).toBe(true);
    expect(g.run!.pos).toEqual(spot);
  });
});

describe("realms up to Nguyên Anh", () => {
  it("grows stats at every layer, and enemies keep pace", () => {
    let last = realmStats(0, 1);
    for (let major = 0; major < MAJOR_REALMS.length; major++)
      for (let layer = 1; layer <= 9; layer++) {
        if (major === 0 && layer === 1) continue;
        const s = realmStats(major, layer);
        expect(s.hp).toBeGreaterThan(last.hp);
        expect(s.atk).toBeGreaterThan(last.atk);
        last = s;
      }
    // A cultivator against enemies of their own level hits about as hard at every realm
    const ratio = (major: number, layer: number) => realmStats(major, layer).atk / enemyStats("hung", major * 9 + layer).def;
    expect(ratio(3, 5) / ratio(1, 5)).toBeGreaterThan(0.6);
    expect(ratio(3, 5) / ratio(1, 5)).toBeLessThan(1.8);
  });

  it.each(REALM_IDS)("%s: connected floors, its own boss on the last floor, hazards where they belong", (id) => {
    const info = realmInfo(id);
    const g = newGame("A", 7);
    for (const depth of [1, info.floors]) {
      const { floor, start } = makeFloor(g, makeRng(depth * 13), id, depth);
      expect(distances(floor, start).size).toBe([...floor.tiles].filter((t) => t === ".").length);
      if (depth === info.floors) expect(floor.enemies.some((e) => e.kind === info.boss.kind)).toBe(true);
      expect(floor.things.some((t) => t.kind === "hazard")).toBe(!!info.hazard);
      for (const e of floor.enemies.filter((x) => x.kind !== info.boss.kind)) expect(e.level).toBeGreaterThanOrEqual(info.firstLevel);
    }
  });

  it.each([0, 1, 2])("the tribulation out of major realm %i uses its own pill and leads one realm up", (major) => {
    const g = newGame("A", 9);
    g.player.major = major;
    gainCultivation(g.player, 1e12);
    expect(startTribulation(g)).toBe(true);
    expect(tribulationPill(g.run!)).toBe(MAJOR_REALMS[major].pill);
    finishRun(g, "won");
    expect(g.player.major).toBe(major + 1);
    expect(playerLevel(g.player)).toBe((major + 1) * 9 + 1);
  });

  it("Nguyên Anh 9 is the top for now", () => {
    const g = newGame("A", 9);
    g.player.major = 3;
    gainCultivation(g.player, 1e15);
    expect(g.player.layer).toBe(9);
    expect(startTribulation(g)).toBe(false);
  });

  it("hazards: lava burns, miasma drains qi, a whirlpool sweeps you far away", () => {
    for (const hazard of ["lava", "miasma", "whirlpool"] as const) {
      const g = arena("kiem", 4);
      g.run!.floor.things.push({ uid: "z", kind: "hazard", hazard, pos: { x: 8, y: 5 } });
      const before = { hp: g.player.hp, qi: g.player.qi };
      act(g, { type: "move", dir: { x: 1, y: 0 } });
      if (hazard === "lava") expect(g.player.hp).toBeLessThan(before.hp);
      if (hazard === "miasma") expect(g.player.qi).toBeLessThan(before.qi);
      if (hazard === "whirlpool") expect(Math.abs(g.run!.pos.x - 8) + Math.abs(g.run!.pos.y - 5)).toBeGreaterThan(0);
    }
  });
});

describe("the furnace", () => {
  it("brews pills from herbs; failure still burns the materials", () => {
    const g = newGame("A", 11);
    const recipe = RECIPES.find((r) => r.id === "hoi-xuan")!;
    expect(canCraft(g, recipe)).toEqual({ ok: false, reason: "materials" });
    g.player.bag["linh-thao"] = 40;
    g.player.stones = 1000;
    const before = g.player.bag["hoi-xuan"] ?? 0;
    let made = 0;
    let failed = 0;
    for (let i = 0; i < 20; i++) {
      const res = craft(g, "hoi-xuan");
      expect(res.ok).toBe(true);
      if (res.success) made++;
      else failed++;
    }
    expect(g.player.bag["linh-thao"] ?? 0).toBe(0);
    expect(g.player.bag["hoi-xuan"]).toBe(before + made);
    expect(failed).toBeGreaterThan(0);
    expect(g.player.craft.alchemy.level).toBeGreaterThan(1);
  });

  it("forges gear for your realm, in the slot you chose", () => {
    const g = newGame("A", 12);
    g.player.layer = 5;
    g.player.bag["huyen-thiet"] = 2;
    g.player.stones = 1000;
    const res = craft(g, "forge-ring");
    expect(res.success).toBe(true);
    expect(res.gear).toMatchObject({ slot: "ring", level: playerLevel(g.player) + 1 });
    expect(g.player.gear).toHaveLength(1);
  });

  it("locks recipes of higher realms", () => {
    const g = newGame("A", 12);
    expect(canCraft(g, RECIPES.find((r) => r.id === "ket-kim-dan")!).reason).toBe("realm");
  });
});

describe("Stage 16 saves", () => {
  it("are upgraded: a sword cultivator, renamed jade slips, gear with a level", () => {
    const g = newGame("Cũ", 21);
    g.player.gear.push({ uid: "g9", slot: "robe", tier: 2, level: 5, quality: 1, name: "Huyền Văn Bào", bonus: {} });
    const old = JSON.parse(toSave(g));
    old.v = 1;
    delete old.player.path;
    delete old.player.craft;
    delete old.player.gear[0].level;
    old.player.bag = { "ngoc-gian-xd": 1, "hoi-xuan": 2 };
    const back = parseSave(JSON.stringify(old))!;
    expect(back).not.toBeNull();
    expect(back.v).toBe(2);
    expect(back.player.path).toBe("kiem");
    expect(back.player.bag).toEqual({ "slip-xich-diem": 1, "hoi-xuan": 2 });
    expect(back.player.gear[0].level).toBe(5);
    expect(stats(back.player).hp).toBeGreaterThan(0);
  });
});

describe("every path can play", () => {
  it.each(PATH_IDS)("a bot plays 400 turns as %s without breaking anything", (path) => {
    const g = newGame("Bot", 31, 1, path);
    g.player.layer = 9;
    master(g);
    g.player.hp = stats(g.player).hp;
    g.player.qi = stats(g.player).qi;
    g.player.skills = abilitiesOf(path).slice(0, 4) as AbilityId[];
    startRun(g);
    const rng = makeRng(path.length * 7);
    for (let i = 0; i < 400; i++) {
      if (!g.run) {
        startRun(g);
        continue;
      }
      const r = g.run;
      const roll = rng.next();
      const id = rng.pick(g.player.skills);
      const near = r.floor.enemies[0]?.pos;
      const action: Action =
        roll < 0.04
          ? { type: "use" }
          : roll < 0.25
            ? { type: "ability", id, target: near ?? { x: r.pos.x + 1, y: r.pos.y } }
            : roll < 0.3
              ? { type: "treasure", uid: "t1", target: near }
              : { type: "move", dir: rng.pick(DIRS) };
      const res = act(g, action);
      if (res.outcome !== "continue") finishRun(g, res.outcome as "dead" | "home");
      else expect(isFloor(g.run!.floor, g.run!.pos.x, g.run!.pos.y)).toBe(true);
    }
    expect(parseSave(toSave(g))).not.toBeNull();
  });
});
