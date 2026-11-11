// One turn in a secret realm or a tribulation: you act, your soldiers act, every enemy acts, then the sky (in a tribulation).
// act() returns what happened as a list of effects, so the screen can animate them; the rules never draw anything.
//
// Stage 17: abilities and treasure powers are data (paths.ts) carried out by applyEffect(); each path's resource
// (kiếm ý, khí huyết, chính khí, đạo vận, công đức, quân lệnh) is gained and used by the hooks marked "path:".

import { fieldOfView } from "../engine/fov";
import { canStep, clearLine, DIRS, dist, isFloor, same, type Grid, type Pos } from "../engine/grid";
import { findPath } from "../engine/path";
import { makeRng, type Rng } from "../engine/rng";
import {
  ABILITIES,
  ALLIES,
  ENEMIES,
  enemyStats,
  ITEMS,
  MAJOR_REALMS,
  MAX_RESOURCE,
  realmInfo,
  SPIRITS,
  stonesFor,
  TREASURES,
  tuviFor,
  type AbilityId,
  type AllyKind,
  type Effect,
  type ItemId,
  type RealmId,
  type TechniqueId,
  type TreasureKind,
} from "./data";
import { ARENA, makeArena, makeEnemy, makeFloor } from "./realm";
import {
  abilityQi,
  addItem,
  atPeak,
  bagSize,
  breakThrough,
  failTribulation,
  gainCultivation,
  heal,
  meditateGain,
  needed,
  newTreasure,
  newUid,
  readyForTribulation,
  rollGear,
  stats,
  unknownSlip,
  useItem,
} from "./player";
import { BLOCKING, type Ally, type Enemy, type Game, type Run, type Status, type StatusKind, type Thing } from "./types";

export const VIEW_RADIUS = 7;
export const MAX_INTENT = MAX_RESOURCE;

export type Fx =
  | { type: "hit"; at: Pos; amount: number; crit?: boolean; onPlayer?: boolean }
  | { type: "miss"; at: Pos }
  | { type: "slash"; from: Pos; to: Pos; color?: string }
  | { type: "bolt"; at: Pos }
  | { type: "area"; at: Pos; r: number; color?: string }
  | { type: "heal"; at: Pos; amount: number; qi?: boolean }
  | { type: "die"; at: Pos }
  | { type: "text"; at: Pos; text: string; tone?: "good" | "bad" | "info" | "loot" }
  | { type: "move"; from: Pos; to: Pos }
  | { type: "summon"; at: Pos }
  | { type: "break"; at: Pos; kind: "urn" | "crate" }
  | { type: "bless"; at: Pos };

export type Outcome = "continue" | "dead" | "home" | "won" | "lost";
export type Action =
  | { type: "move"; dir: Pos }
  | { type: "wait" }
  | { type: "use" } // stairs or portal under your feet
  | { type: "ability"; id: AbilityId; target?: Pos }
  | { type: "treasure"; uid: string; target?: Pos }
  | { type: "item"; id: ItemId; target?: Pos }
  | { type: "buy"; uid: string; index: number }; // Stage 18: from a wandering merchant (takes no turn)

export type Result = { ok: boolean; fx: Fx[]; outcome: Outcome; reason?: string; shop?: string };

const grid = (r: Run): Grid => r.floor;
const vi = (g: Game, a: string, b: string) => (g.lang === "vi" ? a : b);
const alliesOf = (r: Run) => (r.floor.allies ??= []);

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

// ---- Path resources ----
const gain = (g: Game, n: number) => {
  g.player.intent = Math.max(0, Math.min(MAX_RESOURCE, g.player.intent + n));
};

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
export const allyAt = (r: Run, p: Pos) => alliesOf(r).find((a) => same(a.pos, p));
// Stage 18: urns, crates and merchants stand in the way of everyone
export const blockingAt = (r: Run, p: Pos) => r.floor.things.find((t) => same(t.pos, p) && BLOCKING.includes(t.kind));

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

// Your attack power: path kiếm tu adds 3% per point of sword intent
function playerAtk(g: Game) {
  const p = g.player;
  const bless = statusOf(g.run?.status ?? [], "bless-atk");
  return stats(p).atk * (p.path === "kiem" ? 1 + 0.03 * p.intent : 1) * (bless ? 1 + bless.value / 100 : 1);
}

function hitEnemy(g: Game, rng: Rng, e: Enemy, mult: number, fx: Fx[], opts: { fixed?: number; resource?: boolean } = {}) {
  const p = g.player;
  const r = g.run!;
  const s = stats(p);
  const echo = opts.fixed === undefined ? statusOf(r.status, "echo") : undefined;
  const times = echo ? 2 : 1;
  for (let i = 0; i < times && e.hp > 0; i++) {
    let m = mult;
    const empower = opts.fixed === undefined && i === 0 ? statusOf(r.status, "empower") : undefined;
    if (empower) {
      m *= empower.value;
      r.status = r.status.filter((x) => x !== empower);
    }
    const { amount, crit } = opts.fixed !== undefined ? { amount: opts.fixed, crit: false } : damage(playerAtk(g), enemyDef(e), rng, m, s.crit);
    e.hp -= amount;
    e.awake = true;
    fx.push({ type: "hit", at: { ...e.pos }, amount, crit });
  }
  if (echo) {
    echo.value--;
    if (echo.value <= 0) r.status = r.status.filter((x) => x !== echo);
  }
  // path: kiếm ý and khí huyết grow with every hit you land
  if (opts.resource !== false && opts.fixed === undefined && (p.path === "kiem" || p.path === "vo")) gain(g, 1);
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
  if (p.path === "phat") gain(g, 1); // path: công đức for every evil laid to rest
  const name = vi(g, info.vi, info.en);
  if (e.kind === "tam-ma") {
    log(g, vi(g, "Tâm Ma tan biến. Đạo tâm vững như bàn thạch!", "The Heart Demon fades. Your heart is steady as rock!"), "good");
    return;
  }
  const tuvi = tuviFor(e.level);
  r.loot.cultivation += tuvi;
  const major = p.major;
  const layers = readyForTribulation(p) || atPeak(p) ? 0 : gainCultivation(p, tuvi);
  log(g, vi(g, `Hạ ${name}. +${tuvi} tu vi.`, `Defeated ${name}. +${tuvi} cultivation.`), "good");
  if (layers) {
    heal(g);
    log(g, vi(g, `Đột phá! Giờ là ${MAJOR_REALMS[major].vi} tầng ${p.layer}.`, `Breakthrough! Now ${MAJOR_REALMS[major].en} ${p.layer}.`), "good");
    fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Đột phá!", "Breakthrough!"), tone: "good" });
  }
  if (rng.chance(0.4)) {
    const n = stonesFor(e.level);
    r.loot.stones += n;
    fx.push({ type: "text", at: { ...e.pos }, text: `+${n} 💎`, tone: "loot" });
  }
  if (info.beast && rng.chance(0.35)) addItem(r.loot.bag, "yeu-dan");
  if (rng.chance(0.12)) {
    r.loot.gear.push(rollGear(g, rng, e.level));
    log(g, vi(g, "Rơi ra một món trang bị.", "It dropped a piece of gear."), "loot");
  }
  if (info.boss) bossLoot(g, rng, e);
}

function bossLoot(g: Game, rng: Rng, e: Enemy) {
  const r = g.run!;
  const p = g.player;
  const realm = realmInfo(r.realm);
  const kinds = Object.keys(TREASURES) as TreasureKind[];
  const owned = new Set([...p.treasures, ...r.loot.treasures].map((t) => t.kind));
  const fresh = kinds.filter((k) => !owned.has(k));
  const kind = fresh.length ? rng.pick(fresh) : rng.pick(kinds);
  r.loot.treasures.push(newTreasure(g, kind, Math.min(3, realm.minMajor + (owned.has(kind) ? 1 : 0))));
  r.loot.stones += stonesFor(e.level) * 8;
  const pill = MAJOR_REALMS[realm.minMajor].pill;
  if (pill) addItem(r.loot.bag, pill);
  addItem(r.loot.bag, realm.herb, 2);
  addItem(r.loot.bag, "yeu-dan", 3);
  addItem(r.loot.bag, "huyen-thiet", 2);
  const slip = unknownSlip(p);
  if (slip) addItem(r.loot.bag, slip);
  r.loot.gear.push(rollGear(g, rng, e.level, 0.3));
  r.floor.things.push({ uid: newUid(g, "p"), kind: "portal", pos: { ...e.pos } });
  log(
    g,
    vi(
      g,
      `${ENEMIES[e.kind].vi} ngã xuống! Nhận ${TREASURES[kind].vi}${pill ? `, ${ITEMS[pill].vi}` : ""} và nhiều bảo vật. Một trận truyền tống hiện ra.`,
      `The ${ENEMIES[e.kind].en} falls! You get ${TREASURES[kind].en}${pill ? `, a ${ITEMS[pill].en}` : ""} and more. A return array appears.`,
    ),
    "loot",
  );
}

// Damage to you: righteous qi softens it, then block, shield, mirror and karma
function hurtPlayer(g: Game, rng: Rng, amount: number, fx: Fx[], from?: Enemy) {
  const r = g.run!;
  const p = g.player;
  if (p.path === "nho") amount = Math.max(1, Math.round(amount * (1 - 0.025 * p.intent))); // path: chính khí
  const blessDef = statusOf(r.status, "bless-def");
  if (blessDef) amount = Math.max(1, Math.round(amount * (1 - blessDef.value / 100)));
  const block = statusOf(r.status, "block");
  if (block) {
    r.status = r.status.filter((s) => s !== block);
    fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Chặn!", "Blocked!"), tone: "info" });
    return;
  }
  const shield = statusOf(r.status, "shield");
  if (shield) {
    const absorbed = Math.min(shield.value, amount);
    shield.value -= absorbed;
    amount -= absorbed;
    if (shield.value <= 0) r.status = r.status.filter((s) => s !== shield);
  }
  if (from && amount > 0) {
    const reflect = (statusOf(r.status, "reflect")?.value ?? 0) + (p.path === "phat" ? 2 * p.intent : 0); // path: nhân quả
    if (reflect > 0 && r.floor.enemies.includes(from)) hitEnemy(g, rng, from, 0, fx, { fixed: Math.max(1, Math.round((amount * reflect) / 100)) });
  }
  p.hp -= amount;
  fx.push({ type: "hit", at: { ...r.pos }, amount, onPlayer: true });
  if (p.path === "vo") {
    gain(g, 2); // path: khí huyết boils when you're hit…
    if (from && p.hp > 0 && r.floor.enemies.includes(from) && dist(from.pos, r.pos) === 1 && rng.chance(0.2)) {
      fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Phản đòn!", "Counter!"), tone: "good" });
      hitEnemy(g, rng, from, 0.6, fx, { resource: false }); // …and you strike back
    }
  }
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
  const info = realmInfo(realm);
  log(g, vi(g, `Bước vào ${info.vi}, tầng 1.`, `You enter the ${info.en}, floor 1.`), "info");
  markSeen(g);
}

export const TRIBULATION_TURNS = 15;
export const tribulationTurns = (from: number) => TRIBULATION_TURNS + 3 * from;

export function startTribulation(g: Game): boolean {
  if (!readyForTribulation(g.player)) return false;
  const { floor, start } = makeArena();
  const from = g.player.major;
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
    from,
    strikes: [],
    survived: 0,
    goal: tribulationTurns(from),
    demon: false,
  };
  heal(g);
  g.player.intent = 0;
  log(
    g,
    vi(
      g,
      `Thiên kiếp ${MAJOR_REALMS[from + 1].vi} giáng xuống! Né sét ${tribulationTurns(from)} lượt, rồi vượt qua Tâm Ma.`,
      `The ${MAJOR_REALMS[from + 1].en} tribulation begins! Dodge the lightning for ${tribulationTurns(from)} turns, then face your Heart Demon.`,
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
      `Độ kiếp thành công! Bạn đã bước vào ${MAJOR_REALMS[p.major].vi}. Sinh lực, linh lực và số ô thần thông, pháp bảo đều tăng.`,
      `Tribulation passed! You have reached ${MAJOR_REALMS[p.major].en}. More life, qi and slots.`,
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
  if (r.kind === "realm") p.record.deepest = Math.max(p.record.deepest, r.floor.depth);
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
    return { ok: false, fx, outcome: "continue", reason: res.reason, shop: res.shop };
  }
  if (res.outcome) {
    g.rng = rng.state();
    return { ok: true, fx, outcome: res.outcome };
  }
  const outcome = endTurn(g, rng, fx);
  g.rng = rng.state();
  return { ok: true, fx, outcome };
}

type Step = { ok: boolean; reason?: string; outcome?: Outcome; shop?: string };

function playerAction(g: Game, rng: Rng, a: Action, fx: Fx[]): Step {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);

  if (a.type === "wait") {
    p.qi = Math.min(s.qi, p.qi + Math.max(1, Math.round(s.qiRegen))); // resting gathers a little extra qi
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
    const block = blockingAt(r, to);
    if (block?.kind === "merchant") return { ok: false, reason: "merchant", shop: block.uid };
    if (block) {
      smash(g, rng, block, fx);
      return { ok: true };
    }
    const friend = allyAt(r, to);
    if (friend) friend.pos = { ...r.pos }; // swap places with your own soldier
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
    r.status = r.status.filter((x) => !x.kind.startsWith("bless") && x.kind !== "regen"); // blessings stay on their floor
    p.record.deepest = Math.max(p.record.deepest, floor.depth);
    log(g, vi(g, `Xuống tầng ${floor.depth}. Linh khí đậm hơn, nguy hiểm cũng vậy.`, `Down to floor ${floor.depth}. Richer qi, greater danger.`), "info");
    markSeen(g);
    return { ok: true, outcome: "continue" };
  }

  if (a.type === "item") return useItemInRun(g, rng, a.id, a.target, fx);
  if (a.type === "buy") return buy(g, a.uid, a.index);

  if (a.type === "treasure") {
    const t = p.treasures.find((x) => x.uid === a.uid);
    if (!t || !p.bound.includes(a.uid)) return { ok: false, reason: "not bound" };
    if ((r.cooldowns[a.uid] ?? 0) > 0) return { ok: false, reason: "cooldown" };
    const info = TREASURES[t.kind];
    const res = applyEffect(g, rng, info, a.target, fx, 1 + 0.35 * t.grade + 0.05 * t.level);
    if (res.ok) r.cooldowns[a.uid] = info.cooldown + 1;
    return res;
  }

  const ab = ABILITIES[a.id];
  if (!p.skills.includes(a.id)) return { ok: false, reason: "not equipped" };
  if ((r.cooldowns[a.id] ?? 0) > 0) return { ok: false, reason: "cooldown" };
  const cost = abilityQi(p, a.id);
  if (p.qi < cost) return { ok: false, reason: "qi" };
  const power = p.path === "dao" ? 1 + 0.025 * p.intent : p.path === "nho" ? 1 + 0.03 * p.intent : 1; // path: đạo vận (and, since Stage 18, chính khí) strengthen abilities
  const res = applyEffect(g, rng, ab, a.target, fx, power);
  if (!res.ok) return res;
  p.qi -= cost;
  if (ab.cooldown) r.cooldowns[a.id] = ab.cooldown + 1; // +1: this turn's tick
  if (p.path === "dao" && !ab.spendAll) gain(g, 1);
  return res;
}

// The direction from you towards a tapped tile: one of 8
const dirTo = (from: Pos, to: Pos): Pos => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) });

// Carry out an ability or a treasure power (see Effect in paths.ts). Checks the target first; changes nothing if it's wrong.
function applyEffect(g: Game, rng: Rng, eff: Effect, target: Pos | undefined, fx: Fx[], power: number): Step {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  let victims: Enemy[] = [];
  let finishMult = 0;

  // 1. Who's affected (and is the target allowed?)
  switch (eff.target) {
    case "self":
      break;
    case "around":
      victims = r.floor.enemies.filter((e) => dist(e.pos, r.pos) <= (eff.radius ?? 1));
      fx.push({ type: "area", at: { ...r.pos }, r: eff.radius ?? 1, color: eff.mult ? "#b08a2e" : "#7a3fa0" });
      break;
    case "line": {
      if (!target || same(target, r.pos)) return { ok: false, reason: "target" };
      const d = dirTo(r.pos, target);
      let cur = r.pos;
      const path: Pos[] = [];
      for (let i = 0; i < eff.range; i++) {
        const n = { x: cur.x + d.x, y: cur.y + d.y };
        if (!isFloor(grid(r), n.x, n.y)) break;
        path.push(n);
        cur = n;
      }
      if (!path.length) return { ok: false, reason: "wall" };
      fx.push({ type: "slash", from: { ...r.pos }, to: path[path.length - 1], color: "#3f7d6a" });
      victims = path.map((q) => enemyAt(r, q)).filter((e): e is Enemy => !!e);
      break;
    }
    case "dash": {
      if (!target || same(target, r.pos)) return { ok: false, reason: "target" };
      const d = dirTo(r.pos, target);
      let cur = r.pos;
      for (let i = 0; i < eff.range; i++) {
        const n = { x: cur.x + d.x, y: cur.y + d.y };
        if (!canStep(grid(r), cur, d) || enemyAt(r, n) || allyAt(r, n) || blockingAt(r, n)) break;
        cur = n;
      }
      const ahead = enemyAt(r, { x: cur.x + d.x, y: cur.y + d.y });
      if (same(cur, r.pos) && !(eff.finish && ahead)) return { ok: false, reason: "blocked" };
      if (!same(cur, r.pos)) {
        fx.push({ type: "move", from: { ...r.pos }, to: { ...cur } });
        fx.push({ type: "slash", from: { ...r.pos }, to: { ...cur }, color: "#7aa7c7" });
        r.pos = cur;
        stepOn(g, rng, fx);
      }
      if (eff.finish) {
        const foe = ahead ?? r.floor.enemies.filter((e) => dist(e.pos, r.pos) === 1).sort((a, b) => dist(a.pos, target) - dist(b.pos, target))[0];
        if (foe) {
          victims = [foe];
          finishMult = eff.finish;
        }
      }
      break;
    }
    case "enemy":
    case "adjacent": {
      const foe = target && enemyAt(r, target);
      if (!foe || dist(foe.pos, r.pos) > eff.range) return { ok: false, reason: "target" };
      if (eff.target === "enemy" && !clearLine(grid(r), r.pos, foe.pos)) return { ok: false, reason: "target" };
      fx.push({ type: "slash", from: { ...r.pos }, to: { ...foe.pos }, color: eff.enemy?.some((x) => x.kind === "burn") ? "#c4562f" : "#4f8a9a" });
      victims = [foe];
      break;
    }
    case "area": {
      if (!target || dist(target, r.pos) > eff.range || !visible(g).has(target.y * r.floor.w + target.x)) return { ok: false, reason: "target" };
      fx.push({ type: "area", at: { ...target }, r: eff.radius ?? 1, color: "#3f6f9a" });
      victims = r.floor.enemies.filter((e) => dist(e.pos, target) <= (eff.radius ?? 1));
      break;
    }
  }

  // 2. Spend the path resource, if this uses all of it
  let spent = 0;
  if (eff.spendAll) {
    spent = p.intent;
    p.intent = 0;
  }

  // 3. Damage and effects on enemies (self-only effects use perPoint for themselves, below)
  const mult = (finishMult || (eff.mult ?? 0)) * power * (1 + (eff.self ? 0 : (eff.perPoint ?? 0) * spent));
  for (const e of victims) {
    if (!r.floor.enemies.includes(e)) continue;
    if (mult > 0) hitEnemy(g, rng, e, mult * (eff.spirits && SPIRITS.includes(e.kind) ? eff.spirits : 1), fx, { resource: !eff.spendAll });
    if (!r.floor.enemies.includes(e)) continue;
    e.awake = true;
    for (const st of eff.enemy ?? []) addStatus(e.status, st.kind, st.turns, st.kind === "burn" ? Math.max(1, Math.round(s.atk * (st.atk ?? 0.2) * power)) : 1);
  }

  // 4. On yourself
  if (eff.heal) {
    const amount = Math.ceil(s.hp * eff.heal * power);
    p.hp = Math.min(s.hp, p.hp + amount);
    fx.push({ type: "heal", at: { ...r.pos }, amount });
    if (p.path === "phat") gain(g, 1); // path: công đức
  }
  if (eff.qi) {
    const amount = Math.ceil(s.qi * eff.qi * power);
    p.qi = Math.min(s.qi, p.qi + amount);
    fx.push({ type: "heal", at: { ...r.pos }, amount, qi: true });
  }
  for (const st of eff.self ?? []) {
    const value =
      st.kind === "shield"
        ? Math.round((2 * s.def + 10 + 0.1 * s.hp) * st.value * power)
        : st.kind === "reflect"
          ? Math.round(st.value * power + (eff.perPoint ?? 0) * spent)
          : st.value;
    addStatus(r.status, st.kind, st.turns, value);
    fx.push({ type: "area", at: { ...r.pos }, r: 0, color: st.kind === "shield" || st.kind === "block" ? "#7aa7c7" : "#b08a2e" });
  }
  if (eff.summon) summon(g, eff.summon.kind, eff.summon.count, power, fx);
  if (eff.gain) gain(g, eff.gain);
  return { ok: true };
}

// ---- Binh gia: soldiers ----
function summon(g: Game, kind: AllyKind, count: number, power: number, fx: Fx[]) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  const info = ALLIES[kind];
  const spots = DIRS.map((d) => ({ x: r.pos.x + d.x, y: r.pos.y + d.y })).filter(
    (q) => isFloor(grid(r), q.x, q.y) && !enemyAt(r, q) && !allyAt(r, q) && !blockingAt(r, q),
  );
  for (const pos of spots.slice(0, count)) {
    const hp = Math.round(s.hp * info.hp * power);
    alliesOf(r).push({ uid: newUid(g, "a"), kind, pos, hp, maxHp: hp, atk: s.atk * info.atk * power, def: s.def * 0.5, turns: info.turns });
    fx.push({ type: "summon", at: pos });
  }
  if (!spots.length) fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Không còn chỗ!", "No room!"), tone: "info" });
}

function allyAct(g: Game, rng: Rng, a: Ally, fx: Fx[]) {
  const r = g.run!;
  const p = g.player;
  const info = ALLIES[a.kind];
  const bonus = p.path === "binh" ? 1 + 0.05 * p.intent : 1; // path: quân lệnh
  const foes = r.floor.enemies
    .filter((e) => dist(e.pos, a.pos) <= 8 && clearLine(grid(r), a.pos, e.pos))
    .sort((x, y) => dist(x.pos, a.pos) - dist(y.pos, a.pos));
  const foe = foes[0];
  if (foe && dist(foe.pos, a.pos) <= info.range) {
    if (info.range > 1) fx.push({ type: "slash", from: { ...a.pos }, to: { ...foe.pos }, color: "#8a6a3f" });
    hitEnemy(g, rng, foe, 0, fx, { fixed: damage(a.atk * bonus, enemyDef(foe), rng).amount });
    return;
  }
  const occupied = (q: Pos) => same(q, r.pos) || !!enemyAt(r, q) || !!blockingAt(r, q) || alliesOf(r).some((x) => x !== a && same(x.pos, q));
  const goal = foe?.pos ?? (dist(a.pos, r.pos) > 2 ? r.pos : null);
  if (!goal) return;
  const next = findPath(grid(r), a.pos, goal, { blocked: occupied, maxSteps: 400 })?.[0];
  if (next && !occupied(next)) a.pos = next;
}

// ---- Targets (for the screen: which tiles light up when aiming) ----
export function abilityTargets(g: Game, kind: Effect["target"], range: number): Pos[] {
  const r = g.run!;
  const seen = visible(g);
  const out: Pos[] = [];
  if (kind === "self" || kind === "around") return [r.pos];
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

// Picking things up, springing traps, stepping into hazards
function stepOn(g: Game, rng: Rng, fx: Fx[]) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  const realm = realmInfo(r.realm);
  const level = realm.firstLevel + (r.floor.depth - 1) * 2;
  for (const t of r.floor.things.filter((x) => same(x.pos, r.pos))) {
    if (t.kind === "herb") {
      const amount = Math.ceil(s.hp * 0.08);
      const tuvi = Math.round(tuviFor(level) * 0.6);
      p.hp = Math.min(s.hp, p.hp + amount);
      if (!readyForTribulation(p) && !atPeak(p)) gainCultivation(p, tuvi);
      r.loot.cultivation += tuvi;
      addItem(r.loot.bag, realm.herb);
      fx.push({ type: "heal", at: { ...r.pos }, amount });
      log(
        g,
        vi(g, `Hái ${ITEMS[realm.herb].vi}: hồi sinh lực, +${tuvi} tu vi.`, `Picked a ${ITEMS[realm.herb].en}: some life back, +${tuvi} cultivation.`),
        "good",
      );
    } else if (t.kind === "stones") {
      r.loot.stones += t.amount ?? 5;
      fx.push({ type: "text", at: { ...r.pos }, text: `+${t.amount} 💎`, tone: "loot" });
    } else if (t.kind === "chest") {
      openChest(g, rng, fx, level);
    } else if (t.kind === "shrine") {
      if (!t.used) pray(g, rng, fx, level);
      t.used = true;
      continue; // the shrine stays, now quiet
    } else if (t.kind === "trap") {
      t.hidden = false;
      hurtPlayer(g, rng, Math.ceil(s.hp * 0.12), fx);
      fx.push({ type: "area", at: { ...r.pos }, r: 1, color: "#b8432f" });
      log(g, vi(g, "Dẫm phải sát trận!", "You stepped on a hidden killing array!"), "bad");
      continue; // traps stay (now visible)
    } else if (t.kind === "hazard") {
      if (t.hazard === "lava") {
        hurtPlayer(g, rng, Math.ceil(s.hp * 0.08), fx);
        addStatus(r.status, "burn", 2, Math.max(1, Math.round(s.hp * 0.02)));
        log(g, vi(g, "Dung nham bỏng rát!", "The lava burns!"), "bad");
      } else if (t.hazard === "miasma") {
        p.qi = Math.max(0, p.qi - Math.ceil(s.qi * 0.15));
        fx.push({ type: "text", at: { ...r.pos }, text: vi(g, "Oán khí!", "Miasma!"), tone: "bad" });
        log(g, vi(g, "Oán khí hút mất linh lực.", "Grudge miasma drains your qi."), "bad");
      } else if (t.hazard === "whirlpool") {
        const tiles: Pos[] = [];
        const open = (x: number, y: number) => isFloor(grid(r), x, y) && !enemyAt(r, { x, y }) && !allyAt(r, { x, y }) && !blockingAt(r, { x, y });
        for (const far of [8, 3]) {
          for (let y = 1; y < r.floor.h - 1; y++) for (let x = 1; x < r.floor.w - 1; x++) if (open(x, y) && dist({ x, y }, r.pos) > far) tiles.push({ x, y });
          if (tiles.length) break; // far away if there's room, otherwise just somewhere else
        }
        if (tiles.length) {
          fx.push({ type: "area", at: { ...r.pos }, r: 1, color: "#3f6f9a" });
          r.pos = rng.pick(tiles);
          log(g, vi(g, "Xoáy nước cuốn bạn đi!", "A whirlpool sweeps you away!"), "info");
        }
      }
      continue; // hazards stay
    } else continue;
    r.floor.things = r.floor.things.filter((x) => x !== t);
  }
}

// ---- Stage 18: urns, crates, shrines and the wandering merchant ----
function smash(g: Game, rng: Rng, t: Thing, fx: Fx[]) {
  const r = g.run!;
  const realm = realmInfo(r.realm);
  const level = realm.firstLevel + (r.floor.depth - 1) * 2;
  r.floor.things = r.floor.things.filter((x) => x !== t);
  fx.push({ type: "slash", from: { ...r.pos }, to: { ...t.pos } });
  fx.push({ type: "break", at: { ...t.pos }, kind: t.kind === "crate" ? "crate" : "urn" });
  const roll = rng.next();
  if (roll < 0.45) {
    const n = Math.max(1, Math.round(stonesFor(level) * (0.4 + rng.next() * 0.6)));
    r.loot.stones += n;
    fx.push({ type: "text", at: { ...t.pos }, text: `+${n} 💎`, tone: "loot" });
  } else if (roll < 0.6) {
    addItem(r.loot.bag, realm.herb);
    fx.push({ type: "text", at: { ...t.pos }, text: vi(g, ITEMS[realm.herb].vi, ITEMS[realm.herb].en), tone: "loot" });
  } else if (roll < 0.7) {
    const pill: ItemId = rng.chance(0.5) ? "hoi-xuan" : "hoi-linh";
    addItem(r.loot.bag, pill);
    fx.push({ type: "text", at: { ...t.pos }, text: vi(g, ITEMS[pill].vi, ITEMS[pill].en), tone: "loot" });
  } else fx.push({ type: "text", at: { ...t.pos }, text: vi(g, "Trống rỗng", "Empty"), tone: "info" });
}

function pray(g: Game, rng: Rng, fx: Fx[], level: number) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  fx.push({ type: "bless", at: { ...r.pos } });
  const roll = rng.int(0, 3);
  if (roll === 0) {
    addStatus(r.status, "bless-atk", 30, 25);
    log(g, vi(g, "Thần đàn ban sức mạnh: công +25% trong 30 lượt.", "The shrine grants strength: +25% attack for 30 turns."), "good");
  } else if (roll === 1) {
    addStatus(r.status, "bless-def", 30, 25);
    log(g, vi(g, "Thần đàn che chở: chịu ít hơn 25% sát thương trong 30 lượt.", "The shrine shields you: 25% less damage for 30 turns."), "good");
  } else if (roll === 2) {
    addStatus(r.status, "regen", 30, 3);
    log(g, vi(g, "Thần đàn tưới linh tuyền: hồi 3% sinh lực mỗi lượt.", "The shrine's spring heals 3% of your life each turn."), "good");
  } else {
    const n = stonesFor(level) * 2;
    r.loot.stones += n;
    p.qi = s.qi;
    fx.push({ type: "text", at: { ...r.pos }, text: `+${n} 💎`, tone: "loot" });
    log(g, vi(g, `Thần đàn ban ${n} linh thạch và đầy linh lực.`, `The shrine gives ${n} spirit stones and fills your qi.`), "good");
  }
}

// What you can spend at a merchant: stones found on this trip first, then the ones you brought
export const purse = (g: Game) => (g.run?.loot.stones ?? 0) + g.player.stones;

function buy(g: Game, uid: string, index: number): Step {
  const r = g.run!;
  const p = g.player;
  const m = r.floor.things.find((t) => t.uid === uid && t.kind === "merchant");
  const offer = m?.offers?.[index];
  if (!m || !offer || offer.sold) return { ok: false, reason: "not for sale" };
  if (dist(m.pos, r.pos) > 1) return { ok: false, reason: "too far" };
  if (purse(g) < offer.price) return { ok: false, reason: "not enough stones" };
  const fromLoot = Math.min(r.loot.stones, offer.price);
  r.loot.stones -= fromLoot;
  p.stones -= offer.price - fromLoot;
  offer.sold = true;
  addItem(r.loot.bag, offer.id);
  log(g, vi(g, `Mua ${ITEMS[offer.id].vi} (${offer.price} 💎).`, `Bought a ${ITEMS[offer.id].en} (${offer.price} 💎).`), "loot");
  return { ok: true, outcome: "continue" };
}

function openChest(g: Game, rng: Rng, fx: Fx[], level: number) {
  const r = g.run!;
  const depth = r.floor.depth;
  const n = stonesFor(level) * 3 + rng.int(0, stonesFor(level));
  r.loot.stones += n;
  const found: string[] = [`${n} ${vi(g, "linh thạch", "spirit stones")}`];
  const add = (id: ItemId) => {
    addItem(r.loot.bag, id);
    found.push(vi(g, ITEMS[id].vi, ITEMS[id].en));
  };
  const roll = rng.next();
  if (roll < 0.4) add(rng.pick<ItemId>(["hoi-xuan", "hoi-linh", "tu-khi", g.player.major >= 1 ? "dai-hoi-xuan" : "hoi-xuan"]));
  else if (roll < 0.8) {
    const item = rollGear(g, rng, level, 0.1);
    r.loot.gear.push(item);
    found.push(item.name);
  } else add(rng.pick<ItemId>(["bao-linh-phu", "truyen-tong-phu"]));
  if (rng.chance(0.3)) add("huyen-thiet");
  if (rng.chance(0.15)) add("phu-chi");
  if (depth >= 3 && rng.chance(0.08)) {
    const slip = unknownSlip(g.player);
    if (slip && !(r.loot.bag[slip] ?? 0)) add(slip);
  }
  fx.push({ type: "text", at: { ...r.pos }, text: "🎁", tone: "loot" });
  log(g, vi(g, `Mở rương: ${found.join(", ")}.`, `Opened a chest: ${found.join(", ")}.`), "loot");
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
export const tribulationPill = (r: Run): ItemId | null => (r.kind === "tribulation" ? MAJOR_REALMS[r.from ?? 0].pill : null);

function useItemInRun(g: Game, rng: Rng, id: ItemId, target: Pos | undefined, fx: Fx[]): Step {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  if (runBagCount(g, id) < 1) return { ok: false, reason: "none" };
  switch (id) {
    case "hoi-xuan":
    case "dai-hoi-xuan": {
      const amount = Math.ceil(s.hp * (id === "hoi-xuan" ? 0.4 : 0.75));
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
    case "boi-nguyen": {
      if (readyForTribulation(p) || atPeak(p)) return { ok: false, reason: "full" };
      const amount = id === "tu-khi" ? 2 * meditateGain(p) : Math.round(needed(p) * 0.2);
      gainCultivation(p, amount);
      r.loot.cultivation += amount;
      fx.push({ type: "text", at: { ...r.pos }, text: `+${amount}`, tone: "good" });
      break;
    }
    case "truc-co-dan":
    case "ket-kim-dan":
    case "hoa-anh-dan":
      if (tribulationPill(r) !== id || r.pill) return { ok: false, reason: "only in tribulation" };
      r.pill = true;
      addStatus(r.status, "shield", 10, Math.round(s.hp * 0.3));
      p.hp = Math.min(s.hp, p.hp + Math.round(s.hp * 0.3));
      fx.push({ type: "area", at: { ...r.pos }, r: 0, color: "#b59a4a" });
      log(g, vi(g, `Nuốt ${ITEMS[id].vi}: linh lực cuồn cuộn bảo vệ thân thể.`, `You swallow the ${ITEMS[id].en}: qi surges to guard you.`), "good");
      break;
    case "bao-linh-phu": {
      const e = target && enemyAt(r, target);
      if (!e || dist(e.pos, r.pos) > 6) return { ok: false, reason: "target" };
      const fixed = Math.round(s.atk * 2.2);
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
  if (p.path === "nho") gain(g, 1); // path: chính khí gathers by itself
  if (p.path === "binh" && r.turn % 2 === 0) gain(g, 1); // path: quân lệnh
  const regen = statusOf(r.status, "regen");
  if (regen && p.hp < s.hp) {
    const amount = Math.max(1, Math.round((s.hp * regen.value) / 100));
    p.hp = Math.min(s.hp, p.hp + amount);
    if (r.turn % 3 === 0) fx.push({ type: "heal", at: { ...r.pos }, amount });
  }
  const burning = statusOf(r.status, "burn");
  if (burning) {
    p.hp -= burning.value;
    fx.push({ type: "hit", at: { ...r.pos }, amount: burning.value, onPlayer: true });
  }

  // Your soldiers
  for (const a of [...alliesOf(r)]) {
    a.turns--;
    if (a.turns <= 0 || a.hp <= 0) {
      r.floor.allies = alliesOf(r).filter((x) => x !== a);
      fx.push({ type: "die", at: { ...a.pos } });
      continue;
    }
    allyAct(g, rng, a, fx);
  }

  for (const e of [...r.floor.enemies]) {
    if (!r.floor.enemies.includes(e)) continue;
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
  // Who to go for: you, or one of your soldiers if it's closer
  const allies = alliesOf(r);
  const nearestAlly = allies.reduce<Ally | null>((best, a) => (!best || dist(a.pos, e.pos) < dist(best.pos, e.pos) ? a : best), null);
  const targetAlly = nearestAlly && dist(nearestAlly.pos, e.pos) < dist(r.pos, e.pos) ? nearestAlly : null;
  const goal = targetAlly?.pos ?? r.pos;
  const d = dist(e.pos, goal);
  const sees = d <= 8 && (info.ghost || clearLine(grid(r), e.pos, goal));
  if (!e.awake) {
    if (sees && rng.chance(0.8)) {
      e.awake = true;
      fx.push({ type: "text", at: { ...e.pos }, text: "!", tone: "bad" });
    } else if (rng.chance(0.25)) wander(g, rng, e);
    return;
  }
  const occupied = (q: Pos) =>
    same(q, r.pos) || r.floor.enemies.some((x) => x !== e && same(x.pos, q)) || allies.some((a) => same(a.pos, q)) || !!blockingAt(r, q);
  // Hurt rogue cultivators run away
  if (info.flees && e.hp < e.maxHp * 0.3 && dist(e.pos, r.pos) <= 4) {
    const away = DIRS.map((dir) => ({ dir, to: { x: e.pos.x + dir.x, y: e.pos.y + dir.y } }))
      .filter(({ dir, to }) => canStep(grid(r), e.pos, dir) && !occupied(to))
      .sort((a, b) => dist(b.to, r.pos) - dist(a.to, r.pos))[0];
    if (away && dist(away.to, r.pos) > dist(e.pos, r.pos)) {
      e.pos = away.to;
      return;
    }
  }
  if (d <= info.range && (d === 1 || clearLine(grid(r), e.pos, goal))) {
    if (targetAlly) attackAlly(g, rng, e, targetAlly, fx, d > 1);
    else attackPlayer(g, rng, e, fx, d > 1);
    return;
  }
  if (!sees && d > 12) return; // lost you
  let next: Pos | undefined;
  if (info.ghost) {
    const step = dirTo(e.pos, goal);
    const to = { x: e.pos.x + step.x, y: e.pos.y + step.y };
    if (to.x > 0 && to.y > 0 && to.x < r.floor.w - 1 && to.y < r.floor.h - 1 && !occupied(to)) next = to;
  } else next = findPath(grid(r), e.pos, goal, { blocked: occupied, maxSteps: 600 })?.[0];
  if (next && !occupied(next)) e.pos = next;
}

function wander(g: Game, rng: Rng, e: Enemy) {
  const r = g.run!;
  const dir = rng.pick(DIRS);
  const to = { x: e.pos.x + dir.x, y: e.pos.y + dir.y };
  if (canStep(grid(r), e.pos, dir) && !same(to, r.pos) && !r.floor.enemies.some((x) => same(x.pos, to)) && !allyAt(r, to) && !blockingAt(r, to)) e.pos = to;
}

function attackPlayer(g: Game, rng: Rng, e: Enemy, fx: Fx[], ranged: boolean) {
  const r = g.run!;
  const p = g.player;
  const s = stats(p);
  if (ranged) fx.push({ type: "slash", from: { ...e.pos }, to: { ...r.pos }, color: ENEMIES[e.kind].tint ?? "#6b5a7a" });
  // A little chance to dodge, better at higher realms
  if (rng.chance(0.06 + p.major * 0.04)) {
    fx.push({ type: "miss", at: { ...r.pos } });
    return;
  }
  const { amount } = damage(enemyAtk(g, e), s.def, rng, ranged ? 0.85 : 1, 5);
  hurtPlayer(g, rng, amount, fx, e);
  if (ENEMIES[e.kind].drains) p.qi = Math.max(0, p.qi - Math.ceil(s.qi * 0.04));
  if (ENEMIES[e.kind].burns) addStatus(r.status, "burn", 2, Math.max(1, Math.round(enemyAtk(g, e) * 0.15)));
  if (p.hp <= 0) log(g, vi(g, `${ENEMIES[e.kind].vi} đánh gục bạn…`, `The ${ENEMIES[e.kind].en} strikes you down…`), "bad");
}

function attackAlly(g: Game, rng: Rng, e: Enemy, a: Ally, fx: Fx[], ranged: boolean) {
  const r = g.run!;
  if (ranged) fx.push({ type: "slash", from: { ...e.pos }, to: { ...a.pos }, color: ENEMIES[e.kind].tint ?? "#6b5a7a" });
  const { amount } = damage(enemyAtk(g, e), a.def, rng, ranged ? 0.85 : 1);
  a.hp -= amount;
  fx.push({ type: "hit", at: { ...a.pos }, amount });
  if (a.hp <= 0) {
    r.floor.allies = alliesOf(r).filter((x) => x !== a);
    fx.push({ type: "die", at: { ...a.pos } });
  }
}

// ---- The tribulation (thiên kiếp) ----
function planStrikes(g: Game, rng: Rng) {
  const r = g.run!;
  const from = r.from ?? 0;
  const wave = Math.floor((r.survived ?? 0) / 5);
  const count = r.demon ? 4 + from : 9 + 3 * from + wave * 4;
  const out: Pos[] = [];
  if (!r.demon || rng.chance(0.5)) {
    if (rng.chance(0.65)) out.push({ ...r.pos }); // the sky aims at you: move!
  }
  for (let tries = 0; out.length < count && tries < 300; tries++) {
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
    const a = allyAt(r, pos);
    if (a) a.hp -= Math.ceil(a.maxHp * 0.3);
  }
  r.survived = (r.survived ?? 0) + 1;
  if (!r.demon && r.survived >= (r.goal ?? TRIBULATION_TURNS)) {
    r.demon = true;
    const spot = DIRS.map((d) => ({ x: r.pos.x + d.x * 3, y: r.pos.y + d.y * 3 })).find((q) => isFloor(grid(r), q.x, q.y) && !allyAt(r, q)) ?? { x: 2, y: 6 };
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
