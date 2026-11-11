// The cultivator: stats, cultivation, methods, abilities, treasures, gear and items.
// Every function takes a Game and changes it in place; the caller makes a copy first (see ui/useGame.ts).

import { makeRng, type Rng } from "../engine/rng";
import {
  ABILITIES,
  abilitiesOf,
  AFFIXES,
  BAG_BASE,
  GEAR_BASES,
  gearPower,
  gearTier,
  ITEMS,
  layerCost,
  MAJOR_REALMS,
  MEDITATION,
  NO_STATS,
  PATHS,
  powerScale,
  practiseCost,
  practiseNeeds,
  QUALITIES,
  realmStats,
  refineCost,
  ROOTS,
  SLOTS,
  slipOf,
  TECHNIQUES,
  TOP_MAJOR,
  TREASURES,
  treasureScale,
  upgradeCost,
  type AbilityId,
  type Element,
  type ItemId,
  type PathId,
  type Slot,
  type Stats,
  type TechniqueId,
  type TreasureKind,
} from "./data";
import { SAVE_VERSION, type Game, type Gear, type Player, type Treasure } from "./types";

export const newUid = (g: Game, prefix: string) => `${prefix}${++g.uid}`;

// ---- A new game ----
export function rollRoot(rng: Rng): Element[] {
  const all: Element[] = ["kim", "moc", "thuy", "hoa", "tho"];
  let r = rng.next();
  let count = 3;
  for (const root of ROOTS) {
    if (r < root.chance) {
      count = root.count;
      break;
    }
    r -= root.chance;
  }
  const out: Element[] = [];
  while (out.length < count) {
    const e = rng.pick(all);
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

export const newCraft = () => ({ alchemy: { level: 1, xp: 0 }, forge: { level: 1, xp: 0 }, talisman: { level: 1, xp: 0 } });

export function newGame(name: string, seed: number, now = Date.now(), path: PathId = "kiem"): Game {
  const rng = makeRng(seed);
  const root = rollRoot(rng);
  const info = PATHS[path];
  const first = abilitiesOf(path).find((a) => ABILITIES[a].from[0] === info.start && ABILITIES[a].from[1] === 1)!;
  const player: Player = {
    name,
    path,
    root,
    major: 0,
    layer: 1,
    cultivation: 0,
    hp: 0,
    qi: 0,
    intent: 0,
    stones: 60,
    techniques: [{ id: info.start, level: 1 }],
    main: info.start,
    side: [],
    skills: [first],
    treasures: [{ uid: "t1", kind: info.treasure, grade: 0, level: 1 }],
    bound: ["t1"],
    gear: [],
    equipped: {},
    bag: { "hoi-xuan": 2, "hoi-linh": 1 },
    craft: newCraft(),
    record: { runs: 0, deaths: 0, kills: 0, deepest: 0, tribulations: 0, crafted: 0 },
  };
  const g: Game = { v: SAVE_VERSION, seed, rng: rng.state(), uid: 1, createdAt: now, updatedAt: now, lang: "vi", player, run: null };
  heal(g);
  return g;
}

// ---- Stats ----
export function rootSpeed(root: Element[]) {
  return ROOTS.find((r) => r.count === root.length)?.speed ?? 1;
}

const add = (a: Stats, b: Partial<Stats>, k = 1) => {
  for (const s of Object.keys(b) as (keyof Stats)[]) a[s] += (b[s] ?? 0) * k;
};

// Flat bonuses from methods and treasures grow with your realm, so they still matter at Nguyên Anh
const bonusScale = (p: Player) => (p.major === 0 ? 1 : powerScale(p.major, p.layer));

export function stats(p: Player): Stats {
  const s = realmStats(p.major, p.layer);
  const scale = bonusScale(p);
  for (const t of p.techniques) {
    const share = t.id === p.main ? 1 : p.side.includes(t.id) ? 0.3 : 0;
    if (!share) continue;
    const def = TECHNIQUES[t.id];
    const match = p.root.includes(def.element) ? 1.25 : 1; // a method of your own element works better
    add(s, def.perLevel, t.level * share * match * scale);
  }
  for (const uid of Object.values(p.equipped)) {
    const gear = p.gear.find((x) => x.uid === uid);
    if (gear) add(s, gearStats(gear));
  }
  for (const uid of p.bound) {
    const t = p.treasures.find((x) => x.uid === uid);
    if (t) add(s, TREASURES[t.kind].passive, treasureScale(t.grade, t.level) * scale);
  }
  if (p.path === "vo") s.def *= 1 + 0.02 * p.intent; // khí huyết hardens the body
  return {
    hp: Math.round(s.hp),
    qi: Math.round(s.qi),
    atk: Math.round(s.atk * 10) / 10,
    def: Math.round(s.def * 10) / 10,
    crit: Math.min(60, Math.round(s.crit * 10) / 10),
    qiRegen: Math.round(s.qiRegen * 100) / 100,
  };
}

export const gearStats = (g: Gear): Partial<Stats> => {
  const out: Stats = { ...NO_STATS };
  add(out, SLOTS[g.slot].base, gearPower(g.level));
  add(out, g.bonus);
  return out;
};

export function heal(g: Game) {
  const s = stats(g.player);
  g.player.hp = s.hp;
  g.player.qi = s.qi;
}

export const realmName = (p: Pick<Player, "major" | "layer">, lang: "vi" | "en" = "vi") =>
  lang === "vi" ? `${MAJOR_REALMS[p.major].vi} tầng ${p.layer}` : `${MAJOR_REALMS[p.major].en} ${p.layer}`;
export const skillSlots = (p: Player) => MAJOR_REALMS[p.major].skillSlots;
export const treasureSlots = (p: Player) => MAJOR_REALMS[p.major].treasureSlots;
export const bagSize = (p: Player) => {
  const ring = p.gear.find((x) => x.uid === p.equipped.ring);
  return BAG_BASE + (ring ? 4 * (ring.tier + 1) : 0);
};
// Your level on the same scale as enemies (Luyện Khí 1 = 1 … Nguyên Anh 9 = 36)
export const playerLevel = (p: Player) => p.major * 9 + p.layer;

// ---- Cultivation (tu vi) ----
export const needed = (p: Player) => layerCost(p.major, p.layer);
// At tầng 9 with full tu vi, only a tribulation moves you on (Nguyên Anh 9 is the top, for now)
export const readyForTribulation = (p: Player) => p.major < TOP_MAJOR && p.layer === 9 && p.cultivation >= needed(p);
export const atPeak = (p: Player) => p.major === TOP_MAJOR && p.layer === 9 && p.cultivation >= needed(p);

// Add tu vi; full layers go up by themselves (small bottlenecks). Returns the layers gained.
export function gainCultivation(p: Player, amount: number): number {
  let gained = 0;
  p.cultivation += amount;
  while (p.cultivation >= needed(p) && p.layer < MAJOR_REALMS[p.major].layers) {
    p.cultivation -= needed(p);
    p.layer++;
    gained++;
  }
  if (p.layer === MAJOR_REALMS[p.major].layers) p.cultivation = Math.min(p.cultivation, needed(p));
  return gained;
}

export const meditateCost = (p: Player) => MEDITATION[p.major].stones;
export const meditateGain = (p: Player) => Math.round(MEDITATION[p.major].gain * rootSpeed(p.root));
// Kept for the screens and tests written in Stage 16
export const MEDITATE_STONES = MEDITATION[0].stones;

export function meditate(g: Game, times = 1): { ok: boolean; gained: number; layers: number } {
  const p = g.player;
  let gained = 0;
  let layers = 0;
  for (let i = 0; i < times; i++) {
    if (p.stones < meditateCost(p) || readyForTribulation(p) || atPeak(p)) break;
    p.stones -= meditateCost(p);
    const amount = meditateGain(p);
    gained += amount;
    layers += gainCultivation(p, amount);
  }
  if (layers) heal(g);
  return { ok: gained > 0, gained, layers };
}

// Success: the next major realm, tầng 1
export function breakThrough(g: Game) {
  const p = g.player;
  p.major = Math.min(TOP_MAJOR, p.major + 1);
  p.layer = 1;
  p.cultivation = 0;
  p.record.tribulations++;
  heal(g);
}
// Failure: lose a quarter of the tu vi, and come home hurt
export function failTribulation(g: Game) {
  const p = g.player;
  p.cultivation = Math.floor(p.cultivation * 0.75);
  p.record.tribulations++;
  heal(g);
  p.hp = Math.ceil(p.hp * 0.3);
}

// ---- Công pháp ----
export function canPractise(p: Player, id: TechniqueId): { ok: boolean; cost: number; reason?: "max" | "stones" | "realm" | "unknown" } {
  const t = p.techniques.find((x) => x.id === id);
  if (!t) return { ok: false, cost: 0, reason: "unknown" };
  if (t.level >= TECHNIQUES[id].maxLevel) return { ok: false, cost: 0, reason: "max" };
  const cost = practiseCost(t.level + 1);
  const need = practiseNeeds(t.level + 1);
  if (p.major === 0 && p.layer < need.layer) return { ok: false, cost, reason: "realm" };
  if (p.stones < cost) return { ok: false, cost, reason: "stones" };
  return { ok: true, cost };
}

export function practise(g: Game, id: TechniqueId): AbilityId[] {
  const p = g.player;
  const check = canPractise(p, id);
  if (!check.ok) return [];
  p.stones -= check.cost;
  const t = p.techniques.find((x) => x.id === id)!;
  t.level++;
  heal(g);
  // New abilities from this level are added to free skill slots
  const learned = unlockedAbilities(p).filter((a) => ABILITIES[a].from[0] === id && ABILITIES[a].from[1] === t.level);
  for (const a of learned) if (!p.skills.includes(a) && p.skills.length < skillSlots(p)) p.skills.push(a);
  return learned;
}

// Only methods of your own path can be learned
export function learnTechnique(p: Player, id: TechniqueId) {
  if (p.techniques.some((x) => x.id === id) || TECHNIQUES[id].path !== p.path) return false;
  p.techniques.push({ id, level: 1 });
  if (p.side.length < 2) p.side.push(id);
  const first = (Object.keys(ABILITIES) as AbilityId[]).find((a) => ABILITIES[a].from[0] === id && ABILITIES[a].from[1] === 1);
  if (first && p.skills.length < skillSlots(p)) p.skills.push(first);
  return true;
}

export function setMain(g: Game, id: TechniqueId) {
  const p = g.player;
  if (!p.techniques.some((x) => x.id === id)) return;
  const old = p.main;
  p.main = id;
  p.side = p.side.filter((x) => x !== id);
  if (old !== id && p.side.length < 2) p.side.push(old);
  heal(g);
}

// ---- Thần thông ----
export function unlockedAbilities(p: Player): AbilityId[] {
  return (Object.keys(ABILITIES) as AbilityId[]).filter((a) => {
    const [tech, level] = ABILITIES[a].from;
    return (p.techniques.find((t) => t.id === tech)?.level ?? 0) >= level;
  });
}

export function toggleSkill(p: Player, id: AbilityId): boolean {
  if (p.skills.includes(id)) {
    p.skills = p.skills.filter((x) => x !== id);
    return true;
  }
  if (!unlockedAbilities(p).includes(id) || p.skills.length >= skillSlots(p)) return false;
  p.skills.push(id);
  return true;
}

// Abilities cost more qi at higher realms (your qi pool grows too)
export const abilityQi = (p: Player, id: AbilityId) => Math.round(ABILITIES[id].qi * (1 + 0.5 * p.major));

// ---- Pháp bảo ----
export function newTreasure(g: Game, kind: TreasureKind, grade = 0): Treasure {
  return { uid: newUid(g, "t"), kind, grade, level: 1 };
}

export function toggleBound(g: Game, uid: string): boolean {
  const p = g.player;
  if (p.bound.includes(uid)) p.bound = p.bound.filter((x) => x !== uid);
  else if (p.bound.length < treasureSlots(p) && p.treasures.some((t) => t.uid === uid)) p.bound.push(uid);
  else return false;
  heal(g);
  return true;
}

export function canRefine(p: Player, t: Treasure) {
  if (t.level >= 10) {
    if (t.grade >= 3) return { ok: false, upgrade: true, ...upgradeCost(t.grade) };
    const c = upgradeCost(t.grade);
    return { ok: p.stones >= c.stones && (p.bag["yeu-dan"] ?? 0) >= c.cores, upgrade: true, ...c };
  }
  const c = refineCost(t.grade, t.level);
  return { ok: p.stones >= c.stones && (p.bag["yeu-dan"] ?? 0) >= c.cores, upgrade: false, ...c };
}

// Tế luyện: +1 level; at level 10, thăng phẩm: next grade, back to level 1
export function refine(g: Game, uid: string): boolean {
  const p = g.player;
  const t = p.treasures.find((x) => x.uid === uid);
  if (!t) return false;
  const c = canRefine(p, t);
  if (!c.ok) return false;
  p.stones -= c.stones;
  useItem(p, "yeu-dan", c.cores);
  if (c.upgrade) {
    t.grade++;
    t.level = 1;
  } else t.level++;
  heal(g);
  return true;
}

// ---- Trang bị ----
// level: the level of the enemy (or forge) it came from; luck pushes towards better quality
export function rollGear(g: Game, rng: Rng, level: number, luck = 0, slot?: Slot): Gear {
  const s = slot ?? rng.pick(Object.keys(SLOTS) as Slot[]);
  const r = rng.next() + luck;
  const quality = r > 0.97 ? 3 : r > 0.85 ? 2 : r > 0.55 ? 1 : 0;
  const lvl = Math.max(1, Math.round(level));
  const bonus: Partial<Stats> = {};
  for (let i = 0; i < QUALITIES[quality].affixes; i++) {
    const a = rng.pick(AFFIXES);
    bonus[a.stat] = Math.round(((bonus[a.stat] ?? 0) + (a.perTier * gearPower(lvl) * (0.7 + rng.next() * 0.6)) / 1.5) * 100) / 100;
  }
  const tier = gearTier(lvl);
  return { uid: newUid(g, "g"), slot: s, tier, level: lvl, quality, name: GEAR_BASES[s][tier], bonus };
}

export function equip(g: Game, uid: string) {
  const p = g.player;
  const item = p.gear.find((x) => x.uid === uid);
  if (!item) return;
  if (p.equipped[item.slot] === uid) delete p.equipped[item.slot];
  else p.equipped[item.slot] = uid;
  const s = stats(p);
  p.hp = Math.min(p.hp, s.hp);
  p.qi = Math.min(p.qi, s.qi);
}

export const gearPrice = (x: Gear) => Math.round(8 * gearPower(x.level) * (1 + x.quality * 1.5));

export function sellGear(g: Game, uid: string) {
  const p = g.player;
  const item = p.gear.find((x) => x.uid === uid);
  if (!item || Object.values(p.equipped).includes(uid)) return 0;
  p.gear = p.gear.filter((x) => x.uid !== uid);
  p.stones += gearPrice(item);
  return gearPrice(item);
}

// ---- Items ----
export function addItem(bag: Player["bag"], id: ItemId, n = 1) {
  bag[id] = (bag[id] ?? 0) + n;
}
export function useItem(p: Player, id: ItemId, n = 1) {
  const have = p.bag[id] ?? 0;
  if (have < n) return false;
  if (have === n) delete p.bag[id];
  else p.bag[id] = have - n;
  return true;
}
export const isSlip = (id: string): id is `slip-${TechniqueId}` => id.startsWith("slip-");

// Pills at home (in a run, see world.ts)
export function usePillAtHome(g: Game, id: ItemId): boolean {
  const p = g.player;
  if (!(p.bag[id] ?? 0)) return false;
  const s = stats(p);
  if (isSlip(id)) {
    if (!learnTechnique(p, id.slice(5) as TechniqueId)) return false;
  } else if ((id === "hoi-xuan" || id === "dai-hoi-xuan") && p.hp < s.hp) p.hp = Math.min(s.hp, p.hp + Math.ceil(s.hp * (id === "hoi-xuan" ? 0.4 : 0.75)));
  else if (id === "hoi-linh" && p.qi < s.qi) p.qi = Math.min(s.qi, p.qi + Math.ceil(s.qi * 0.5));
  else if (id === "tu-khi" && !readyForTribulation(p) && !atPeak(p)) gainCultivation(p, 2 * meditateGain(p));
  else if (id === "boi-nguyen" && !readyForTribulation(p) && !atPeak(p)) gainCultivation(p, Math.round(needed(p) * 0.2));
  else return false;
  useItem(p, id);
  heal(g);
  return true;
}

export const SHOP: ItemId[] = [
  "hoi-xuan",
  "hoi-linh",
  "tu-khi",
  "dai-hoi-xuan",
  "boi-nguyen",
  "bao-linh-phu",
  "truyen-tong-phu",
  "phu-chi",
  "huyen-thiet",
  "truc-co-dan",
  "ket-kim-dan",
  "hoa-anh-dan",
];
export const shopFor = (p: Player) => SHOP.filter((id) => (ITEMS[id].minMajor ?? 0) <= p.major);
export function buy(g: Game, id: ItemId): boolean {
  const p = g.player;
  const price = ITEMS[id].price;
  if (p.stones < price || !shopFor(p).includes(id)) return false;
  p.stones -= price;
  addItem(p.bag, id);
  return true;
}

// A jade slip for a method of your path you don't know yet (bosses and deep chests drop these)
export function unknownSlip(p: Player): ItemId | null {
  const known = new Set(p.techniques.map((t) => t.id));
  const missing = (Object.keys(TECHNIQUES) as TechniqueId[]).find((t) => TECHNIQUES[t].path === p.path && !known.has(t) && !(p.bag[slipOf(t)] ?? 0));
  return missing ? slipOf(missing) : null;
}
