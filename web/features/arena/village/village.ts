// Stage 24 · Giữ Làng (Keep the Village): the rules of the tower-defense game. This file exists TWICE, byte for byte:
//   api/src/arena/village.ts                  (the game server runs co-op games for two)
//   web/features/arena/village/village.ts     (solo games run entirely in your browser)
// api/tests/village.test.ts fails if the two copies differ. Change one, copy it to the other. No imports here.
//
// Mischievous spirits walk winding paths to the village granary to steal rice (they don't hurt anyone).
// Build defenders on the free spots beside the paths, between and during waves. Lose 20 sacks and the night is lost;
// survive 30 waves and the village is safe (or keep going in endless mode).
//
// Everything is plain data and the time is passed in: no randomness, so the same moves always give the same game.
// Distances are in tiles; times in ms of game time (×2 speed simply means bigger steps).

export const COLS = 16;
export const ROWS = 10;
export const WAVES = 30;
export const START_RICE = 20;

export type MapId = "riverside" | "terraces" | "festival";
export type Pt = [number, number];
type MapDef = { paths: [Pt[], Pt[]]; water: Pt[]; trees: Pt[] };

// Each map: two entrances (path 0 and path 1) that meet before the granary (the last point of both paths).
export const MAPS: Record<MapId, MapDef> = {
  riverside: {
    paths: [
      [[0, 1], [4, 1], [4, 4], [8, 4], [8, 2], [12, 2], [12, 5], [15, 5]],
      [[0, 8], [3, 8], [3, 6], [6, 6], [6, 8], [10, 8], [10, 5], [12, 5], [15, 5]],
    ],
    water: [[13, 7], [14, 7], [15, 7], [13, 8], [14, 8], [15, 8], [14, 9], [15, 9], [13, 9], [12, 9]],
    trees: [[1, 4], [0, 5], [6, 0], [15, 0], [14, 1], [9, 6]],
  },
  terraces: {
    paths: [
      [[0, 0], [2, 0], [2, 3], [6, 3], [6, 1], [10, 1], [10, 4], [15, 4]],
      [[0, 9], [4, 9], [4, 6], [8, 6], [8, 8], [12, 8], [12, 4], [15, 4]],
    ],
    water: [],
    trees: [[0, 5], [1, 6], [14, 9], [15, 8], [14, 0], [15, 1]],
  },
  festival: {
    paths: [
      [[2, 0], [2, 3], [5, 3], [5, 1], [9, 1], [9, 4], [15, 4]],
      [[2, 9], [2, 6], [6, 6], [6, 8], [10, 8], [10, 4], [15, 4]],
    ],
    water: [],
    trees: [[0, 0], [0, 9], [13, 0], [13, 9], [15, 9], [15, 0]],
  },
};
export const MAP_IDS = Object.keys(MAPS) as MapId[];

// --- defenders ---------------------------------------------------------------------------------

export type TowerKind = "archer" | "lantern" | "drum" | "kite" | "cart";
export const TOWER_KINDS: TowerKind[] = ["archer", "lantern", "drum", "kite", "cart"];
export type Branch = "a" | "b";

export const TOWER_COST: Record<TowerKind, number> = { archer: 60, lantern: 70, drum: 90, kite: 80, cart: 100 };
export const upgradeCost = (kind: TowerKind, level: number) => Math.round(TOWER_COST[kind] * (level === 1 ? 0.9 : 1.4));

/** What a defender does at its level and branch (level 1 has no branch; 2 and 3 do) */
export function stats(kind: TowerKind, level: number, branch: Branch | null) {
  const l = level - 1; // 0, 1, 2
  const a = branch === "a" ? l : 0;
  const b = branch === "b" ? l : 0;
  switch (kind) {
    case "archer": // Rapid fire (a) or Piercing arrows (b)
      return { range: 2.6, cooldown: [600, 390, 250][a] + (b ? 100 : 0), damage: b ? [10, 22, 34][b] : 10 + a * 3, pierce: b, air: false };
    case "kite": // Twin kites (a) or Long range (b)
      return { range: 3 + b, cooldown: 800, damage: a ? [14, 16, 20][a] : [14, 22, 30][b], targets: 1 + a, air: true };
    case "lantern": // Wider light (a) or Burns (b)
      return { range: 1.8 + a * 0.6, slow: [0.65, 0.55, 0.5][a], burn: [0, 8, 16][b] };
    case "drum": // Louder (a) or Longer stun (b)
      return { range: 1.5 + a * 0.6, cooldown: [4000, 3500, 3000][b], stun: [700, 1200, 1700][b], damage: 6 + a * 4 };
    case "cart": // Faster (a: coins during waves) or Bigger (b: more coins after each wave)
      return { income: [20, 45, 75][b] || 20, trickle: [0, 3, 6][a], trickleEvery: 4000 };
  }
}

// --- spirits -----------------------------------------------------------------------------------

export type SpiritKind = "fox" | "turtle" | "crane" | "gourd" | "gourdlet" | "rabbit";
export const SPIRITS: Record<SpiritKind, { hp: number; speed: number; armor: number; reward: number; rice: number; flying: boolean }> = {
  fox: { hp: 28, speed: 2.0, armor: 0, reward: 4, rice: 1, flying: false },
  turtle: { hp: 95, speed: 0.85, armor: 4, reward: 9, rice: 2, flying: false },
  crane: { hp: 40, speed: 1.4, armor: 0, reward: 7, rice: 1, flying: true },
  gourd: { hp: 60, speed: 1.1, armor: 0, reward: 6, rice: 1, flying: false }, // splits in two when beaten
  gourdlet: { hp: 22, speed: 1.7, armor: 0, reward: 2, rice: 1, flying: false },
  rabbit: { hp: 700, speed: 0.6, armor: 5, reward: 150, rice: 8, flying: false }, // the Moon-Rabbit of Mischief, every 10 waves
};

/** How much tougher spirits are in wave n (they keep growing in endless mode) */
export const toughness = (n: number) => 1 + 0.11 * (n - 1) + (n > WAVES ? 0.05 * (n - WAVES) ** 1.4 : 0);

/** Who comes in wave n: groups of spirits, one after the other */
export function waveGroups(n: number): { kind: SpiritKind; count: number; gap: number }[] {
  const groups: { kind: SpiritKind; count: number; gap: number }[] = [{ kind: "fox", count: 5 + n, gap: 520 }];
  if (n >= 3) groups.push({ kind: "turtle", count: Math.floor(n / 3), gap: 1300 });
  if (n >= 4 && n % 3 === 1) groups.push({ kind: "crane", count: 3 + Math.floor(n / 4), gap: 900 });
  if (n >= 6) groups.push({ kind: "gourd", count: Math.floor((n - 3) / 3), gap: 1000 });
  if (n % 10 === 0) groups.push({ kind: "rabbit", count: Math.max(1, Math.floor(n / 30)), gap: 3000 });
  return groups;
}

// --- the game ----------------------------------------------------------------------------------

export type Tower = { id: number; kind: TowerKind; tx: number; ty: number; level: number; branch: Branch | null; owner: string; spent: number; cooldown: number; trickle: number };
export type Spirit = {
  id: number;
  kind: SpiritKind;
  path: 0 | 1;
  d: number; // how far along its path, in tiles
  hp: number;
  maxHp: number;
  stunUntil: number;
  x: number;
  y: number;
};
export type VillageEvent =
  | { t: "shot"; from: number; x: number; y: number; kind: TowerKind }
  | { t: "boom"; from: number } // a drum beat
  | { t: "pop"; x: number; y: number; kind: SpiritKind; coins: number }
  | { t: "steal"; kind: SpiritKind; rice: number }
  | { t: "split"; x: number; y: number }
  | { t: "coins"; x: number; y: number; coins: number }
  | { t: "wave"; n: number }
  | { t: "cleared"; n: number; bonus: number };

export type Player = { id: string; name: string; side: 0 | 1 | null }; // side null = may build anywhere (solo)
export type VillageGame = {
  map: MapId;
  endless: boolean;
  players: Player[];
  coins: Record<string, number>;
  rice: number;
  wave: number; // the wave being played, or the last one cleared while building
  cleared: number;
  phase: "build" | "wave" | "won" | "lost";
  buildLeft: number; // ms until the next wave starts by itself
  time: number;
  waveTime: number;
  queue: { at: number; kind: SpiritKind; path: 0 | 1 }[];
  towers: Tower[];
  spirits: Spirit[];
  nextId: number;
  events: VillageEvent[];
};

export const FIRST_BUILD = 30_000;
export const BUILD_TIME = 20_000;

// Path geometry: tile centres, lengths, and the point at a distance
const centre = (p: Pt): Pt => [p[0] + 0.5, p[1] + 0.5];
const lengths = new Map<Pt[], number[]>();
function cumulative(path: Pt[]) {
  let c = lengths.get(path);
  if (!c) {
    c = [0];
    for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    lengths.set(path, c);
  }
  return c;
}
const flights = new Map<string, Pt[]>();
/** The way a spirit goes: its path, or for fliers a straight line from the entrance to the granary */
export function routeOf(map: MapId, path: 0 | 1, flying: boolean): Pt[] {
  const p = MAPS[map].paths[path];
  if (!flying) return p;
  const key = `${map}:${path}`;
  let f = flights.get(key);
  if (!f) flights.set(key, (f = [p[0], p[p.length - 1]]));
  return f;
}
export function routeLength(route: Pt[]) {
  const c = cumulative(route);
  return c[c.length - 1];
}
export function pointAt(route: Pt[], d: number): Pt {
  const c = cumulative(route);
  for (let i = 1; i < route.length; i++) {
    if (d <= c[i]) {
      const k = (d - c[i - 1]) / (c[i] - c[i - 1] || 1);
      const a = centre(route[i - 1]);
      const b = centre(route[i]);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
  }
  return centre(route[route.length - 1]);
}

/** Every tile a path walks over */
export function pathTiles(map: MapId): Set<string> {
  const out = new Set<string>();
  for (const path of MAPS[map].paths)
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1];
      const [x1, y1] = path[i];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) out.add(`${Math.round(x0 + ((x1 - x0) * s) / steps)},${Math.round(y0 + ((y1 - y0) * s) / steps)}`);
    }
  return out;
}

/** Where defenders can stand: free grass next to a path. `side` is the path it's closest to (co-op: whose spot it is). */
export function buildSpots(map: MapId): { tx: number; ty: number; side: 0 | 1 }[] {
  const onPath = pathTiles(map);
  const blocked = new Set([...MAPS[map].water, ...MAPS[map].trees].map(([x, y]) => `${x},${y}`));
  const granary = MAPS[map].paths[0][MAPS[map].paths[0].length - 1];
  const sideTiles = MAPS[map].paths.map((p) => {
    const one = new Set<string>();
    for (let i = 1; i < p.length; i++) {
      const steps = Math.max(Math.abs(p[i][0] - p[i - 1][0]), Math.abs(p[i][1] - p[i - 1][1]));
      for (let s = 0; s <= steps; s++)
        one.add(`${Math.round(p[i - 1][0] + ((p[i][0] - p[i - 1][0]) * s) / steps)},${Math.round(p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * s) / steps)}`);
    }
    return [...one].map((k) => k.split(",").map(Number) as Pt);
  });
  const spots: { tx: number; ty: number; side: 0 | 1 }[] = [];
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++) {
      const k = `${tx},${ty}`;
      if (onPath.has(k) || blocked.has(k) || (tx === granary[0] && Math.abs(ty - granary[1]) <= 1)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (onPath.has(`${tx + dx},${ty + dy}`)) near = true;
      if (!near) continue;
      const dist = (tiles: Pt[]) => Math.min(...tiles.map(([x, y]) => Math.abs(x - tx) + Math.abs(y - ty)));
      spots.push({ tx, ty, side: dist(sideTiles[0]) <= dist(sideTiles[1]) ? 0 : 1 });
    }
  return spots;
}

export function newVillage(map: MapId, players: Player[], endless = false): VillageGame {
  const each = players.length > 1 ? 110 : 160;
  return {
    map,
    endless,
    players,
    coins: Object.fromEntries(players.map((p) => [p.id, each])),
    rice: START_RICE,
    wave: 0,
    cleared: 0,
    phase: "build",
    buildLeft: FIRST_BUILD,
    time: 0,
    waveTime: 0,
    queue: [],
    towers: [],
    spirits: [],
    nextId: 1,
    events: [],
  };
}

// --- what players can do -----------------------------------------------------------------------

export type VillageAction =
  | { a: "build"; tx: number; ty: number; kind: TowerKind }
  | { a: "upgrade"; id: number; branch?: Branch }
  | { a: "sell"; id: number }
  | { a: "next" };

/** Do something. Returns an error message, or null when it worked. */
export function act(g: VillageGame, playerId: string, action: VillageAction): string | null {
  const player = g.players.find((p) => p.id === playerId);
  if (!player) return "You're watching this game";
  if (g.phase === "won" || g.phase === "lost") return "The game is over";
  if (action.a === "build") {
    const spot = buildSpots(g.map).find((s) => s.tx === action.tx && s.ty === action.ty);
    if (!spot) return "You can't build there";
    if (player.side !== null && spot.side !== player.side) return "That's your partner's side";
    if (g.towers.some((t) => t.tx === action.tx && t.ty === action.ty)) return "There's already a defender there";
    const cost = TOWER_COST[action.kind];
    if (cost === undefined) return "Unknown defender";
    if (g.coins[playerId] < cost) return "Not enough coins";
    g.coins[playerId] -= cost;
    g.towers.push({ id: g.nextId++, kind: action.kind, tx: action.tx, ty: action.ty, level: 1, branch: null, owner: playerId, spent: cost, cooldown: 0, trickle: 0 });
    return null;
  }
  if (action.a === "upgrade" || action.a === "sell") {
    const t = g.towers.find((x) => x.id === action.id);
    if (!t) return "That defender is gone";
    if (t.owner !== playerId) return "That's your partner's defender";
    if (action.a === "sell") {
      g.coins[playerId] += Math.floor(t.spent * 0.7);
      g.towers = g.towers.filter((x) => x !== t);
      return null;
    }
    if (t.level >= 3) return "It's as strong as it gets";
    if (t.level === 1 && action.branch !== "a" && action.branch !== "b") return "Pick an upgrade";
    const cost = upgradeCost(t.kind, t.level);
    if (g.coins[playerId] < cost) return "Not enough coins";
    g.coins[playerId] -= cost;
    t.spent += cost;
    if (t.level === 1) t.branch = action.branch!;
    t.level++;
    return null;
  }
  if (action.a === "next") {
    if (g.phase !== "build") return "A wave is already coming";
    // Calling the next wave early earns the seconds you skipped, as coins (for everyone)
    const bonus = Math.floor(g.buildLeft / 1000);
    for (const p of g.players) g.coins[p.id] += bonus;
    startWave(g);
    return null;
  }
  return "Unknown action";
}

function startWave(g: VillageGame) {
  g.wave = g.cleared + 1;
  g.phase = "wave";
  g.waveTime = 0;
  g.queue = [];
  let at = 0;
  let path: 0 | 1 = 0;
  for (const group of waveGroups(g.wave)) {
    for (let i = 0; i < group.count; i++) {
      g.queue.push({ at, kind: group.kind, path });
      path = path === 0 ? 1 : 0;
      at += group.gap;
    }
    at += 1500;
  }
  g.events.push({ t: "wave", n: g.wave });
}

function spawn(g: VillageGame, kind: SpiritKind, path: 0 | 1, d = 0) {
  const s = SPIRITS[kind];
  const hp = Math.round(s.hp * toughness(g.wave));
  const [x, y] = pointAt(routeOf(g.map, path, s.flying), d);
  g.spirits.push({ id: g.nextId++, kind, path, d, hp, maxHp: hp, stunUntil: 0, x, y });
}

function hurt(g: VillageGame, s: Spirit, damage: number, armored = true) {
  s.hp -= armored ? Math.max(1, damage - SPIRITS[s.kind].armor) : damage;
}

/** First = furthest along its way to the granary (the one about to steal) */
const progress = (g: VillageGame, s: Spirit) => s.d / routeLength(routeOf(g.map, s.path, SPIRITS[s.kind].flying));
function inRange(t: Tower, s: Spirit, range: number) {
  return Math.hypot(s.x - (t.tx + 0.5), s.y - (t.ty + 0.5)) <= range;
}

function towersAct(g: VillageGame, dt: number) {
  const slow = new Map<number, number>();
  for (const t of g.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.kind === "lantern") {
      const st = stats("lantern", t.level, t.branch) as { range: number; slow: number; burn: number };
      for (const s of g.spirits) {
        if (SPIRITS[s.kind].flying || !inRange(t, s, st.range)) continue;
        slow.set(s.id, Math.min(slow.get(s.id) ?? 1, st.slow));
        if (st.burn) hurt(g, s, (st.burn * dt) / 1000, false);
      }
      continue;
    }
    if (t.kind === "cart") {
      const st = stats("cart", t.level, t.branch) as { trickle: number; trickleEvery: number };
      if (st.trickle && g.phase === "wave") {
        t.trickle += dt;
        if (t.trickle >= st.trickleEvery) {
          t.trickle -= st.trickleEvery;
          g.coins[t.owner] = (g.coins[t.owner] ?? 0) + st.trickle;
          g.events.push({ t: "coins", x: t.tx + 0.5, y: t.ty + 0.5, coins: st.trickle });
        }
      }
      continue;
    }
    if (t.cooldown > 0) continue;
    if (t.kind === "drum") {
      const st = stats("drum", t.level, t.branch) as { range: number; cooldown: number; stun: number; damage: number };
      const hit = g.spirits.filter((s) => !SPIRITS[s.kind].flying && inRange(t, s, st.range));
      if (!hit.length) continue;
      for (const s of hit) {
        s.stunUntil = Math.max(s.stunUntil, g.time + st.stun);
        hurt(g, s, st.damage);
      }
      t.cooldown = st.cooldown;
      g.events.push({ t: "boom", from: t.id });
      continue;
    }
    // Archers and kites shoot the first spirit in range
    const st = stats(t.kind, t.level, t.branch) as { range: number; cooldown: number; damage: number; air: boolean; pierce?: number; targets?: number };
    const candidates = g.spirits.filter((s) => (t.kind === "kite" || !SPIRITS[s.kind].flying) && s.hp > 0 && inRange(t, s, st.range)).sort((a, b) => progress(g, b) - progress(g, a));
    if (!candidates.length) continue;
    const targets = candidates.slice(0, st.targets ?? 1);
    for (const target of targets) {
      hurt(g, target, st.damage);
      g.events.push({ t: "shot", from: t.id, x: target.x, y: target.y, kind: t.kind });
      // Piercing arrows also hit the spirits right behind
      if (st.pierce) {
        const behind = g.spirits
          .filter((s) => s !== target && !SPIRITS[s.kind].flying && Math.hypot(s.x - target.x, s.y - target.y) < 1)
          .slice(0, st.pierce);
        for (const s of behind) hurt(g, s, st.damage * 0.6);
      }
    }
    t.cooldown = st.cooldown;
  }
  return slow;
}

/** Move the game on by `dt` ms of game time. The caller multiplies dt for ×2 speed. */
export function stepVillage(g: VillageGame, dt: number) {
  if (g.phase === "won" || g.phase === "lost") return;
  g.time += dt;
  if (g.phase === "build") {
    g.buildLeft -= dt;
    if (g.buildLeft <= 0) startWave(g);
    return;
  }
  g.waveTime += dt;
  while (g.queue.length && g.queue[0].at <= g.waveTime) {
    const q = g.queue.shift()!;
    spawn(g, q.kind, q.path);
  }
  const slow = towersAct(g, dt);
  // Beaten spirits: coins for everyone, and gourds split in two
  for (const s of g.spirits.filter((x) => x.hp <= 0)) {
    const reward = SPIRITS[s.kind].reward;
    for (const p of g.players) g.coins[p.id] += g.players.length > 1 ? Math.ceil(reward / 2) : reward;
    g.events.push({ t: "pop", x: s.x, y: s.y, kind: s.kind, coins: reward });
    if (s.kind === "gourd") {
      spawn(g, "gourdlet", s.path, Math.max(0, s.d - 0.25));
      spawn(g, "gourdlet", s.path, s.d + 0.15);
      g.events.push({ t: "split", x: s.x, y: s.y });
    }
  }
  g.spirits = g.spirits.filter((s) => s.hp > 0);
  // Walk on (slowed by lantern light, frozen by the drum)
  for (const s of g.spirits) {
    if (s.stunUntil > g.time) continue;
    const info = SPIRITS[s.kind];
    const route = routeOf(g.map, s.path, info.flying);
    s.d += (info.speed * (slow.get(s.id) ?? 1) * dt) / 1000;
    [s.x, s.y] = pointAt(route, s.d);
    if (s.d >= routeLength(route)) {
      g.rice = Math.max(0, g.rice - info.rice);
      g.events.push({ t: "steal", kind: s.kind, rice: info.rice });
      s.hp = 0;
    }
  }
  g.spirits = g.spirits.filter((s) => s.hp > 0);
  if (g.rice <= 0) {
    g.phase = "lost";
    return;
  }
  if (!g.queue.length && !g.spirits.length) {
    g.cleared = g.wave;
    const bonus = 25 + g.wave * 3;
    for (const p of g.players) g.coins[p.id] += bonus;
    for (const t of g.towers)
      if (t.kind === "cart") {
        const income = (stats("cart", t.level, t.branch) as { income: number }).income;
        g.coins[t.owner] = (g.coins[t.owner] ?? 0) + income;
        g.events.push({ t: "coins", x: t.tx + 0.5, y: t.ty + 0.5, coins: income });
      }
    g.events.push({ t: "cleared", n: g.wave, bonus });
    if (g.cleared >= WAVES && !g.endless) {
      g.phase = "won";
      return;
    }
    g.phase = "build";
    g.buildLeft = BUILD_TIME;
  }
}

/** The score: waves survived and rice kept */
export const scoreOf = (g: VillageGame) => g.cleared * 100 + g.rice * 25 + (g.phase === "won" ? 500 : 0);

/** What a browser draws (and what the server sends 20 times a second in co-op) */
export function villageView(g: VillageGame) {
  const events = g.events;
  g.events = [];
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    map: g.map,
    endless: g.endless,
    players: g.players,
    coins: g.coins,
    rice: g.rice,
    wave: g.wave,
    cleared: g.cleared,
    phase: g.phase,
    buildLeft: Math.max(0, Math.round(g.buildLeft)),
    time: Math.round(g.time),
    towers: g.towers.map(({ id, kind, tx, ty, level, branch, owner, spent }) => ({ id, kind, tx, ty, level, branch, owner, spent })),
    spirits: g.spirits.map((s) => ({ id: s.id, kind: s.kind, x: r2(s.x), y: r2(s.y), hp: Math.max(0, Math.round(s.hp)), maxHp: s.maxHp, stunned: s.stunUntil > g.time })),
    remaining: g.queue.length + g.spirits.length,
    score: scoreOf(g),
    events,
  };
}
export type VillageView = ReturnType<typeof villageView>;

/** A saved solo game: only between waves, so it's small (defenders, coins, rice, wave) */
export function saveOf(g: VillageGame) {
  if (g.phase !== "build") return null;
  return { v: 1, map: g.map, endless: g.endless, coins: g.coins, rice: g.rice, cleared: g.cleared, towers: g.towers.map(({ kind, tx, ty, level, branch, spent }) => ({ kind, tx, ty, level, branch, spent })) };
}
export type VillageSave = NonNullable<ReturnType<typeof saveOf>>;
export function loadSave(save: VillageSave, player: Player): VillageGame {
  const g = newVillage(save.map, [player], save.endless);
  g.coins = { [player.id]: save.coins[Object.keys(save.coins)[0]] ?? 0 };
  g.rice = save.rice;
  g.cleared = save.cleared;
  g.wave = save.cleared;
  g.buildLeft = BUILD_TIME;
  g.towers = save.towers.map((t) => ({ ...t, id: g.nextId++, owner: player.id, cooldown: 0, trickle: 0 }));
  return g;
}
