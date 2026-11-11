// One turn in a secret realm or a tribulation: you act, then every enemy acts, then the heavens (in a tribulation).
// act() returns what happened as a list of effects, so the screen can animate them; the rules never draw anything.

import { canStep, clearLine, DIRS, dist, isFloor, line, same, type Grid, type Pos } from "../engine/grid";
import { fieldOfView } from "../engine/fov";
import { findPath } from "../engine/path";
import { makeRng, type Rng } from "../engine/rng";
import {
  ABILITIES,
  ENEMIES,
  enemyStats,
  ITEMS,
  SECRET_REALMS,
  TREASURES,
  type AbilityId,
  type ItemId,
  type RealmId,
  type TechniqueId,
  type TreasureKind,
} from "./data";
import { ARENA, makeArena, makeEnemy, makeFloor } from "./realm";
import { addItem, bagSize, breakThrough, failTribulation, gainCultivation, heal, newTreasure, readyForTribulation, rollGear, stats, useItem } from "./player";
import type { Enemy, Game, Run, Status, StatusKind } from "./types";

export const VIEW_RADIUS = 7;
export const MAX_INTENT = 10;

export type Fx =
  | { type: "hit"; at: Pos; amount: number; crit?: boolean; onPlayer?: boolean }
  | { type: "miss"; at: Pos }
  | { type: "slash"; from: Pos; to: Pos; color?: string }
  | { type: "bolt"; at: Pos }
  | { type: "area"; at: Pos; r: number; color?: string }
  | { type: "heal"; at: Pos; amount: number; qi?: boolean }
  | { type: "die"; at: Pos }
  | { type: "text"; at: Pos; text: string; tone?: "good" | "bad" | "info" | "loot" }
  | { type: "move"; from: Pos; to: Pos };

export type Outcome = "continue" | "dead" | "home" | "won" | "lost";
export type Action =
  | { type: "move"; dir: Pos }
  | { type: "wait" }
  | { type: "use" } // stairs or portal under your feet
  | { type: "ability"; id: AbilityId; target?: Pos }
  | { type: "treasure"; uid: string; target?: Pos }
  | { type: "item"; id: ItemId; target?: Pos };

export type Result = { ok: boolean; fx: Fx[]; outcome: Outcome; reason?: string };

const grid = (r: Run): Grid => r.floor;
const vi = (g: Game, a: string, b: string) => (g.lang === "vi" ? a : b);

function log(g: Game, text: string, tone?: "good" | "bad" | "info" | "loot") {
  const r = g.run!;
  r.log.push({ turn: r.turn, text, tone });
  if (r.log.length > 40) r.log.splice(0, r.log.length - 40);
}

// ---- Status effects ----
const statusOf = (list: Status[], kind: StatusKind) => list.find((s) => s.kind === kind);
function addStatus(list: Status[], kind: StatusKind, turns: number, value: number) {
  const old = statusOf(list, kind);
  if (old) {
    old.turns = Math.max(old.turns, turns);
    old.value = Math.max(old.value, value);
  } else list.push({ kind, turns, value });
}
function tick(list: Status[]) {
  for (const s of list) s.turns--;
  return list.filter((s) => s.turns > 0);
}

// ---- Seeing ----
export function visible(g: Game): Set<number> {
  const r = g.run!;
  return fieldOfView(grid(r), r.pos, VIEW_RADIUS);
}
function markSeen(g: Game) {
  const r = g.run!;
  const seen = r.floor.seen.split("");
  for (const i of visible(g)) seen[i] = "1";
  r.floor.seen = seen.join("");
}
export const enemyAt = (r: Run, p: Pos) => r.floor.enemies.find((e) => same(e.pos, p));

// ---- Damage ----
export function damage(atk: number, def: number, rng: Rng, mult = 1, crit = 0) {
  const base = atk * mult * (0.9 + rng.next() * 0.2);
  let amount = Math.max(1, Math.round(base - def * 0.5));
  const isCrit = rng.chance(crit / 100);
  if (isCrit) amount = Math.round(amount * 1.6);
  return { amount, crit: isCrit };
}

function enemyDef(e: Enemy) {
  const d = enemyStats(e.kind, e.level).def;
  return statusOf(e.status, "weak") ? d * 0.4 : d;
}
function enemyAtk(g: Game, e: Enemy) {
  if (e.kind === "tam-ma") return stats(g.player).atk * 0.8;
  const a = enemyStats(e.kind, e.level).atk;
  return ENEMIES[e.kind].boss && e.hp < e.maxHp / 2 ? a * 1.3 : a; // bosses get angry when hurt
}

function hitEnemy(g: Game, rng: Rng, e: Enemy, mult: number, fx: Fx[], opts: { fixed?: number; intent?: boolean } = {}) {
  const p = g.player;
  const s = stats(p);
  const times = opts.fixed === undefined && statusOf(g.run!.status, "echo") ? 2 : 1;
  for (let i = 0; i < times && e.hp > 0; i++) {
    const { amount, crit } =
      opts.fixed !== undefined ? { amount: opts.fixed, crit: false } : damage(s.atk * (1 + 0.03 * p.intent), enemyDef(e), rng, mult, s.crit);
    e.hp -= amount;
    e.awake = true;
    fx.push({ type: "hit", at: { ...e.pos }, amount, crit });
  }
  if (times === 2) {
    const echo = statusOf(g.run!.status, "echo")!;
    echo.value--;
    if (echo.value <= 0) echo.turns = 0;
  }
  if (opts.intent !== false && opts.fixed === undefined) p.intent = Math.min(MAX_INTENT, p.intent + 1);
  if (e.hp <= 0) kill(g, rng, e, fx);
}

function kill(g: Game, rng: Rng, e: Enemy, fx: Fx[]) {
  const r = g.run!;
  const p = g.player;
  const info = ENEMIES[e.kind];
  r.floor.enemies = r.floor.enemies.filter((x) => x !== e);
  fx.push({ type: "die", at: { ...e.pos } });
  r.loot.kills++;
  p.record.kills++;
  const name = vi(g, info.vi, info.en);
  if (e.kind === "tam-ma") {
    log(g, vi(g, "Tâm Ma tan biến. Đạo tâm vững như bàn thạch!", "The Heart Demon fades. Your heart is steady as rock!"), "good");
    return;
  }
  const tuvi = 6 + 4 * e.level;
  r.loot.cultivation += tuvi;
  const layers = readyForTribulation(p) ? 0 : gainCultivation(p, tuvi);
  log(g, vi(g, `Hạ ${name}. +${tuvi} tu vi.`, `Defeated ${name}. +${tuvi} cultivation.`), "good");
  if (layers) {
    heal(g);
    log(g, vi(g, `Đột phá! Giờ là Luyện Khí tầng ${p.layer}.`, `Breakthrough! Now Qi Refining ${p.layer}.`), "good");
    fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Đột phá!", "Breakthrough!"), tone: "good" });
  }
  if (rng.chance(0.4)) {
    const n = 2 + e.level * 2;
    r.loot.stones += n;
    fx.push({ type: "text", at: { ...e.pos }, text: `+${n} 💎`, tone: "loot" });
  }
  if (info.beast && rng.chance(0.35)) addItem(r.loot.bag, "yeu-dan");
  if (rng.chance(0.12)) {
    r.loot.gear.push(rollGear(g, rng, Math.floor((r.floor.depth - 1) / 1.2)));
    log(g, vi(g, "Rơi ra một món trang bị.", "It dropped a piece of gear."), "loot");
  }
  if (info.boss) {
    const kinds = Object.keys(TREASURES) as TreasureKind[];
    const owned = new Set([...p.treasures, ...r.loot.treasures].map((t) => t.kind));
    const kind = kinds.find((k) => !owned.has(k)) ?? rng.pick(kinds);
    r.loot.treasures.push(newTreasure(g, kind, owned.has(kind) ? 1 : 0));
    r.loot.stones += 150;
    addItem(r.loot.bag, "truc-co-dan");
    addItem(r.loot.bag, "yeu-dan", 3);
    const known = new Set(p.techniques.map((t) => t.id));
    const slip: ItemId | null = !known.has("xich-diem") ? "ngoc-gian-xd" : !known.has("huyen-thuy") ? "ngoc-gian-ht" : null;
    if (slip) addItem(r.loot.bag, slip);
    r.loot.gear.push(rollGear(g, rng, 3, 0.3));
    r.floor.things.push({ uid: `p-boss-${r.turn}`, kind: "portal", pos: { ...e.pos } });
    log(
      g,
      vi(
        g,
        `Mãng Vương ngã xuống! Nhận ${TREASURES[kind].vi}, Trúc Cơ Đan và nhiều bảo vật. Một trận truyền tống hiện ra.`,
        `The Python King falls! You get ${TREASURES[kind].en}, a Foundation Pill and more. A return array appears.`,
      ),
      "loot",
    );
  }
}

// Damage to you: block, shield and mirror first
function hurtPlayer(g: Game, rng: Rng, amount: number, fx: Fx[], from?: Enemy) {
  const r = g.run!;
  const p = g.player;
  const block = statusOf(r.status, "block");
  if (block) {
    block.turns = 0;
    r.status = r.status.filter((s) => s !== block);
    fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Chặn!", "Blocked!"), tone: "info" });
    return;
  }
  const shield = statusOf(r.status, "shield");
  if (shield) {
    const absorbed = Math.min(shield.value, amount);
    shield.value -= absorbed;
    amount -= absorbed;
    if (shield.value <= 0) shield.turns = 0;
  }
  if (from) {
    const mirror = statusOf(r.status, "reflect");
    if (mirror && amount > 0) hitEnemy(g, rng, from, 0, fx, { fixed: Math.max(1, Math.round((amount * mirror.value) / 100)) });
  }
  p.hp -= amount;
  fx.push({ type: "hit", at: { ...r.pos }, amount, onPlayer: true });
}

// ---- Starting and ending a run ----
export function startRun(g: Game, realm: RealmId = "vu-an-coc") {
  const rng = makeRng(g.rng);
  const { floor, start } = makeFloor(g, rng, realm, 1);
  g.run = {
    kind: "realm",
    realm,
    floor,
    pos: start,
    turn: 0,
    cooldowns: {},
    status: [],
    loot: { stones: 0, bag: {}, gear: [], treasures: [], cultivation: 0, kills: 0 },
    log: [],
  };
  g.player.record.runs++;
  g.player.intent = 0;
  g.rng = rng.state();
  log(g, vi(g, `Bước vào ${SECRET_REALMS[realm].vi}, tầng 1. Sương mù dày đặc…`, `You enter the ${SECRET_REALMS[realm].en}, floor 1. Thick mist…`), "info");
  markSeen(g);
}

export const TRIBULATION_TURNS = 15;
export function startTribulation(g: Game): boolean {
  if (!readyForTribulation(g.player)) return false;
  const { floor, start } = makeArena();
  g.run = {
    kind: "tribulation",
    realm: "vu-an-coc",
    floor,
    pos: start,
    turn: 0,
    cooldowns: {},
    status: [],
    loot: { stones: 0, bag: {}, gear: [], treasures: [], cultivation: 0, kills: 0 },
    log: [],
    strikes: [],
    survived: 0,
    goal: TRIBULATION_TURNS,
    demon: false,
  };
  heal(g);
  g.player.intent = 0;
  log(
    g,
    vi(
      g,
      `Thiên kiếp giáng xuống! Né sét ${TRIBULATION_TURNS} lượt, rồi vượt qua Tâm Ma.`,
      `The tribulation begins! Dodge the lightning for ${TRIBULATION_TURNS} turns, then face your Heart Demon.`,
    ),
    "bad",
  );
  const rng = makeRng(g.rng);
  planStrikes(g, rng);
  g.rng = rng.state();
  return true;
}

// Back home: keep the loot ("home") or lose it ("dead"). Tribulations end in "won" or "lost".
export function finishRun(g: Game, outcome: Exclude<Outcome, "continue">) {
  const r = g.run;
  if (!r) return;
  const p = g.player;
  if (outcome === "home") {
    p.stones += r.loot.stones;
    for (const [id, n] of Object.entries(r.loot.bag) as [ItemId, number][]) addItem(p.bag, id, n);
    p.treasures.push(...r.loot.treasures);
    let sold = 0;
    for (const item of r.loot.gear) {
      if (p.gear.length < bagSize(p)) p.gear.push(item);
      else {
        sold++;
        p.stones += 5;
      }
    }
    g.notice = vi(
      g,
      `Trở về động phủ: +${r.loot.stones} linh thạch, ${r.loot.gear.length} trang bị${sold ? ` (${sold} bán vì túi đầy)` : ""}, +${r.loot.cultivation} tu vi.`,
      `Home again: +${r.loot.stones} spirit stones, ${r.loot.gear.length} pieces of gear${sold ? ` (${sold} sold, bag full)` : ""}, +${r.loot.cultivation} cultivation.`,
    );
  } else if (outcome === "dead") {
    p.record.deaths++;
    g.notice = vi(
      g,
      `Bạn trọng thương, được đưa về động phủ. Mất chiến lợi phẩm của chuyến này, nhưng giữ được ${r.loot.cultivation} tu vi.`,
      `Badly hurt, you're carried home. This run's loot is lost, but you keep ${r.loot.cultivation} cultivation.`,
    );
  } else if (outcome === "won") {
    breakThrough(g);
    g.notice = vi(
      g,
      "Độ kiếp thành công! Bạn đã Trúc Cơ. Sinh lực, linh lực và số ô thần thông, pháp bảo đều tăng.",
      "Tribulation passed! You reached Foundation. More life, qi, skill and treasure slots.",
    );
  } else {
    failTribulation(g);
    g.notice = vi(
      g,
      "Độ kiếp thất bại. Mất một phần tu vi; hãy hồi phục rồi thử lại.",
      "The tribulation failed. You lost some cultivation; rest and try again.",
    );
  }
  if (outcome !== "won" && outcome !== "lost") heal(g);
  p.record.deepest = Math.max(p.record.deepest, r.kind === "realm" ? r.floor.depth : 0);
  p.intent = 0;
  g.run = null;
}

// ---- Your turn ----
export function act(g: Game, action: Action): Result {
  const r = g.run;
  if (!r) return { ok: false, fx: [], outcome: "continue", reason: "no run" };
  const rng = makeRng(g.rng);
  const fx: Fx[] = [];
  const res = playerAction(g, rng, action, fx);
  if (!res.ok) {
    g.rng = rng.state();
    return { ok: false, fx, outcome: "continue", reason: res.reason };
  }
  if (res.outcome) {
    g.rng = rng.state();
    if (res.outcome !== "continue") return { ok: true, fx, outcome: res.outcome };
    return { ok: true, fx, outcome: "continue" };
  }
  const outcome = endTurn(g, rng, fx);
  g.rng = rng.state();
  return { ok: true, fx, outcome };
}

type Step = { ok: boolean; reason?: string; outcome?: Outcome };

function playerAction(g: Game, rng: Rng, a: Action, fx: Fx[]): Step {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);

  if (a.type === "wait") {
    p.qi = Math.min(s.qi, p.qi + 1); // resting gathers a little extra qi
    return { ok: true };
  }

  if (a.type === "move") {
    const to = { x: r.pos.x + a.dir.x, y: r.pos.y + a.dir.y };
    const foe = enemyAt(r, to);
    if (foe) {
      fx.push({ type: "slash", from: { ...r.pos }, to });
      hitEnemy(g, rng, foe, 1, fx);
      return { ok: true };
    }
    if (!canStep(grid(r), r.pos, a.dir)) return { ok: false, reason: "wall" };
    fx.push({ type: "move", from: { ...r.pos }, to });
    r.pos = to;
    stepOn(g, rng, fx);
    return { ok: true };
  }

  if (a.type === "use") {
    const thing = r.floor.things.find((t) => same(t.pos, r.pos) && (t.kind === "stairs" || t.kind === "portal"));
    if (!thing) return { ok: false, reason: "nothing here" };
    if (thing.kind === "portal") return { ok: true, outcome: "home" };
    const { floor, start } = makeFloor(g, rng, r.realm, r.floor.depth + 1);
    r.floor = floor;
    r.pos = start;
    p.record.deepest = Math.max(p.record.deepest, floor.depth);
    log(g, vi(g, `Xuống tầng ${floor.depth}. Linh khí đậm hơn, nguy hiểm cũng vậy.`, `Down to floor ${floor.depth}. Richer qi, greater danger.`), "info");
    markSeen(g);
    return { ok: true, outcome: "continue" };
  }

  if (a.type === "item") return useItemInRun(g, rng, a.id, a.target, fx);
  if (a.type === "treasure") return useTreasure(g, rng, a.uid, a.target, fx);
  return useAbility(g, rng, a.id, a.target, fx);
}

// Picking things up and springing traps
function stepOn(g: Game, rng: Rng, fx: Fx[]) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  for (const t of r.floor.things.filter((x) => same(x.pos, r.pos))) {
    if (t.kind === "herb") {
      const amount = Math.ceil(s.hp * 0.1);
      p.hp = Math.min(s.hp, p.hp + amount);
      if (!readyForTribulation(p)) gainCultivation(p, 15);
      r.loot.cultivation += 15;
      fx.push({ type: "heal", at: { ...r.pos }, amount });
      log(g, vi(g, "Hái linh thảo: hồi sinh lực, +15 tu vi.", "Picked a spirit herb: some life back, +15 cultivation."), "good");
    } else if (t.kind === "stones") {
      r.loot.stones += t.amount ?? 5;
      fx.push({ type: "text", at: { ...r.pos }, text: `+${t.amount} 💎`, tone: "loot" });
    } else if (t.kind === "chest") {
      openChest(g, rng, fx);
    } else if (t.kind === "trap") {
      const amount = Math.ceil(s.hp * 0.12);
      t.hidden = false;
      hurtPlayer(g, rng, amount, fx);
      fx.push({ type: "area", at: { ...r.pos }, r: 1, color: "#b8432f" });
      log(g, vi(g, "Dẫm phải sát trận!", "You stepped on a hidden killing array!"), "bad");
      continue; // traps stay (now visible)
    } else continue;
    r.floor.things = r.floor.things.filter((x) => x !== t);
  }
}

function openChest(g: Game, rng: Rng, fx: Fx[]) {
  const r = g.run!;
  const depth = r.floor.depth;
  const n = 10 + depth * 8 + rng.int(0, 10);
  r.loot.stones += n;
  const found: string[] = [`${n} ${vi(g, "linh thạch", "spirit stones")}`];
  const roll = rng.next();
  if (roll < 0.45) {
    const id = rng.pick<ItemId>(["hoi-xuan", "hoi-linh", "tu-khi", "hoi-xuan"]);
    addItem(r.loot.bag, id);
    found.push(vi(g, ITEMS[id].vi, ITEMS[id].en));
  } else if (roll < 0.85) {
    const item = rollGear(g, rng, Math.floor((depth - 1) / 1.2), 0.1);
    r.loot.gear.push(item);
    found.push(item.name);
  } else {
    const id = rng.pick<ItemId>(["bao-linh-phu", "truyen-tong-phu"]);
    addItem(r.loot.bag, id);
    found.push(vi(g, ITEMS[id].vi, ITEMS[id].en));
  }
  if (depth >= 3 && rng.chance(0.08)) {
    const known = new Set(g.player.techniques.map((t) => t.id));
    const slip = !known.has("xich-diem") ? "ngoc-gian-xd" : !known.has("huyen-thuy") ? "ngoc-gian-ht" : null;
    if (slip) {
      addItem(r.loot.bag, slip);
      found.push(vi(g, ITEMS[slip].vi, ITEMS[slip].en));
    }
  }
  fx.push({ type: "text", at: { ...r.pos }, text: "🎁", tone: "loot" });
  log(g, vi(g, `Mở rương: ${found.join(", ")}.`, `Opened a chest: ${found.join(", ")}.`), "loot");
}

// ---- Thần thông ----
export function abilityTargets(g: Game, kind: "line" | "dash" | "enemy" | "area" | "adjacent" | "self", range: number): Pos[] {
  const r = g.run!;
  const seen = visible(g);
  const out: Pos[] = [];
  if (kind === "self") return [r.pos];
  if (kind === "enemy" || kind === "adjacent") {
    for (const e of r.floor.enemies) {
      const d = dist(e.pos, r.pos);
      if (d > range || !seen.has(e.pos.y * r.floor.w + e.pos.x)) continue;
      if (kind === "enemy" && !clearLine(grid(r), r.pos, e.pos)) continue;
      out.push(e.pos);
    }
    return out;
  }
  if (kind === "line" || kind === "dash") return DIRS.map((d) => ({ x: r.pos.x + d.x, y: r.pos.y + d.y })).filter((p) => isFloor(grid(r), p.x, p.y));
  for (const i of seen) {
    const p = { x: i % r.floor.w, y: Math.floor(i / r.floor.w) };
    if (dist(p, r.pos) <= range && isFloor(grid(r), p.x, p.y)) out.push(p);
  }
  return out;
}

// The direction from you towards a tapped tile: one of 8
const dirTo = (from: Pos, to: Pos): Pos => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) });

function useAbility(g: Game, rng: Rng, id: AbilityId, target: Pos | undefined, fx: Fx[]): Step {
  const r = g.run!;
  const p = g.player;
  const a = ABILITIES[id];
  const s = stats(p);
  if (!p.skills.includes(id)) return { ok: false, reason: "not equipped" };
  if ((r.cooldowns[id] ?? 0) > 0) return { ok: false, reason: "cooldown" };
  if (p.qi < a.qi) return { ok: false, reason: "qi" };

  switch (id) {
    case "kiem-khi": {
      if (!target || same(target, r.pos)) return { ok: false, reason: "target" };
      const d = dirTo(r.pos, target);
      let cur = r.pos;
      const path: Pos[] = [];
      for (let i = 0; i < a.range; i++) {
        const n = { x: cur.x + d.x, y: cur.y + d.y };
        if (!isFloor(grid(r), n.x, n.y)) break;
        path.push(n);
        cur = n;
      }
      if (!path.length) return { ok: false, reason: "wall" };
      fx.push({ type: "slash", from: { ...r.pos }, to: path[path.length - 1], color: "#3f7d6a" });
      for (const pos of path) {
        const e = enemyAt(r, pos);
        if (e) hitEnemy(g, rng, e, 1.3, fx);
      }
      break;
    }
    case "ngu-kiem": {
      if (!target || same(target, r.pos)) return { ok: false, reason: "target" };
      const d = dirTo(r.pos, target);
      let cur = r.pos;
      for (let i = 0; i < a.range; i++) {
        const n = { x: cur.x + d.x, y: cur.y + d.y };
        if (!canStep(grid(r), cur, d) || enemyAt(r, n)) break;
        cur = n;
      }
      if (same(cur, r.pos)) return { ok: false, reason: "blocked" };
      fx.push({ type: "move", from: { ...r.pos }, to: { ...cur } });
      fx.push({ type: "slash", from: { ...r.pos }, to: { ...cur }, color: "#7aa7c7" });
      r.pos = cur;
      stepOn(g, rng, fx);
      break;
    }
    case "kiem-vu": {
      if (!target || dist(target, r.pos) > a.range || !visible(g).has(target.y * r.floor.w + target.x)) return { ok: false, reason: "target" };
      fx.push({ type: "area", at: { ...target }, r: 1, color: "#3f6f9a" });
      for (const e of [...r.floor.enemies]) if (dist(e.pos, target) <= 1) hitEnemy(g, rng, e, 0.9, fx);
      break;
    }
    case "luu-quang":
      addStatus(r.status, "echo", 12, 3);
      fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Kiếm ảnh!", "Afterimage!"), tone: "good" });
      break;
    case "liet-diem":
    case "boc-phat": {
      const e = target && enemyAt(r, target);
      if (!e || dist(e.pos, r.pos) > 1) return { ok: false, reason: "target" };
      fx.push({ type: "slash", from: { ...r.pos }, to: { ...e.pos }, color: id === "liet-diem" ? "#c4562f" : "#a8231b" });
      if (id === "liet-diem") {
        addStatus(e.status, "burn", 3, Math.max(1, Math.round(s.atk * 0.25)));
        hitEnemy(g, rng, e, 1.2, fx);
      } else {
        const power = 1 + 0.25 * p.intent;
        p.intent = 0;
        hitEnemy(g, rng, e, power, fx, { intent: false });
      }
      break;
    }
    case "ho-the":
      addStatus(r.status, "shield", 3, Math.round(s.def * 2 + 10 + s.hp * 0.1));
      fx.push({ type: "area", at: { ...r.pos }, r: 0, color: "#7aa7c7" });
      break;
    case "bang-tam": {
      const amount = Math.ceil(s.hp * 0.25);
      p.hp = Math.min(s.hp, p.hp + amount);
      fx.push({ type: "heal", at: { ...r.pos }, amount });
      break;
    }
  }
  p.qi -= a.qi;
  if (a.cooldown) r.cooldowns[id] = a.cooldown + 1; // +1: this turn's tick
  return { ok: true };
}

// ---- Pháp bảo ----
function useTreasure(g: Game, rng: Rng, uid: string, target: Pos | undefined, fx: Fx[]): Step {
  const r = g.run!;
  const p = g.player;
  const t = p.treasures.find((x) => x.uid === uid);
  if (!t || !p.bound.includes(uid)) return { ok: false, reason: "not bound" };
  if ((r.cooldowns[uid] ?? 0) > 0) return { ok: false, reason: "cooldown" };
  const info = TREASURES[t.kind];
  const s = stats(p);
  const power = 1 + 0.35 * t.grade + 0.05 * t.level;
  switch (t.kind) {
    case "thanh-hong": {
      const e = target && enemyAt(r, target);
      if (!e || dist(e.pos, r.pos) > info.range || !clearLine(grid(r), r.pos, e.pos)) return { ok: false, reason: "target" };
      fx.push({ type: "slash", from: { ...r.pos }, to: { ...e.pos }, color: "#4f8a9a" });
      hitEnemy(g, rng, e, 1.2 * power, fx);
      break;
    }
    case "tran-hon":
      fx.push({ type: "area", at: { ...r.pos }, r: info.range, color: "#b59a4a" });
      for (const e of r.floor.enemies) if (dist(e.pos, r.pos) <= info.range) addStatus(e.status, "stun", 1 + Math.floor(t.grade / 2), 1);
      break;
    case "tu-kim": {
      const amount = Math.ceil(s.qi * 0.3 * power);
      p.qi = Math.min(s.qi, p.qi + amount);
      fx.push({ type: "heal", at: { ...r.pos }, amount, qi: true });
      break;
    }
    case "bat-quai":
      addStatus(r.status, "reflect", 3, Math.round(40 * power));
      fx.push({ type: "area", at: { ...r.pos }, r: 0, color: "#b59a4a" });
      break;
    case "hoan-linh":
      fx.push({ type: "area", at: { ...r.pos }, r: info.range, color: "#7a3fa0" });
      for (const e of r.floor.enemies) if (dist(e.pos, r.pos) <= info.range) addStatus(e.status, "weak", 3, 1);
      break;
    case "huyen-quy":
      addStatus(r.status, "block", 99, 1);
      fx.push({ type: "area", at: { ...r.pos }, r: 0, color: "#3f6f5a" });
      break;
  }
  r.cooldowns[uid] = info.cooldown + 1;
  return { ok: true };
}

// ---- Items in a run (from the bag you brought, or found in this run) ----
export function runBagCount(g: Game, id: ItemId) {
  return (g.player.bag[id] ?? 0) + (g.run?.loot.bag[id] ?? 0);
}
function takeItem(g: Game, id: ItemId) {
  const r = g.run!;
  if ((r.loot.bag[id] ?? 0) > 0) {
    r.loot.bag[id]!--;
    if (!r.loot.bag[id]) delete r.loot.bag[id];
    return true;
  }
  return useItem(g.player, id);
}

function useItemInRun(g: Game, rng: Rng, id: ItemId, target: Pos | undefined, fx: Fx[]): Step {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  if (runBagCount(g, id) < 1) return { ok: false, reason: "none" };
  switch (id) {
    case "hoi-xuan": {
      const amount = Math.ceil(s.hp * 0.4);
      p.hp = Math.min(s.hp, p.hp + amount);
      fx.push({ type: "heal", at: { ...r.pos }, amount });
      break;
    }
    case "hoi-linh": {
      const amount = Math.ceil(s.qi * 0.5);
      p.qi = Math.min(s.qi, p.qi + amount);
      fx.push({ type: "heal", at: { ...r.pos }, amount, qi: true });
      break;
    }
    case "tu-khi":
      if (readyForTribulation(p)) return { ok: false, reason: "full" };
      gainCultivation(p, 60);
      r.loot.cultivation += 60;
      fx.push({ type: "text", at: { ...r.pos }, text: "+60", tone: "good" });
      break;
    case "truc-co-dan":
      if (r.kind !== "tribulation" || r.pill) return { ok: false, reason: "only in tribulation" };
      r.pill = true;
      addStatus(r.status, "shield", 10, Math.round(s.hp * 0.3));
      p.hp = Math.min(s.hp, p.hp + Math.round(s.hp * 0.3));
      fx.push({ type: "area", at: { ...r.pos }, r: 0, color: "#b59a4a" });
      log(g, vi(g, "Nuốt Trúc Cơ Đan: linh lực cuồn cuộn bảo vệ thân thể.", "You swallow the Foundation Pill: qi surges to guard you."), "good");
      break;
    case "bao-linh-phu": {
      const e = target && enemyAt(r, target);
      if (!e || dist(e.pos, r.pos) > 6) return { ok: false, reason: "target" };
      const fixed = Math.round(25 + 4 * (p.major * 9 + p.layer) + r.floor.depth * 6);
      fx.push({ type: "area", at: { ...e.pos }, r: 1, color: "#c4562f" });
      for (const x of [...r.floor.enemies]) if (dist(x.pos, e.pos) <= 1) hitEnemy(g, rng, x, 0, fx, { fixed });
      break;
    }
    case "truyen-tong-phu":
      if (r.kind === "tribulation") return { ok: false, reason: "not now" };
      takeItem(g, id);
      return { ok: true, outcome: "home" };
    default:
      return { ok: false, reason: "can't use" };
  }
  takeItem(g, id);
  return { ok: true };
}

// ---- Everyone else's turn ----
function endTurn(g: Game, rng: Rng, fx: Fx[]): Outcome {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  r.turn++;
  for (const k of Object.keys(r.cooldowns)) {
    r.cooldowns[k] = Math.max(0, (r.cooldowns[k] ?? 0) - 1);
    if (!r.cooldowns[k]) delete r.cooldowns[k];
  }
  if (r.turn % 2 === 0) p.qi = Math.min(s.qi, p.qi + Math.max(1, Math.round(s.qiRegen * 2)));

  for (const e of [...r.floor.enemies]) {
    if (!r.floor.enemies.includes(e)) continue;
    // Burning
    const burn = statusOf(e.status, "burn");
    if (burn) {
      e.hp -= burn.value;
      fx.push({ type: "hit", at: { ...e.pos }, amount: burn.value });
      if (e.hp <= 0) {
        kill(g, rng, e, fx);
        continue;
      }
    }
    const stunned = !!statusOf(e.status, "stun");
    e.status = tick(e.status);
    if (stunned) continue;
    const moves = ENEMIES[e.kind].fast && r.turn % 2 === 0 ? 2 : 1;
    for (let i = 0; i < moves && p.hp > 0 && r.floor.enemies.includes(e); i++) enemyAct(g, rng, e, fx);
  }
  r.status = tick(r.status);

  if (r.kind === "tribulation") tribulationTurn(g, rng, fx);
  markSeen(g);

  if (p.hp <= 0) {
    p.hp = 0;
    return r.kind === "tribulation" ? "lost" : "dead";
  }
  if (r.kind === "tribulation" && r.demon && !r.floor.enemies.some((e) => e.kind === "tam-ma")) return "won";
  return "continue";
}

function enemyAct(g: Game, rng: Rng, e: Enemy, fx: Fx[]) {
  const r = g.run!;
  const info = ENEMIES[e.kind];
  const d = dist(e.pos, r.pos);
  const sees = d <= 8 && (info.ghost || clearLine(grid(r), e.pos, r.pos));
  if (!e.awake) {
    if (sees && rng.chance(0.8)) {
      e.awake = true;
      fx.push({ type: "text", at: { ...e.pos }, text: "!", tone: "bad" });
    } else if (rng.chance(0.25)) wander(g, rng, e);
    return;
  }
  const occupied = (p: Pos) => same(p, r.pos) || r.floor.enemies.some((x) => x !== e && same(x.pos, p));
  // Hurt rogue cultivators run away
  if (info.flees && e.hp < e.maxHp * 0.3 && d <= 4) {
    const away = DIRS.map((dir) => ({ dir, to: { x: e.pos.x + dir.x, y: e.pos.y + dir.y } }))
      .filter(({ dir, to }) => canStep(grid(r), e.pos, dir) && !occupied(to))
      .sort((a, b) => dist(b.to, r.pos) - dist(a.to, r.pos))[0];
    if (away && dist(away.to, r.pos) > d) {
      e.pos = away.to;
      return;
    }
  }
  if (d <= info.range && (d === 1 || clearLine(grid(r), e.pos, r.pos))) {
    attackPlayer(g, rng, e, fx, d > 1);
    return;
  }
  if (!sees && d > 12) return; // lost you
  let next: Pos | undefined;
  if (info.ghost) {
    const step = dirTo(e.pos, r.pos);
    const to = { x: e.pos.x + step.x, y: e.pos.y + step.y };
    if (to.x > 0 && to.y > 0 && to.x < r.floor.w - 1 && to.y < r.floor.h - 1 && !occupied(to)) next = to;
  } else next = findPath(grid(r), e.pos, r.pos, { blocked: occupied, maxSteps: 600 })?.[0];
  if (next && !same(next, r.pos) && !occupied(next)) e.pos = next;
}

function wander(g: Game, rng: Rng, e: Enemy) {
  const r = g.run!;
  const dir = rng.pick(DIRS);
  const to = { x: e.pos.x + dir.x, y: e.pos.y + dir.y };
  if (canStep(grid(r), e.pos, dir) && !same(to, r.pos) && !r.floor.enemies.some((x) => same(x.pos, to))) e.pos = to;
}

function attackPlayer(g: Game, rng: Rng, e: Enemy, fx: Fx[], ranged: boolean) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  if (ranged) fx.push({ type: "slash", from: { ...e.pos }, to: { ...r.pos }, color: "#6b5a7a" });
  // A little chance to dodge, better at higher realms
  if (rng.chance(0.06 + p.major * 0.04)) {
    fx.push({ type: "miss", at: { ...r.pos } });
    return;
  }
  const { amount } = damage(enemyAtk(g, e), s.def, rng, ranged ? 0.85 : 1, 5);
  hurtPlayer(g, rng, amount, fx, e);
  if (ENEMIES[e.kind].drains) p.qi = Math.max(0, p.qi - 3);
  if (p.hp <= 0) log(g, vi(g, `${ENEMIES[e.kind].vi} đánh gục bạn…`, `The ${ENEMIES[e.kind].en} strikes you down…`), "bad");
}

// ---- The tribulation (thiên kiếp) ----
function planStrikes(g: Game, rng: Rng) {
  const r = g.run!;
  const wave = Math.floor((r.survived ?? 0) / 5);
  const count = r.demon ? 4 : 9 + wave * 4;
  const out: Pos[] = [];
  if (!r.demon || rng.chance(0.5)) {
    if (rng.chance(0.65)) out.push({ ...r.pos }); // the sky aims at you: move!
  }
  for (let tries = 0; out.length < count && tries < 200; tries++) {
    const p = { x: rng.int(1, ARENA - 2), y: rng.int(1, ARENA - 2) };
    if (isFloor(grid(r), p.x, p.y) && !out.some((o) => same(o, p))) out.push(p);
  }
  r.strikes = out;
}

function tribulationTurn(g: Game, rng: Rng, fx: Fx[]) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  for (const pos of r.strikes ?? []) {
    fx.push({ type: "bolt", at: pos });
    if (same(pos, r.pos)) {
      hurtPlayer(g, rng, Math.ceil(s.hp * 0.22), fx);
      log(g, vi(g, "Thiên lôi đánh trúng!", "Heavenly lightning hits you!"), "bad");
    }
    const e = enemyAt(r, pos);
    if (e) hitEnemy(g, rng, e, 0, fx, { fixed: Math.ceil(e.maxHp * 0.15) });
  }
  r.survived = (r.survived ?? 0) + 1;
  if (!r.demon && r.survived >= (r.goal ?? TRIBULATION_TURNS)) {
    r.demon = true;
    const spot = DIRS.map((d) => ({ x: r.pos.x + d.x * 3, y: r.pos.y + d.y * 3 })).find((q) => isFloor(grid(r), q.x, q.y)) ?? { x: 2, y: 6 };
    const demon = makeEnemy(g, "tam-ma", 1, spot);
    demon.maxHp = demon.hp = Math.round(s.hp * 0.75);
    demon.awake = true;
    r.floor.enemies.push(demon);
    fx.push({ type: "text", at: spot, text: vi(g, "Tâm Ma!", "Heart Demon!"), tone: "bad" });
    log(g, vi(g, "Sấm sét dịu đi… Tâm Ma của bạn hiện hình. Đánh bại nó!", "The thunder eases… your Heart Demon takes shape. Defeat it!"), "bad");
  }
  planStrikes(g, rng);
}

// Used by the tests and the screen to know which method an ability comes from
export const abilitySource = (id: AbilityId): TechniqueId => ABILITIES[id].from[0];
