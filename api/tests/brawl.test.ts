// Stage 25 · Chợ Đêm Brawl: the rules with a fake clock (no network, no database), and the browser's copy.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as B from "../src/arena/brawl.js";

// A simple test player: walks round stalls to the nearest trouble-maker, keeps its distance with a ranged hero,
// steps out of confetti, attacks, uses its special, shops for snacks between areas.
function bot(g: B.BrawlGame, h: B.Hero, now: number) {
  if (h.down) return;
  const face = (x: number, y: number) => { const l = Math.hypot(x, y); if (l > 0.01) { h.fx = x / l; h.fy = y / l; } };
  if (g.phase === "shop") { for (const buff of ["banhmi", "banhxeo", "che", "caphe"] as B.Buff[]) B.act(g, h.id, { a: "buy", buff }, now); B.act(g, h.id, { a: "ready" }, now); return; }
  const down = g.heroes.find((x) => x.down);
  let target: { x: number; y: number } | null = null; let d = Infinity;
  for (const e of g.enemies) { const dd = Math.hypot(e.x - h.x, e.y - h.y); if (dd < d) { d = dd; target = e; } }
  if (down && d > 3) { B.setStick(g, h.id, down.x - h.x, down.y - h.y); return; }
  if (!target) { B.setStick(g, h.id, 0, 0); return; }
  const zone = g.zones.find((z) => Math.hypot(z.x - h.x, z.y - h.y) < z.r + 0.3);
  if (zone) { B.setStick(g, h.id, h.x - zone.x, h.y - zone.y); return; }
  const ranged = h.hero === "student" || h.hero === "grandma";
  const want = ranged ? 3.5 : 0.9;
  let mx = target.x - h.x, my = target.y - h.y;
  if (!B.clearLine(g.area, h.x, h.y, target.x, target.y)) { const f = B.flowField(g.area, [target]); const [fx, fy] = B.flowDir(f, h.x, h.y); B.setStick(g, h.id, fx, fy); return; }
  if (d < want - 0.5) { mx = -mx; my = -my; }
  if (Math.abs(d - want) < 0.5) { mx = 0; my = 0; B.setStick(g, h.id, 0, 0); face(target.x - h.x, target.y - h.y); }
  else B.setStick(g, h.id, mx, my);
  if (d < (ranged ? 6 : 1.6)) { face(target.x - h.x, target.y - h.y); B.act(g, h.id, { a: "attack" }, now); }
  if (h.special >= 100 && (d < 2.5 || h.hero === "grandma" && g.heroes.some((x) => x.hp < x.maxHp * 0.5))) B.act(g, h.id, { a: "special" }, now);
  if (d < 1.0 && Math.random() < 0.15) { face(h.x - target.x, h.y - target.y); B.act(g, h.id, { a: "dodge" }, now); }
}

function play(heroes: B.HeroKind[], seed: number) {
  const g = B.newBrawl(heroes.map((hero, i) => ({ id: "p" + i, name: "P" + i, hero })), seed, 0);
  let now = 0;
  while (g.phase !== "won" && g.phase !== "lost" && now < 3_600_000) {
    now += 50;
    if (now % 100 === 0) for (const h of g.heroes) bot(g, h, now);
    B.stepBrawl(g, now, 50);
  }
  return g;
}
const seat = (hero: B.HeroKind, id = "p0"): B.Seat => ({ id, name: id, hero });
/** A game already fighting in area 0, with no enemies yet */
function arena(heroes: B.HeroKind[]) {
  const g = B.newBrawl(heroes.map((h, i) => seat(h, "p" + i)), 1, 0);
  B.stepBrawl(g, 2500, 50); // the first wave arrives
  g.enemies = [];
  g.phase = "fight";
  return g;
}
function addEnemy(g: B.BrawlGame, kind: B.EnemyKind, x: number, y: number) {
  const info = B.ENEMIES[kind];
  g.enemies.push({ id: g.nextId++, kind, x, y, hp: info.hp, maxHp: info.hp, vx: 0, vy: 0, stunUntil: 0, next: 1e12, dashUntil: 0, dx: 0, dy: 0, spinUntil: 0, hitReady: 1e12 });
  return g.enemies.at(-1)!;
}

describe("Chợ Đêm Brawl", () => {
  it("keeps the browser's copy of the rules identical to the server's", () => {
    const api = readFileSync(path.join(import.meta.dirname, "../src/arena/brawl.ts"), "utf8");
    const web = readFileSync(path.join(import.meta.dirname, "../../web/features/arena/brawl/brawl.ts"), "utf8");
    expect(web).toBe(api);
  });

  it("walking slides along stalls and never leaves the market", () => {
    const [x, y] = B.moveCircle(0, 3.5, 3, 2, 0, 0.36); // stall at x 4..7, y 2..4
    expect(x).toBe(3.5);
    expect(y).toBe(3);
    expect(B.moveCircle(0, 0.5, 0.5, -3, -3, 0.36)).toEqual([0.36, 0.36]);
  });

  it("finds the way round a stall", () => {
    const field = B.flowField(0, [{ x: 8.5, y: 3 }]);
    const [dx] = B.flowDir(field, 3.5, 3); // behind the stall at x 4..7: go round, not into it
    expect(B.clearLine(0, 3.5, 3, 8.5, 3)).toBe(false);
    expect(Number.isFinite(dx)).toBe(true);
    let p: [number, number] = [3.5, 3];
    for (let i = 0; i < 200 && Math.hypot(p[0] - 8.5, p[1] - 3) > 0.6; i++) {
      const [fx, fy] = B.flowDir(field, p[0], p[1]);
      p = B.moveCircle(0, p[0], p[1], fx * 0.1, fy * 0.1, 0.36);
    }
    expect(Math.hypot(p[0] - 8.5, p[1] - 3)).toBeLessThan(0.8);
  });

  it("the chef's ladle bonks enemies in front, not behind; bonks charge the special", () => {
    const g = arena(["chef"]);
    const h = g.heroes[0];
    Object.assign(h, { x: 10, y: 6, fx: 1, fy: 0 });
    const front = addEnemy(g, "rat", 11, 6);
    const back = addEnemy(g, "rat", 9, 6);
    expect(B.act(g, "p0", { a: "attack" }, 3000)).toBeNull();
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(back.hp).toBe(back.maxHp);
    expect(h.special).toBeGreaterThan(0);
    expect(B.act(g, "p0", { a: "attack" }, 3100)).toBe("Not yet"); // cooling down
    expect(B.act(g, "p0", { a: "special" }, 3600)).toBe("Your special isn't ready");
  });

  it("dodging can't be hurt; knocked-down heroes are helped up by a friend in 2 seconds", () => {
    const g = arena(["shipper", "grandma"]);
    const [a, b] = g.heroes;
    Object.assign(a, { x: 10, y: 6 });
    B.act(g, "p0", { a: "dodge" }, 3000);
    const rat = addEnemy(g, "rat", 10.5, 6);
    rat.hitReady = 0;
    const hp = a.hp;
    B.stepBrawl(g, 3050, 50);
    expect(a.hp).toBe(hp);
    // knocked down…
    Object.assign(b, { x: 15, y: 9, hp: 0, down: true });
    g.enemies = [addEnemy(g, "rat", 1, 1)];
    g.enemies[0].stunUntil = 1e12;
    Object.assign(a, { x: 15.5, y: 9 });
    for (let t = 3100; t <= 5200; t += 50) B.stepBrawl(g, t, 50);
    expect(b.down).toBe(false);
    expect(b.hp).toBeGreaterThan(0);
  });

  it("grandma's tea heals friends nearby; the student's storm throws planes all around", () => {
    const g = arena(["grandma", "student"]);
    const [gm, st] = g.heroes;
    Object.assign(gm, { x: 10, y: 6, special: 100 });
    Object.assign(st, { x: 11, y: 6, hp: 20, special: 100 });
    B.act(g, "p0", { a: "special" }, 3000);
    expect(st.hp).toBe(65);
    B.act(g, "p1", { a: "special" }, 3000);
    expect(g.shots.filter((s) => s.kind === "plane")).toHaveLength(12);
  });

  it("balloons pop into confetti that slows; the shop sells snacks between areas", () => {
    const g = arena(["student"]);
    const h = g.heroes[0];
    Object.assign(h, { x: 10, y: 6 });
    const seller = addEnemy(g, "balloon", 15, 6);
    seller.next = 3000;
    for (let t = 3050; t <= 4200; t += 50) B.stepBrawl(g, t, 50);
    expect(g.zones).toHaveLength(1);
    expect(h.slowUntil).toBeGreaterThan(4000);
    // the shop
    g.phase = "shop";
    h.coins = 30;
    expect(B.act(g, "p0", { a: "buy", buff: "banhmi" }, 5000)).toBeNull();
    expect(h.maxHp).toBe(B.HEROES.student.hp + 25);
    expect(B.act(g, "p0", { a: "buy", buff: "che" }, 5000)).toBe("Not enough coins");
    B.act(g, "p0", { a: "ready" }, 5000);
    expect(g.area).toBe(1);
    expect(g.phase).toBe("pause");
  });

  it("a team of four bots clears the whole market; doing nothing loses in the first area", () => {
    for (const seed of [1, 2]) {
      const g = play(["chef", "shipper", "grandma", "student"], seed);
      expect(g.phase).toBe("won");
      expect(B.resultOf(g)).toMatchObject({ areas: 5, won: true });
      expect(B.resultOf(g).bonks).toBeGreaterThan(80);
    }
    const idle = B.newBrawl([seat("chef")], 1, 0);
    let t = 0;
    while (idle.phase !== "lost" && t < 600_000) B.stepBrawl(idle, (t += 50), 50);
    expect(idle.phase).toBe("lost");
    expect(idle.area).toBe(0);
  });

  it("a solo bot gets through the first area with every hero, and no game ever gets stuck", () => {
    for (const hero of B.HERO_KINDS)
      for (const seed of [1, 2, 3]) {
        const g = play([hero], seed);
        expect(["won", "lost"], `${hero} ${seed}`).toContain(g.phase);
        expect(g.heroes.every((h) => Number.isFinite(h.x) && Number.isFinite(h.y))).toBe(true);
      }
    const reached = B.HERO_KINDS.map((hero) => Math.max(...[1, 2, 3].map((s) => play([hero], s).area)));
    expect(Math.min(...reached)).toBeGreaterThanOrEqual(1);
  });
});
