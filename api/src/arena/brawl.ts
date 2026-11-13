// Stage 25 · Chợ Đêm Brawl (Night Market Brawl): the rules. This file exists TWICE, byte for byte:
//   api/src/arena/brawl.ts                 (the game server runs every game: it's the referee)
//   web/features/arena/brawl/brawl.ts      (your browser moves your own hero at once with moveCircle(), and reads the numbers)
// api/tests/brawl.test.ts fails if the two copies differ. No imports here.
//
// Trouble-makers have taken over the night market. 1–4 heroes clear it area by area: silly, not bloody. Enemies get
// bonked, spin and run off. A run is 5 areas of waves; areas 3 and 5 end with a boss. Between areas: a street-food shop.
// The time is passed in and randomness comes from a seeded generator, so tests can play whole runs with a fake clock.

export const W = 20; // the market, in tiles
export const H = 12;

// --- small maths ---------------------------------------------------------------------------------

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : [0, 0];
}

// --- the market: stalls you can't walk through ---------------------------------------------------

export type Rect = { x: number; y: number; w: number; h: number };
/** Five areas, each a different stretch of the market (stalls as rectangles, in tiles) */
export const AREAS: { name: string; stalls: Rect[] }[] = [
  { name: "Noodle Lane", stalls: [{ x: 4, y: 2, w: 3, h: 2 }, { x: 13, y: 2, w: 3, h: 2 }, { x: 4, y: 8, w: 3, h: 2 }, { x: 13, y: 8, w: 3, h: 2 }] },
  { name: "Fruit Corner", stalls: [{ x: 8, y: 1, w: 4, h: 2 }, { x: 2, y: 5, w: 2, h: 3 }, { x: 16, y: 5, w: 2, h: 3 }, { x: 8, y: 9, w: 4, h: 2 }] },
  { name: "Lantern Square", stalls: [{ x: 9, y: 5, w: 2, h: 2 }, { x: 3, y: 2, w: 2, h: 2 }, { x: 15, y: 2, w: 2, h: 2 }, { x: 3, y: 8, w: 2, h: 2 }, { x: 15, y: 8, w: 2, h: 2 }] },
  { name: "Toy Street", stalls: [{ x: 5, y: 3, w: 2, h: 6 }, { x: 13, y: 3, w: 2, h: 6 }] },
  { name: "Karaoke Stage", stalls: [{ x: 2, y: 2, w: 3, h: 1 }, { x: 15, y: 2, w: 3, h: 1 }, { x: 2, y: 9, w: 3, h: 1 }, { x: 15, y: 9, w: 3, h: 1 }] },
];

/** Move a circle (radius r) by (dx, dy), sliding along stalls and the edges. Used by the server AND by your browser. */
export function moveCircle(area: number, x: number, y: number, dx: number, dy: number, r: number): [number, number] {
  const stalls = AREAS[area].stalls;
  const blocked = (px: number, py: number) => stalls.some((s) => px + r > s.x && px - r < s.x + s.w && py + r > s.y && py - r < s.y + s.h);
  let nx = clamp(x + dx, r, W - r);
  if (blocked(nx, y)) nx = x;
  let ny = clamp(y + dy, r, H - r);
  if (blocked(nx, ny)) ny = y;
  return [nx, ny];
}

// --- finding the way round the stalls ---------------------------------------------------------------
// A grid of half-tiles. From the heroes outwards, each cell knows how many steps it is to the nearest hero
// ("a flow field"): enemies (and test bots) walk to the neighbouring cell that's one step closer.

const CELL = 0.5;
const GW = W / CELL;
const GH = H / CELL;
function cellFree(area: number, cx: number, cy: number) {
  const x = (cx + 0.5) * CELL;
  const y = (cy + 0.5) * CELL;
  const r = 0.3;
  return !AREAS[area].stalls.some((s) => x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h);
}
/** Steps from every cell to the nearest of `targets` (Infinity where blocked) */
export function flowField(area: number, targets: { x: number; y: number }[]): Float32Array {
  const d = new Float32Array(GW * GH).fill(Infinity);
  const queue: number[] = [];
  for (const t of targets) {
    const i = Math.floor(t.y / CELL) * GW + Math.floor(t.x / CELL);
    if (i >= 0 && i < d.length && d[i] !== 0) {
      d[i] = 0;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const cx = i % GW;
    const cy = (i - cx) / GW;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const j = ny * GW + nx;
      if (d[j] !== Infinity || !cellFree(area, nx, ny)) continue;
      d[j] = d[i] + 1;
      queue.push(j);
    }
  }
  return d;
}
/** Which way to walk from (x, y) to get closer, following the field (a unit vector, or [0, 0]) */
export function flowDir(field: Float32Array, x: number, y: number): [number, number] {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  let best = field[cy * GW + cx] ?? Infinity;
  let bx = 0;
  let by = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    const v = field[ny * GW + nx];
    // diagonal steps only when both sides are open (no cutting stall corners)
    if (dx && dy && (field[cy * GW + nx] === Infinity || field[ny * GW + cx] === Infinity)) continue;
    if (v < best) [best, bx, by] = [v, dx, dy];
  }
  if (!bx && !by) return [0, 0];
  // aim at the middle of that cell
  return norm((cx + bx + 0.5) * CELL - x, (cy + by + 0.5) * CELL - y);
}
/** Is the straight line from a to b clear of stalls? */
export function clearLine(area: number, ax: number, ay: number, bx: number, by: number) {
  const steps = Math.ceil(dist(ax, ay, bx, by) / 0.25);
  for (let i = 1; i < steps; i++) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    if (AREAS[area].stalls.some((s) => x + 0.3 > s.x && x - 0.3 < s.x + s.w && y + 0.3 > s.y && y - 0.3 < s.y + s.h)) return false;
  }
  return true;
}

// --- heroes --------------------------------------------------------------------------------------

export type HeroKind = "chef" | "shipper" | "grandma" | "student";
export const HERO_KINDS: HeroKind[] = ["chef", "shipper", "grandma", "student"];
export const HEROES: Record<HeroKind, { hp: number; speed: number; cooldown: number; damage: number }> = {
  chef: { hp: 160, speed: 3.5, cooldown: 450, damage: 13 }, // ladle: wide swings in front
  shipper: { hp: 135, speed: 4.6, cooldown: 260, damage: 13 }, // quick jabs; special: scooter dash through everyone
  grandma: { hp: 125, speed: 3.3, cooldown: 700, damage: 10 }, // slipper boomerang; special: tea that heals friends
  student: { hp: 115, speed: 3.8, cooldown: 480, damage: 17 }, // slingshot, long range; special: paper-plane storm
};
export const DODGE = { ms: 320, distance: 3, cooldown: 1100 };
export const SPECIAL_FULL = 100;

// --- enemies -------------------------------------------------------------------------------------

export type EnemyKind = "rat" | "ninja" | "balloon" | "umbrellaBoss" | "karaokeKing";
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; radius: number; damage: number; coins: number; boss: boolean }> = {
  rat: { hp: 40, speed: 2.9, radius: 0.32, damage: 5, coins: 2, boss: false }, // pickpocket rats: run in, nibble
  ninja: { hp: 80, speed: 2.3, radius: 0.36, damage: 11, coins: 4, boss: false }, // umbrella ninjas: sudden dashes
  balloon: { hp: 60, speed: 1.7, radius: 0.38, damage: 0, coins: 4, boss: false }, // balloon sellers: keep away, throw confetti balloons
  umbrellaBoss: { hp: 1500, speed: 2.0, radius: 0.75, damage: 14, coins: 40, boss: true }, // area 3: the Umbrella Master spins
  karaokeKing: { hp: 2600, speed: 1.4, radius: 0.85, damage: 12, coins: 80, boss: true }, // area 5: sound waves, calls rats
};

/** Who comes in each wave of an area (area 0..4, wave 0..2) */
export const WAVES_PER_AREA = 4;
export function waveOf(area: number, wave: number): { kind: EnemyKind; count: number }[] {
  const last = wave === WAVES_PER_AREA - 1;
  if (last && area === 2) return [{ kind: "umbrellaBoss", count: 1 }, { kind: "rat", count: 4 }];
  if (last && area === 4) return [{ kind: "karaokeKing", count: 1 }, { kind: "balloon", count: 2 }];
  const n = area * 2 + wave;
  const out: { kind: EnemyKind; count: number }[] = [{ kind: "rat", count: 4 + n }];
  if (area >= 1 || wave >= 1) out.push({ kind: "ninja", count: 1 + Math.floor(n / 2) });
  if (area >= 1 || wave >= 2) out.push({ kind: "balloon", count: 1 + Math.floor(n / 3) });
  return out;
}

// --- the shop between areas ----------------------------------------------------------------------

export type Buff = "banhmi" | "che" | "caphe" | "banhxeo";
export const SHOP: Record<Buff, { cost: number }> = {
  banhmi: { cost: 25 }, // bánh mì: +25 max health and a full heal
  che: { cost: 25 }, // chè: the special charges 40% faster
  caphe: { cost: 30 }, // cà phê sữa đá: 12% faster feet
  banhxeo: { cost: 35 }, // bánh xèo: 20% harder bonks
};

// --- the game ------------------------------------------------------------------------------------

export type Seat = { id: string; name: string; hero: HeroKind };
export type Hero = Seat & {
  x: number;
  y: number;
  fx: number; // facing (unit vector)
  fy: number;
  mx: number; // what the player is pressing (stick, -1..1)
  my: number;
  hp: number;
  maxHp: number;
  down: boolean; // knocked down: a friend can help you up
  helpMs: number;
  special: number;
  attackReady: number;
  dodgeReady: number;
  dodgeUntil: number;
  dashUntil: number; // the shipper's scooter
  speedMul: number;
  damageMul: number;
  chargeMul: number;
  coins: number;
  bonks: number;
  ready: boolean; // in the shop
  slowUntil: number;
};
export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  vx: number; // knock-back
  vy: number;
  stunUntil: number;
  next: number; // when its next trick happens
  dashUntil: number;
  dx: number;
  dy: number;
  spinUntil: number;
  hitReady: number;
};
export type Shot = { id: number; kind: "pebble" | "slipper" | "plane" | "wave" | "balloon"; owner: string | null; x: number; y: number; vx: number; vy: number; life: number; damage: number; back?: boolean; hit: number[]; r?: number; tx?: number; ty?: number };
export type Zone = { id: number; x: number; y: number; r: number; until: number; kind: "confetti" };
export type BrawlEvent =
  | { t: "swing"; id: string; x: number; y: number; fx: number; fy: number; hero: HeroKind }
  | { t: "bonk"; x: number; y: number; damage: number }
  | { t: "away"; x: number; y: number; kind: EnemyKind } // an enemy runs off, defeated
  | { t: "hurt"; id: string }
  | { t: "down"; id: string }
  | { t: "up"; id: string }
  | { t: "special"; id: string; hero: HeroKind; x: number; y: number }
  | { t: "heal"; id: string; amount: number }
  | { t: "dodge"; id: string }
  | { t: "pop"; x: number; y: number }
  | { t: "wave"; area: number; wave: number }
  | { t: "boss"; kind: EnemyKind };

export type BrawlGame = {
  heroes: Hero[];
  enemies: Enemy[];
  shots: Shot[];
  zones: Zone[];
  area: number;
  wave: number;
  phase: "fight" | "pause" | "shop" | "won" | "lost";
  phaseUntil: number; // "pause": the short breath between waves
  time: number;
  startedAt: number;
  nextId: number;
  random: () => number;
  events: BrawlEvent[];
  field: Float32Array | null; // the way to the heroes, refreshed a few times a second
  fieldAt: number;
};

const HERO_R = 0.36;
const STARTS: [number, number][] = [
  [1.5, 5],
  [1.5, 7],
  [2.5, 4],
  [2.5, 8],
];

export function newBrawl(seats: Seat[], seed: number, now: number): BrawlGame {
  const g: BrawlGame = {
    heroes: seats.slice(0, 4).map((s, i) => {
      const h = HEROES[s.hero];
      return {
        ...s,
        x: STARTS[i][0],
        y: STARTS[i][1],
        fx: 1,
        fy: 0,
        mx: 0,
        my: 0,
        hp: h.hp,
        maxHp: h.hp,
        down: false,
        helpMs: 0,
        special: 0,
        attackReady: 0,
        dodgeReady: 0,
        dodgeUntil: 0,
        dashUntil: 0,
        speedMul: 1,
        damageMul: 1,
        chargeMul: 1,
        coins: 0,
        bonks: 0,
        ready: false,
        slowUntil: 0,
      };
    }),
    enemies: [],
    shots: [],
    zones: [],
    area: 0,
    wave: 0,
    phase: "pause",
    phaseUntil: now + 2500,
    time: now,
    startedAt: now,
    nextId: 1,
    random: rng(seed),
    events: [],
    field: null,
    fieldAt: 0,
  };
  return g;
}

/** More heroes, tougher enemies (but not 4× tougher: friends also help each other) */
const toughness = (g: BrawlGame) => 0.25 + 0.55 * g.heroes.length; // ×0.8 alone, ×2.45 for four
/** …and more of them: a solo hero meets 60% of a wave, a team of four 120% */
const crowd = (g: BrawlGame, count: number) => Math.max(1, Math.round(count * (0.4 + 0.2 * g.heroes.length)));

function spawnWave(g: BrawlGame, now: number) {
  for (const group of waveOf(g.area, g.wave)) {
    const count = ENEMIES[group.kind].boss ? group.count : crowd(g, group.count);
    for (let i = 0; i < count; i++) {
      const info = ENEMIES[group.kind];
      // they come in from the right-hand side of the market (bosses from the middle right)
      let x = W - 3;
      let y = H / 2;
      // a free spot (never inside a stall) on the right-hand side; bosses from the middle if it's free
      for (let tries = 0; tries < 50; tries++) {
        if (!(info.boss && tries === 0)) {
          x = W - 0.6 - g.random() * 4;
          y = 0.8 + g.random() * (H - 1.6);
        }
        const r = info.radius;
        if (!AREAS[g.area].stalls.some((st) => x + r > st.x && x - r < st.x + st.w && y + r > st.y && y - r < st.y + st.h)) break;
      }
      const hp = Math.round(info.hp * toughness(g) * (1 + g.area * 0.45));
      g.enemies.push({ id: g.nextId++, kind: group.kind, x, y, hp, maxHp: hp, vx: 0, vy: 0, stunUntil: now + 600, next: now + 1500 + g.random() * 1500, dashUntil: 0, dx: 0, dy: 0, spinUntil: 0, hitReady: 0 });
      if (info.boss) g.events.push({ t: "boss", kind: group.kind });
    }
  }
  g.events.push({ t: "wave", area: g.area, wave: g.wave });
}

// --- what players do ------------------------------------------------------------------------------

export type BrawlAction = { a: "attack" } | { a: "dodge" } | { a: "special" } | { a: "buy"; buff: Buff } | { a: "ready" };

export function setStick(g: BrawlGame, id: string, mx: number, my: number) {
  const h = g.heroes.find((x) => x.id === id);
  if (!h || !Number.isFinite(mx) || !Number.isFinite(my)) return;
  const l = Math.hypot(mx, my);
  [h.mx, h.my] = l > 1 ? [mx / l, my / l] : [mx, my];
  if (l > 0.2) [h.fx, h.fy] = norm(mx, my);
}

function hitEnemy(g: BrawlGame, h: Hero | null, e: Enemy, damage: number, kx: number, ky: number, now: number, stun = 0) {
  const dmg = Math.round(damage * (h?.damageMul ?? 1));
  e.hp -= dmg;
  const push = ENEMIES[e.kind].boss ? 1.5 : 5;
  e.vx += kx * push;
  e.vy += ky * push;
  if (stun) e.stunUntil = Math.max(e.stunUntil, now + stun);
  g.events.push({ t: "bonk", x: e.x, y: e.y, damage: dmg });
  if (h) {
    h.special = Math.min(SPECIAL_FULL, h.special + dmg * 0.4 * h.chargeMul);
    if (e.hp <= 0) {
      h.bonks++;
      for (const x of g.heroes) x.coins += ENEMIES[e.kind].coins; // everyone shares the coins
    }
  }
}

export function act(g: BrawlGame, id: string, action: BrawlAction, now: number): string | null {
  const h = g.heroes.find((x) => x.id === id);
  if (!h) return "You're watching this game";
  if (action.a === "buy") {
    if (g.phase !== "shop") return "The shop is closed";
    const item = SHOP[action.buff];
    if (!item) return "Unknown snack";
    if (h.coins < item.cost) return "Not enough coins";
    h.coins -= item.cost;
    if (action.buff === "banhmi") {
      h.maxHp += 25;
      h.hp = h.maxHp;
    }
    if (action.buff === "che") h.chargeMul *= 1.4;
    if (action.buff === "caphe") h.speedMul *= 1.12;
    if (action.buff === "banhxeo") h.damageMul *= 1.2;
    return null;
  }
  if (action.a === "ready") {
    if (g.phase !== "shop") return "The shop is closed";
    h.ready = true;
    if (g.heroes.every((x) => x.ready)) nextArea(g, now);
    return null;
  }
  if (g.phase !== "fight" && g.phase !== "pause") return "Not now";
  if (h.down) return "You're down: wait for a friend";
  if (action.a === "dodge") {
    if (now < h.dodgeReady) return "Not yet";
    h.dodgeUntil = now + DODGE.ms;
    h.dodgeReady = now + DODGE.cooldown;
    g.events.push({ t: "dodge", id });
    return null;
  }
  if (action.a === "attack") {
    if (now < h.attackReady || now < h.dodgeUntil) return "Not yet";
    const info = HEROES[h.hero];
    h.attackReady = now + info.cooldown;
    g.events.push({ t: "swing", id, x: h.x, y: h.y, fx: h.fx, fy: h.fy, hero: h.hero });
    if (h.hero === "chef" || h.hero === "shipper") {
      // close-up: everyone in a cone in front (the chef's is wider and longer)
      const reach = h.hero === "chef" ? 1.5 : 1.15;
      const cone = h.hero === "chef" ? 0.35 : 0.55; // cos of half the angle
      for (const e of g.enemies) {
        const d = dist(h.x, h.y, e.x, e.y);
        if (d > reach + ENEMIES[e.kind].radius) continue;
        const [ux, uy] = norm(e.x - h.x, e.y - h.y);
        if (d > 0.4 && ux * h.fx + uy * h.fy < cone) continue;
        hitEnemy(g, h, e, info.damage, ux, uy, now);
      }
    } else if (h.hero === "grandma") {
      g.shots.push({ id: g.nextId++, kind: "slipper", owner: id, x: h.x, y: h.y, vx: h.fx * 9, vy: h.fy * 9, life: 1100, damage: info.damage, back: false, hit: [] });
    } else {
      g.shots.push({ id: g.nextId++, kind: "pebble", owner: id, x: h.x, y: h.y, vx: h.fx * 13, vy: h.fy * 13, life: 650, damage: info.damage, hit: [] });
    }
    return null;
  }
  if (action.a === "special") {
    if (h.special < SPECIAL_FULL) return "Your special isn't ready";
    h.special = 0;
    g.events.push({ t: "special", id, hero: h.hero, x: h.x, y: h.y });
    if (h.hero === "chef") {
      // Boiling Pot: a big splash around the chef, everyone dizzy for a second
      for (const e of g.enemies) {
        if (dist(h.x, h.y, e.x, e.y) > 2.6) continue;
        const [ux, uy] = norm(e.x - h.x, e.y - h.y);
        hitEnemy(g, h, e, 45, ux, uy, now, 1000);
      }
    } else if (h.hero === "shipper") {
      // Scooter Dash: zoom forward, bonking everyone on the way
      h.dashUntil = now + 420;
      h.dodgeUntil = now + 420;
    } else if (h.hero === "grandma") {
      // Tea Time: heals her and every friend nearby (and helps the knocked-down back up)
      for (const f of g.heroes) {
        if (dist(h.x, h.y, f.x, f.y) > 4.5) continue;
        const amount = Math.min(f.maxHp - f.hp, 45);
        if (f.down) {
          f.down = false;
          f.hp = Math.round(f.maxHp * 0.4);
          g.events.push({ t: "up", id: f.id });
        } else f.hp += amount;
        g.events.push({ t: "heal", id: f.id, amount });
      }
    } else {
      // Homework Storm: paper planes fly out in every direction
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.shots.push({ id: g.nextId++, kind: "plane", owner: id, x: h.x, y: h.y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, life: 700, damage: 20, hit: [] });
      }
    }
    return null;
  }
  return "Unknown action";
}

function nextArea(g: BrawlGame, now: number) {
  g.area++;
  g.wave = 0;
  g.phase = "pause";
  g.phaseUntil = now + 2500;
  g.shots = [];
  g.zones = [];
  g.heroes.forEach((h, i) => {
    h.ready = false;
    [h.x, h.y] = STARTS[i];
    if (h.down) {
      h.down = false;
      h.hp = Math.round(h.maxHp * 0.5);
    }
  });
}

// --- every step ---------------------------------------------------------------------------------

function heroesStep(g: BrawlGame, now: number, dt: number) {
  for (const h of g.heroes) {
    if (h.down) continue;
    if (!Number.isFinite(h.fx) || !Number.isFinite(h.fy) || (h.fx === 0 && h.fy === 0)) [h.fx, h.fy] = [1, 0]; // never face "nowhere"
    const s = dt / 1000;
    if (now < h.dashUntil) {
      // the scooter: fast, straight, through everyone
      [h.x, h.y] = moveCircle(g.area, h.x, h.y, h.fx * 12 * s, h.fy * 12 * s, HERO_R);
      for (const e of g.enemies) if (dist(h.x, h.y, e.x, e.y) < 0.9 + ENEMIES[e.kind].radius && now - e.hitReady > 0) {
        hitEnemy(g, h, e, 32, h.fy, -h.fx, now, 500);
        e.hitReady = now + 500;
      }
      continue;
    }
    if (now < h.dodgeUntil) {
      const v = (DODGE.distance / DODGE.ms) * dt;
      [h.x, h.y] = moveCircle(g.area, h.x, h.y, h.fx * v, h.fy * v, HERO_R);
      continue;
    }
    const slow = now < h.slowUntil ? 0.5 : 1;
    const v = HEROES[h.hero].speed * h.speedMul * slow * s;
    [h.x, h.y] = moveCircle(g.area, h.x, h.y, h.mx * v, h.my * v, HERO_R);
  }
  // Help a friend up: stand next to them for 2 seconds
  for (const d of g.heroes.filter((x) => x.down)) {
    const helper = g.heroes.some((f) => !f.down && f !== d && dist(f.x, f.y, d.x, d.y) < 1.2);
    d.helpMs = helper ? d.helpMs + dt : 0;
    if (d.helpMs >= 2000) {
      d.down = false;
      d.helpMs = 0;
      d.hp = Math.round(d.maxHp * 0.4);
      g.events.push({ t: "up", id: d.id });
    }
  }
}

function hurtHero(g: BrawlGame, h: Hero, damage: number, now: number) {
  if (h.down || now < h.dodgeUntil) return;
  h.hp -= damage;
  g.events.push({ t: "hurt", id: h.id });
  if (h.hp <= 0) {
    h.hp = 0;
    h.down = true;
    h.helpMs = 0;
    g.events.push({ t: "down", id: h.id });
  }
}

function nearestHero(g: BrawlGame, x: number, y: number) {
  let best: Hero | null = null;
  let bd = Infinity;
  for (const h of g.heroes) {
    if (h.down) continue;
    const d = dist(x, y, h.x, h.y);
    if (d < bd) [best, bd] = [h, d];
  }
  return best ? { h: best, d: bd } : null;
}

function enemiesStep(g: BrawlGame, now: number, dt: number) {
  const s = dt / 1000;
  if (!g.field || now >= g.fieldAt) {
    g.field = flowField(g.area, g.heroes.filter((h) => !h.down));
    g.fieldAt = now + 250;
  }
  for (const e of g.enemies) {
    const info = ENEMIES[e.kind];
    // knock-back slides and fades
    if (Math.abs(e.vx) + Math.abs(e.vy) > 0.01) {
      [e.x, e.y] = moveCircle(g.area, e.x, e.y, e.vx * s, e.vy * s, info.radius);
      e.vx *= Math.pow(0.002, s);
      e.vy *= Math.pow(0.002, s);
    }
    if (now < e.stunUntil) continue;
    const target = nearestHero(g, e.x, e.y);
    if (!target) continue;
    const [ux, uy] = norm(target.h.x - e.x, target.h.y - e.y);
    let speed = info.speed;
    // straight at the hero if nothing's in the way, otherwise round the stalls
    let [mx, my] = clearLine(g.area, e.x, e.y, target.h.x, target.h.y) ? [ux, uy] : flowDir(g.field!, e.x, e.y);

    if (e.kind === "ninja") {
      if (now < e.dashUntil) [mx, my, speed] = [e.dx, e.dy, 9];
      else if (now >= e.next && target.d < 5) {
        e.dashUntil = now + 300;
        [e.dx, e.dy] = [ux, uy];
        e.next = now + 2600 + g.random() * 1200;
      }
    } else if (e.kind === "balloon") {
      // keeps its distance, throws a balloon that lands where you were
      if (target.d < 3.5) [mx, my] = [-ux, -uy];
      else if (target.d < 5.5) speed = 0;
      if (now >= e.next) {
        e.next = now + 2600 + g.random() * 1000;
        const tx = target.h.x;
        const ty = target.h.y;
        g.shots.push({ id: g.nextId++, kind: "balloon", owner: null, x: e.x, y: e.y, vx: (tx - e.x) / 1, vy: (ty - e.y) / 1, life: 1000, damage: 0, hit: [], tx, ty });
      }
    } else if (e.kind === "umbrellaBoss") {
      if (now < e.spinUntil) {
        speed = 2.6;
        for (const h of g.heroes) if (dist(e.x, e.y, h.x, h.y) < 2 && now >= e.hitReady) hurtHero(g, h, info.damage, now);
        if (now >= e.hitReady) e.hitReady = now + 450;
      } else if (now >= e.next) {
        e.spinUntil = now + 2200;
        e.next = now + 5500;
      }
    } else if (e.kind === "karaokeKing") {
      speed = target.d < 3 ? 0 : speed;
      if (now >= e.next) {
        e.next = now + 2800;
        // a sound wave: a ring that grows; dodge-roll through it or step out of its way
        g.shots.push({ id: g.nextId++, kind: "wave", owner: null, x: e.x, y: e.y, vx: 0, vy: 0, life: 1600, damage: 12, hit: [], r: 0.5 });
        if (g.random() < 0.4 && g.enemies.length < 14) {
          const hp = Math.round(ENEMIES.rat.hp * toughness(g));
          g.enemies.push({ id: g.nextId++, kind: "rat", x: e.x - 1, y: e.y, hp, maxHp: hp, vx: 0, vy: 0, stunUntil: now + 400, next: now, dashUntil: 0, dx: 0, dy: 0, spinUntil: 0, hitReady: 0 });
        }
      }
    }
    // a little sideways wobble so they don't all stack in one line
    const wob = Math.sin(now / 400 + e.id) * 0.35;
    [e.x, e.y] = moveCircle(g.area, e.x, e.y, (mx - my * wob) * speed * s, (my + mx * wob) * speed * s, info.radius);
    // touching a hero: a nibble, a poke, a bump
    if (info.damage && target.d < info.radius + HERO_R + 0.15 && now >= e.hitReady) {
      hurtHero(g, target.h, info.damage, now);
      e.hitReady = now + 1200;
      // after a nibble it hops back (so a crowd doesn't pile on)
      if (!info.boss) {
        e.vx -= ux * 3;
        e.vy -= uy * 3;
      }
    }
  }
  // enemies push each other apart a little
  for (let i = 0; i < g.enemies.length; i++)
    for (let j = i + 1; j < g.enemies.length; j++) {
      const a = g.enemies[i];
      const b = g.enemies[j];
      const min = ENEMIES[a.kind].radius + ENEMIES[b.kind].radius;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d > 0 && d < min) {
        const [ux, uy] = norm(b.x - a.x, b.y - a.y);
        const p = (min - d) / 2;
        [a.x, a.y] = moveCircle(g.area, a.x, a.y, -ux * p, -uy * p, ENEMIES[a.kind].radius);
        [b.x, b.y] = moveCircle(g.area, b.x, b.y, ux * p, uy * p, ENEMIES[b.kind].radius);
      }
    }
}

function shotsStep(g: BrawlGame, now: number, dt: number) {
  const s = dt / 1000;
  for (const sh of g.shots) {
    sh.life -= dt;
    if (sh.kind === "wave") {
      sh.r = (sh.r ?? 0.5) + 4.2 * s;
      for (const h of g.heroes) {
        const d = dist(sh.x, sh.y, h.x, h.y);
        const key = g.heroes.indexOf(h);
        if (Math.abs(d - sh.r) < 0.35 && !sh.hit.includes(key)) {
          sh.hit.push(key);
          hurtHero(g, h, sh.damage, now);
        }
      }
      continue;
    }
    if (sh.kind === "balloon") {
      sh.x += sh.vx * s;
      sh.y += sh.vy * s;
      if (sh.life <= 0) {
        g.zones.push({ id: g.nextId++, x: sh.tx!, y: sh.ty!, r: 1.3, until: now + 3500, kind: "confetti" });
        g.events.push({ t: "pop", x: sh.tx!, y: sh.ty! });
      }
      continue;
    }
    // the slipper comes back to grandma halfway through its flight
    if (sh.kind === "slipper" && !sh.back && sh.life < 550) {
      sh.back = true;
      sh.hit = [];
    }
    if (sh.kind === "slipper" && sh.back) {
      const owner = g.heroes.find((h) => h.id === sh.owner);
      if (owner) {
        const [ux, uy] = norm(owner.x - sh.x, owner.y - sh.y);
        [sh.vx, sh.vy] = [ux * 10, uy * 10];
        if (dist(owner.x, owner.y, sh.x, sh.y) < 0.5) sh.life = 0;
      }
    }
    sh.x += sh.vx * s;
    sh.y += sh.vy * s;
    const stall = AREAS[g.area].stalls.some((r) => sh.x > r.x && sh.x < r.x + r.w && sh.y > r.y && sh.y < r.y + r.h);
    if ((stall && sh.kind !== "slipper") || sh.x < 0 || sh.y < 0 || sh.x > W || sh.y > H) sh.life = 0;
    const owner = g.heroes.find((h) => h.id === sh.owner) ?? null;
    for (const e of g.enemies) {
      if (sh.life <= 0 || sh.hit.includes(e.id)) continue;
      if (dist(sh.x, sh.y, e.x, e.y) > ENEMIES[e.kind].radius + 0.2) continue;
      sh.hit.push(e.id);
      const [ux, uy] = norm(sh.vx, sh.vy);
      hitEnemy(g, owner, e, sh.damage, ux, uy, now);
      if (sh.kind === "pebble" || sh.kind === "plane") sh.life = 0; // the slipper goes through
    }
  }
  g.shots = g.shots.filter((x) => x.life > 0);
  // confetti traps: slow and sting heroes standing in them
  g.zones = g.zones.filter((z) => z.until > now);
  for (const z of g.zones)
    for (const h of g.heroes)
      if (!h.down && dist(z.x, z.y, h.x, h.y) < z.r) {
        h.slowUntil = now + 200;
        if (Math.floor(now / 500) !== Math.floor((now - dt) / 500)) hurtHero(g, h, 1, now);
      }
}

/** Advance the game to `now`. The server calls this 20 times a second. */
export function stepBrawl(g: BrawlGame, now: number, dt: number) {
  g.time = now;
  if (g.phase === "won" || g.phase === "lost" || g.phase === "shop") return;
  heroesStep(g, now, dt);
  if (g.phase === "pause") {
    if (now >= g.phaseUntil) {
      g.phase = "fight";
      spawnWave(g, now);
    }
    return;
  }
  enemiesStep(g, now, dt);
  shotsStep(g, now, dt);
  // defeated enemies spin and run off (they're never hurt, only bonked)
  for (const e of g.enemies.filter((x) => x.hp <= 0)) g.events.push({ t: "away", x: e.x, y: e.y, kind: e.kind });
  g.enemies = g.enemies.filter((e) => e.hp > 0);
  if (g.heroes.every((h) => h.down)) {
    g.phase = "lost";
    return;
  }
  if (g.enemies.length === 0) {
    g.wave++;
    g.shots = g.shots.filter((x) => x.owner !== null);
    if (g.wave < WAVES_PER_AREA) {
      g.phase = "pause";
      g.phaseUntil = now + 3000;
      // a breather: everyone standing gets a little health back
      for (const h of g.heroes) if (!h.down) h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.15));
    } else if (g.area >= AREAS.length - 1) {
      g.phase = "won";
    } else {
      g.phase = "shop";
      // everyone knocked down gets back up for the shop
      for (const h of g.heroes) {
        h.ready = false;
        if (h.down) {
          h.down = false;
          h.hp = Math.round(h.maxHp * 0.5);
          g.events.push({ t: "up", id: h.id });
        }
      }
    }
  }
}

/** The result: areas cleared, and how fast */
export function resultOf(g: BrawlGame) {
  const areas = g.phase === "won" ? AREAS.length : g.area;
  return { areas, won: g.phase === "won", timeMs: Math.round(g.time - g.startedAt), bonks: g.heroes.reduce((n, h) => n + h.bonks, 0) };
}

/** What every browser gets 20 times a second */
export function brawlView(g: BrawlGame) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const events = g.events;
  g.events = [];
  return {
    t: g.time,
    area: g.area,
    wave: g.wave,
    phase: g.phase,
    phaseUntil: g.phaseUntil,
    startedAt: g.startedAt,
    heroes: g.heroes.map((h) => ({
      id: h.id,
      name: h.name,
      hero: h.hero,
      x: r2(h.x),
      y: r2(h.y),
      fx: r2(h.fx),
      fy: r2(h.fy),
      hp: Math.max(0, Math.round(h.hp)),
      maxHp: h.maxHp,
      down: h.down,
      help: h.down ? Math.round(h.helpMs) : 0,
      special: Math.round(h.special),
      dodging: g.time < h.dodgeUntil,
      dashing: g.time < h.dashUntil,
      coins: h.coins,
      bonks: h.bonks,
      ready: h.ready,
      speedMul: h.speedMul,
      buffs: { hp: h.maxHp - HEROES[h.hero].hp, charge: r2(h.chargeMul), speed: r2(h.speedMul), damage: r2(h.damageMul) },
    })),
    enemies: g.enemies.map((e) => ({ id: e.id, kind: e.kind, x: r2(e.x), y: r2(e.y), hp: Math.max(0, Math.round(e.hp)), maxHp: e.maxHp, stunned: g.time < e.stunUntil, spinning: g.time < e.spinUntil, dashing: g.time < e.dashUntil })),
    shots: g.shots.map((s) => ({ id: s.id, kind: s.kind, x: r2(s.x), y: r2(s.y), r: s.r ? r2(s.r) : undefined, tx: s.tx, ty: s.ty })),
    zones: g.zones.map((z) => ({ id: z.id, x: z.x, y: z.y, r: z.r })),
    result: g.phase === "won" || g.phase === "lost" ? resultOf(g) : null,
    events,
  };
}
export type BrawlView = ReturnType<typeof brawlView>;
