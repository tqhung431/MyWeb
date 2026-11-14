// Stage 26 · Mầm Thú (Sproutlings): the creatures, the Five Elements and turn-based battles.
//
// Pure rules: no imports, no clock, randomness only from the seeded generator, so the same choices always give the
// same battle. This file exists twice and must stay byte-identical (a test checks): web/features/arena/sprout/sprout.ts
// runs battles against the computer in your browser; api/src/arena/sprout.ts will run battles between people on the
// game server (Stage 27). Our own world: the island of Thanh Khê and its seed-spirits.

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- the Five Elements (Ngũ Hành) ------------------------------------------------------------------
// Each element FEEDS the next (Water → Wood → Fire → Earth → Metal → Water) and TAMES the one two steps on
// (Water tames Fire, Wood tames Earth, Fire tames Metal, Earth tames Water, Metal tames Wood).

export type Element = "water" | "wood" | "fire" | "earth" | "metal";
export const ELEMENTS: Element[] = ["water", "wood", "fire", "earth", "metal"];
export const feeds = (e: Element): Element => ELEMENTS[(ELEMENTS.indexOf(e) + 1) % 5];
export const tames = (e: Element): Element => ELEMENTS[(ELEMENTS.indexOf(e) + 2) % 5];
/** How hard a move of element `a` lands on a creature of element `d` */
export function elementMul(a: Element, d: Element) {
  if (tames(a) === d) return 1.5;
  if (tames(d) === a) return 0.6;
  return 1;
}

// --- moves ------------------------------------------------------------------------------------------

export type MoveId =
  | "splash" | "ripple" | "rainCurtain" | "tidalHug"
  | "leafPoke" | "bambooJab" | "sporeNap" | "grovesBlessing"
  | "emberPounce" | "warmGlow" | "lanternDrift" | "hearthBlaze"
  | "mudToss" | "clayShell" | "potRoll" | "kilnQuake"
  | "chime" | "coinFlick" | "bellGuard" | "grandToll"
  | "nuzzle" | "rest";
export type Move = {
  name: string;
  element: Element | null; // null: no element (plain moves)
  power: number; // 0 for moves that do something else
  accuracy: number; // 0..1
  /** what else it does */
  effect?: "heal" | "guard" | "sleep" | "boostAtk" | "lowerDef" | "drain" | "slowFoe";
  amount?: number;
  /** the element's big signature move */
  signature?: boolean;
};
export const MOVES: Record<MoveId, Move> = {
  // Water
  splash: { name: "Splash", element: "water", power: 40, accuracy: 1 },
  ripple: { name: "Ripple", element: "water", power: 25, accuracy: 1, effect: "slowFoe", amount: 0.8 },
  rainCurtain: { name: "Rain Curtain", element: "water", power: 0, accuracy: 1, effect: "heal", amount: 0.35 },
  tidalHug: { name: "Tidal Hug", element: "water", power: 85, accuracy: 0.9, signature: true },
  // Wood
  leafPoke: { name: "Leaf Poke", element: "wood", power: 40, accuracy: 1 },
  bambooJab: { name: "Bamboo Jab", element: "wood", power: 60, accuracy: 0.95 },
  sporeNap: { name: "Spore Nap", element: "wood", power: 0, accuracy: 0.75, effect: "sleep" },
  grovesBlessing: { name: "Grove's Blessing", element: "wood", power: 70, accuracy: 0.95, effect: "drain", amount: 0.5, signature: true },
  // Fire
  emberPounce: { name: "Ember Pounce", element: "fire", power: 40, accuracy: 1 },
  warmGlow: { name: "Warm Glow", element: "fire", power: 0, accuracy: 1, effect: "boostAtk", amount: 1.3 },
  lanternDrift: { name: "Lantern Drift", element: "fire", power: 55, accuracy: 1 },
  hearthBlaze: { name: "Hearth Blaze", element: "fire", power: 90, accuracy: 0.85, signature: true },
  // Earth
  mudToss: { name: "Mud Toss", element: "earth", power: 35, accuracy: 1, effect: "lowerDef", amount: 0.85 },
  clayShell: { name: "Clay Shell", element: "earth", power: 0, accuracy: 1, effect: "guard" },
  potRoll: { name: "Pot Roll", element: "earth", power: 60, accuracy: 0.95 },
  kilnQuake: { name: "Kiln Quake", element: "earth", power: 85, accuracy: 0.9, signature: true },
  // Metal
  chime: { name: "Chime", element: "metal", power: 40, accuracy: 1 },
  coinFlick: { name: "Coin Flick", element: "metal", power: 55, accuracy: 0.95 },
  bellGuard: { name: "Bell Guard", element: "metal", power: 0, accuracy: 1, effect: "guard" },
  grandToll: { name: "Grand Toll", element: "metal", power: 85, accuracy: 0.9, effect: "slowFoe", amount: 0.85, signature: true },
  // Anyone
  nuzzle: { name: "Nuzzle", element: null, power: 30, accuracy: 1 },
  rest: { name: "Rest", element: null, power: 0, accuracy: 1, effect: "heal", amount: 0.25 },
};

// --- the sproutlings --------------------------------------------------------------------------------

export type SpeciesId =
  | "giot" | "songGiot" | "cheo" | "beo"
  | "mamTre" | "luyTre" | "namLun"
  | "thanHong" | "bepLua" | "denTroi"
  | "gom" | "loGom" | "datSet"
  | "chuongNho" | "daiChuong" | "xu" | "kimChi";
export type Species = {
  name: string; // Vietnamese names; the English description is in the web's names.ts
  element: Element;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  /** moves learned at these levels (a creature keeps its 4 newest) */
  learn: [number, MoveId][];
  grows?: { into: SpeciesId; level: number };
  /** a grown form (only met by growing, or held by shrine keepers) */
  grown?: boolean;
};
export const SPECIES: Record<SpeciesId, Species> = {
  // Water
  giot: { name: "Giọt", element: "water", hp: 44, atk: 42, def: 40, spd: 56, learn: [[1, "nuzzle"], [1, "splash"], [5, "ripple"], [9, "rainCurtain"], [14, "tidalHug"]], grows: { into: "songGiot", level: 12 } },
  songGiot: { name: "Sóng Giọt", element: "water", hp: 64, atk: 62, def: 56, spd: 70, learn: [[1, "splash"], [1, "ripple"], [1, "rainCurtain"], [14, "tidalHug"]], grown: true },
  cheo: { name: "Chèo", element: "water", hp: 52, atk: 46, def: 48, spd: 44, learn: [[1, "nuzzle"], [1, "splash"], [6, "rainCurtain"], [11, "ripple"], [16, "tidalHug"]] },
  beo: { name: "Bèo", element: "wood", hp: 58, atk: 36, def: 56, spd: 34, learn: [[1, "nuzzle"], [1, "leafPoke"], [5, "rest"], [10, "sporeNap"], [15, "grovesBlessing"]] },
  // Wood
  mamTre: { name: "Mầm Tre", element: "wood", hp: 46, atk: 50, def: 46, spd: 44, learn: [[1, "nuzzle"], [1, "leafPoke"], [6, "bambooJab"], [10, "sporeNap"], [14, "grovesBlessing"]], grows: { into: "luyTre", level: 12 } },
  luyTre: { name: "Lũy Tre", element: "wood", hp: 70, atk: 70, def: 68, spd: 52, learn: [[1, "leafPoke"], [1, "bambooJab"], [1, "sporeNap"], [14, "grovesBlessing"]], grown: true },
  namLun: { name: "Nấm Lùn", element: "wood", hp: 56, atk: 40, def: 50, spd: 30, learn: [[1, "nuzzle"], [1, "sporeNap"], [5, "leafPoke"], [9, "rest"], [15, "grovesBlessing"]] },
  // Fire
  thanHong: { name: "Than Hồng", element: "fire", hp: 42, atk: 56, def: 38, spd: 54, learn: [[1, "nuzzle"], [1, "emberPounce"], [6, "warmGlow"], [10, "lanternDrift"], [14, "hearthBlaze"]], grows: { into: "bepLua", level: 12 } },
  bepLua: { name: "Bếp Lửa", element: "fire", hp: 62, atk: 78, def: 54, spd: 66, learn: [[1, "emberPounce"], [1, "warmGlow"], [1, "lanternDrift"], [14, "hearthBlaze"]], grown: true },
  denTroi: { name: "Đèn Trời", element: "fire", hp: 40, atk: 52, def: 36, spd: 64, learn: [[1, "nuzzle"], [1, "lanternDrift"], [6, "warmGlow"], [11, "emberPounce"], [16, "hearthBlaze"]] },
  // Earth
  gom: { name: "Gốm", element: "earth", hp: 52, atk: 44, def: 58, spd: 30, learn: [[1, "nuzzle"], [1, "mudToss"], [6, "clayShell"], [10, "potRoll"], [14, "kilnQuake"]], grows: { into: "loGom", level: 12 } },
  loGom: { name: "Lò Gốm", element: "earth", hp: 78, atk: 62, def: 80, spd: 38, learn: [[1, "mudToss"], [1, "clayShell"], [1, "potRoll"], [14, "kilnQuake"]], grown: true },
  datSet: { name: "Đất Sét", element: "earth", hp: 50, atk: 48, def: 46, spd: 42, learn: [[1, "nuzzle"], [1, "mudToss"], [6, "potRoll"], [10, "rest"], [15, "kilnQuake"]] },
  // Metal
  chuongNho: { name: "Chuông Nhỏ", element: "metal", hp: 46, atk: 46, def: 52, spd: 46, learn: [[1, "nuzzle"], [1, "chime"], [6, "bellGuard"], [10, "coinFlick"], [14, "grandToll"]], grows: { into: "daiChuong", level: 12 } },
  daiChuong: { name: "Đại Chuông", element: "metal", hp: 68, atk: 66, def: 74, spd: 54, learn: [[1, "chime"], [1, "bellGuard"], [1, "coinFlick"], [14, "grandToll"]], grown: true },
  xu: { name: "Xu", element: "metal", hp: 44, atk: 52, def: 56, spd: 40, learn: [[1, "nuzzle"], [1, "coinFlick"], [7, "bellGuard"], [11, "chime"], [16, "grandToll"]] },
  kimChi: { name: "Kim Chỉ", element: "metal", hp: 38, atk: 54, def: 36, spd: 70, learn: [[1, "nuzzle"], [1, "chime"], [5, "coinFlick"], [10, "rest"], [15, "grandToll"]] },
};
export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];
export const MAX_LEVEL = 30;

// --- a creature you own -----------------------------------------------------------------------------

export type Creature = { uid: number; species: SpeciesId; level: number; xp: number; hp: number; moves: MoveId[]; nickname?: string };
export type Stats = { hp: number; atk: number; def: number; spd: number };

export function statsOf(c: { species: SpeciesId; level: number }): Stats {
  const s = SPECIES[c.species];
  const k = 0.5 + c.level * 0.1;
  return { hp: Math.round(s.hp * k) + 12, atk: Math.round(s.atk * k) + 5, def: Math.round(s.def * k) + 5, spd: Math.round(s.spd * k) + 5 };
}
/** The (up to) 4 newest moves it knows at this level */
export function movesAt(species: SpeciesId, level: number): MoveId[] {
  const known = SPECIES[species].learn.filter(([l]) => l <= level).map(([, m]) => m);
  return [...new Set(known)].slice(-4);
}
export function makeCreature(uid: number, species: SpeciesId, level: number): Creature {
  return { uid, species, level, xp: 0, hp: statsOf({ species, level }).hp, moves: movesAt(species, level) };
}
/** XP needed to go from this level to the next */
export const xpToNext = (level: number) => 10 + level * 6;

/** Gain XP; returns the levels reached and moves learned on the way */
export function gainXp(c: Creature, xp: number): { levels: number[]; learned: MoveId[] } {
  const out = { levels: [] as number[], learned: [] as MoveId[] };
  c.xp += xp;
  while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    const before = statsOf(c).hp;
    c.level++;
    c.hp += statsOf(c).hp - before; // the new health comes on top
    out.levels.push(c.level);
    for (const [l, m] of SPECIES[c.species].learn)
      if (l === c.level && !c.moves.includes(m)) {
        c.moves = [...c.moves, m].slice(-4);
        out.learned.push(m);
      }
  }
  if (c.level >= MAX_LEVEL) c.xp = 0;
  return out;
}
/** Can it grow (at a shrine) now? */
export const canGrow = (c: Creature) => !!SPECIES[c.species].grows && c.level >= SPECIES[c.species].grows!.level;
export function grow(c: Creature) {
  const g = SPECIES[c.species].grows;
  if (!g || c.level < g.level) return false;
  const before = statsOf(c);
  c.species = g.into;
  c.hp = Math.min(statsOf(c).hp, c.hp + statsOf(c).hp - before.hp);
  // keeps its moves, and learns what the grown form would know by now
  for (const m of movesAt(c.species, c.level)) if (!c.moves.includes(m)) c.moves = [...c.moves, m].slice(-4);
  return true;
}

// --- battles ----------------------------------------------------------------------------------------

export type Fighter = Creature & { atkMul: number; defMul: number; spdMul: number; guard: boolean; sleep: number };
export type Side = { team: Fighter[]; active: number; ai: boolean };
export type BattleAction = { t: "move"; i: number } | { t: "switch"; to: number } | { t: "befriend" } | { t: "run" };
export type BattleEvent =
  | { t: "move"; side: number; move: MoveId; missed?: boolean }
  | { t: "damage"; side: number; amount: number; mul: number }
  | { t: "heal"; side: number; amount: number; fed?: boolean }
  | { t: "status"; side: number; what: "sleep" | "wake" | "guard" | "boostAtk" | "lowerDef" | "slow" | "asleep" }
  | { t: "faint"; side: number; uid: number }
  | { t: "switch"; side: number; to: number }
  | { t: "befriend"; side: number }
  | { t: "run" }
  | { t: "end"; winner: number | null };
export type Battle = {
  sides: [Side, Side];
  wild: boolean;
  turn: number;
  /** a side whose creature fainted must pick the next one before the battle goes on */
  needSwitch: [boolean, boolean];
  over: boolean;
  winner: number | null; // 0 or 1; null = ran away / befriended
  ended: "win" | "lose" | "ran" | "befriend" | null;
  random: () => number;
  log: BattleEvent[]; // what happened in the last turn (for the screen)
};

const toFighter = (c: Creature): Fighter => ({ ...c, moves: [...c.moves], atkMul: 1, defMul: 1, spdMul: 1, guard: false, sleep: 0 });

export function newBattle(mine: Creature[], theirs: Creature[], seed: number, wild = false): Battle {
  const first = (team: Fighter[]) => Math.max(0, team.findIndex((c) => c.hp > 0));
  const a = mine.slice(0, 3).map(toFighter);
  const b = theirs.slice(0, 3).map(toFighter);
  return {
    sides: [
      { team: a, active: first(a), ai: false },
      { team: b, active: first(b), ai: true },
    ],
    wild,
    turn: 0,
    needSwitch: [false, false],
    over: false,
    winner: null,
    ended: null,
    random: rng(seed),
    log: [],
  };
}
export const activeOf = (b: Battle, side: number) => b.sides[side].team[b.sides[side].active];

/** The damage a move would do, before the random part (for the computer's choices and for tests) */
export function baseDamage(attacker: Fighter, defender: Fighter, move: Move) {
  if (!move.power) return 0;
  const a = statsOf(attacker).atk * attacker.atkMul;
  const d = statsOf(defender).def * defender.defMul;
  const sp = SPECIES[attacker.species];
  const stab = move.element && move.element === sp.element ? 1.2 : 1;
  const mul = move.element ? elementMul(move.element, SPECIES[defender.species].element) : 1;
  return ((move.power * (a / d) * (attacker.level * 0.4 + 2)) / 9 + 2) * stab * mul;
}

function useMove(b: Battle, side: number, i: number) {
  const me = activeOf(b, side);
  const foe = activeOf(b, 1 - side);
  const id = me.moves[i] ?? me.moves[0];
  const move = MOVES[id];
  if (me.sleep > 0) {
    me.sleep--;
    b.log.push({ t: "status", side, what: me.sleep > 0 ? "asleep" : "wake" });
    if (me.sleep > 0) return;
  }
  const missed = b.random() > move.accuracy;
  b.log.push({ t: "move", side, move: id, missed: missed || undefined });
  if (missed) return;
  const st = statsOf(me);
  if (move.power > 0) {
    let dmg = baseDamage(me, foe, move) * (0.85 + b.random() * 0.15);
    if (foe.guard) dmg *= 0.4;
    const amount = Math.max(1, Math.min(foe.hp, Math.round(dmg)));
    foe.hp -= amount;
    b.log.push({ t: "damage", side: 1 - side, amount, mul: move.element ? elementMul(move.element, SPECIES[foe.species].element) : 1 });
    if (move.effect === "drain") heal(b, side, Math.round(amount * (move.amount ?? 0.5)));
  }
  switch (move.effect) {
    case "heal":
      heal(b, side, Math.round(st.hp * (move.amount ?? 0.3)));
      break;
    case "guard":
      me.guard = true;
      b.log.push({ t: "status", side, what: "guard" });
      break;
    case "sleep":
      if (foe.hp > 0 && foe.sleep === 0) {
        foe.sleep = 1 + Math.floor(b.random() * 2);
        b.log.push({ t: "status", side: 1 - side, what: "sleep" });
      }
      break;
    case "boostAtk":
      me.atkMul = Math.min(2, me.atkMul * (move.amount ?? 1.3));
      b.log.push({ t: "status", side, what: "boostAtk" });
      break;
    case "lowerDef":
      foe.defMul = Math.max(0.5, foe.defMul * (move.amount ?? 0.85));
      b.log.push({ t: "status", side: 1 - side, what: "lowerDef" });
      break;
    case "slowFoe":
      foe.spdMul = Math.max(0.5, foe.spdMul * (move.amount ?? 0.8));
      b.log.push({ t: "status", side: 1 - side, what: "slow" });
      break;
  }
}
function heal(b: Battle, side: number, amount: number, fed = false) {
  const me = activeOf(b, side);
  const real = Math.min(amount, statsOf(me).hp - me.hp);
  if (real <= 0) return;
  me.hp += real;
  b.log.push({ t: "heal", side, amount: real, fed: fed || undefined });
}
function doSwitch(b: Battle, side: number, to: number) {
  const s = b.sides[side];
  if (to === s.active || !s.team[to] || s.team[to].hp <= 0) return false;
  const out = s.team[s.active];
  Object.assign(out, { atkMul: 1, defMul: 1, spdMul: 1, guard: false }); // boosts wear off when it rests
  s.active = to;
  b.log.push({ t: "switch", side, to });
  return true;
}
const alive = (s: Side) => s.team.some((c) => c.hp > 0);

/** Is this action allowed now? (null = yes, else why not) */
export function checkAction(b: Battle, side: number, a: BattleAction): string | null {
  if (b.over) return "The battle is over";
  const s = b.sides[side];
  if (b.needSwitch[side] && a.t !== "switch") return "Pick who goes next";
  if (a.t === "move") return a.i >= 0 && a.i < activeOf(b, side).moves.length ? null : "Unknown move";
  if (a.t === "switch") return s.team[a.to] && s.team[a.to].hp > 0 && a.to !== s.active ? null : "It can't go in now";
  if (a.t === "befriend" || a.t === "run") return b.wild ? null : "Only with wild sproutlings";
  return "Unknown action";
}

/** The computer's choice: the strongest hit (with a little randomness), healing when low, switching away from a bad matchup */
export function aiAction(b: Battle, side: number): BattleAction {
  const s = b.sides[side];
  if (b.needSwitch[side]) {
    let best = -1;
    let score = -Infinity;
    const foe = activeOf(b, 1 - side);
    s.team.forEach((c, i) => {
      if (c.hp <= 0) return;
      const sc = c.hp / statsOf(c).hp + elementMul(SPECIES[c.species].element, SPECIES[foe.species].element) - elementMul(SPECIES[foe.species].element, SPECIES[c.species].element);
      if (sc > score) [score, best] = [sc, i];
    });
    return { t: "switch", to: best };
  }
  const me = activeOf(b, side);
  const foe = activeOf(b, 1 - side);
  const myHp = me.hp / statsOf(me).hp;
  let bestI = 0;
  let bestScore = -Infinity;
  me.moves.forEach((id, i) => {
    const m = MOVES[id];
    let sc = baseDamage(me, foe, m) * m.accuracy;
    if (m.effect === "heal") sc = myHp < 0.4 ? statsOf(me).hp * (m.amount ?? 0.3) * 1.2 : 0;
    if (m.effect === "guard") sc = myHp < 0.5 && !me.guard ? statsOf(me).hp * 0.15 : 0;
    if (m.effect === "sleep") sc = foe.sleep === 0 ? statsOf(foe).hp * 0.2 * m.accuracy : 0;
    if (m.effect === "boostAtk") sc = me.atkMul < 1.6 && myHp > 0.6 ? baseDamage(me, foe, MOVES.emberPounce) * 0.8 : 0;
    if (m.effect === "drain") sc *= 1 + (1 - myHp) * 0.5;
    sc *= 0.8 + b.random() * 0.4;
    if (sc > bestScore) [bestScore, bestI] = [sc, i];
  });
  return { t: "move", i: bestI };
}

/** One turn: both sides choose, then everything happens in order (switches first, then the faster creature) */
export function playTurn(b: Battle, a0: BattleAction, a1: BattleAction) {
  b.log = [];
  if (b.over) return b;
  const acts: [BattleAction, BattleAction] = [a0, a1];
  // A forced switch after a faint isn't a turn: it only brings the next creature in
  if (b.needSwitch[0] || b.needSwitch[1]) {
    for (const side of [0, 1])
      if (b.needSwitch[side]) {
        const act = acts[side];
        if (act.t === "switch" && doSwitch(b, side, act.to)) b.needSwitch[side] = false;
      }
    return b;
  }
  b.turn++;
  for (const side of [0, 1]) activeOf(b, side).guard = false;
  // Leaving: running away, befriending (wild battles only)
  if (a0.t === "run") {
    b.log.push({ t: "run" });
    return finish(b, null, "ran");
  }
  if (a0.t === "befriend") {
    b.log.push({ t: "befriend", side: 0 });
    return finish(b, null, "befriend");
  }
  // Switches go first; switching costs your move
  for (const side of [0, 1]) {
    const act = acts[side];
    if (act.t === "switch") doSwitch(b, side, act.to);
  }
  const order = [0, 1].filter((side) => acts[side].t === "move");
  if (order.length === 2) {
    const sp = (side: number) => statsOf(activeOf(b, side)).spd * activeOf(b, side).spdMul;
    if (sp(1) > sp(0) || (sp(1) === sp(0) && b.random() < 0.5)) order.reverse();
  }
  for (const side of order) {
    if (activeOf(b, side).hp <= 0 || b.over) continue;
    useMove(b, side, (acts[side] as { i: number }).i);
    if (afterHits(b)) return b;
  }
  // Fed by a friend: if someone resting on the bench feeds the active creature's element, it gets a little health back
  for (const side of [0, 1]) {
    const s = b.sides[side];
    const me = s.team[s.active];
    if (me.hp <= 0) continue;
    const helper = s.team.some((c, i) => i !== s.active && c.hp > 0 && feeds(SPECIES[c.species].element) === SPECIES[me.species].element);
    if (helper) heal(b, side, Math.max(1, Math.round(statsOf(me).hp * 0.05)), true);
  }
  return b;
}
/** Faints, forced switches and the end */
function afterHits(b: Battle) {
  for (const side of [0, 1]) {
    const s = b.sides[side];
    const c = s.team[s.active];
    if (c.hp > 0 || b.needSwitch[side]) continue;
    b.log.push({ t: "faint", side, uid: c.uid });
    if (b.wild && side === 1) {
      // a wild sproutling that's knocked out runs off home: no friendship today
      finish(b, 0, "win");
      return true;
    }
    if (!alive(s)) {
      finish(b, 1 - side, side === 0 ? "lose" : "win");
      return true;
    }
    b.needSwitch[side] = true;
  }
  return b.needSwitch[0] || b.needSwitch[1];
}
function finish(b: Battle, winner: number | null, how: Battle["ended"]) {
  b.over = true;
  b.winner = winner;
  b.ended = how;
  b.log.push({ t: "end", winner });
  return b;
}

/** XP for beating a creature */
export const xpFor = (c: { level: number; species: SpeciesId }) => Math.round(6 + c.level * 3.2 * (SPECIES[c.species].grown ? 1.4 : 1));

/**
 * How easy befriending is (0..1): calmer (lower health) and sleepy sproutlings trust you more, and so do ones whose
 * element your lead creature feeds (a friend of the family). The mini-game's score adds to this.
 */
export function befriendBonus(wild: Fighter, lead: { species: SpeciesId } | null) {
  const calm = 1 - wild.hp / statsOf(wild).hp; // 0 = untouched, 1 = nearly out
  let bonus = calm * 0.35 + (wild.sleep > 0 ? 0.1 : 0);
  if (lead && feeds(SPECIES[lead.species].element) === SPECIES[wild.species].element) bonus += 0.1;
  return Math.min(0.5, bonus);
}
/** Score from the mini-game (0..1) + the bonus; 0.6 or more = a new friend */
export const BEFRIEND_AT = 0.6;
