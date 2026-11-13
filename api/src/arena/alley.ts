// Stage 23 · Ngõ Pháo (Firecracker Alley): the rules of one match, as plain data + functions.
// No network code (server.ts does that), a seeded random generator and the time passed in as `now`,
// so tests can play whole rounds with a fake clock, like Quiz Party and chess.
//
// A match: 2–4 lantern-heads (bots fill empty seats) in a 13 × 11 alley. Drop firecrackers; they pop after
// 2.5 s in a cross of sparks that breaks bamboo crates and knocks people out. First to win 3 rounds wins.
// Knocked-out players become little ghosts who can drop a tiny cracker every 10 s (it only stuns).
// A lion dance passes once a round and pushes people aside. After 90 s, lanterns fill the alley from the edges.

import { DX, DY, H, solid, speedOf, tileAt, W, walkFor, type Dir, type MoveWorld } from "./alley-move.js";

export type Power = "bomb" | "fire" | "speed" | "kick" | "shield";
export const POWERS: Power[] = ["bomb", "fire", "speed", "kick", "shield"];
export type MapId = "old-town" | "market" | "rooftops";

// "#" fixed walls, "." floor. Crates are scattered on the floor at the start of each round.
export const MAPS: Record<MapId, string[]> = {
  "old-town": [
    ".............",
    ".#.#.#.#.#.#.",
    ".............",
    ".#.#.#.#.#.#.",
    ".............",
    ".#.#.#.#.#.#.",
    ".............",
    ".#.#.#.#.#.#.",
    ".............",
    ".#.#.#.#.#.#.",
    ".............",
  ],
  market: [
    ".............",
    ".##.#.#.#.##.",
    ".............",
    ".#..##.##..#.",
    ".............",
    ".#.#.#.#.#.#.",
    ".............",
    ".#..##.##..#.",
    ".............",
    ".##.#.#.#.##.",
    ".............",
  ],
  rooftops: [
    ".............",
    ".#.##...##.#.",
    ".#.........#.",
    "...#.#.#.#...",
    ".#.........#.",
    ".#.#.###.#.#.",
    ".#.........#.",
    "...#.#.#.#...",
    ".#.........#.",
    ".#.##...##.#.",
    ".............",
  ],
};
export const MAP_IDS = Object.keys(MAPS) as MapId[];

export const T = {
  countdown: 3000,
  fuse: 2500,
  tinyFuse: 1500,
  spark: 450,
  roundEnd: 4000,
  suddenDeath: 90_000, // after this much playing time, lanterns start filling the alley
  ringEvery: 3500,
  ringWarning: 2000,
  roundMax: 150_000,
  ghostCooldown: 10_000,
  stun: 1200,
  shieldGrace: 1200,
  kickSpeed: 7, // tiles per second
  lionSpeed: 3.5,
} as const;
export const WINS_NEEDED = 3;
const SPAWNS = [
  [0, 0],
  [W - 1, H - 1],
  [W - 1, 0],
  [0, H - 1],
] as const;

export type Seat = { id: string; name: string; color: number; hat: number; bot: boolean };
export type Stats = { crates: number; outs: number; selfOuts: number; powers: number; teases: number; wins: number };
export type AlleyPlayer = Seat & {
  x: number;
  y: number;
  dir: Dir;
  alive: boolean;
  ghost: boolean;
  shield: boolean;
  invulnUntil: number;
  stunUntil: number;
  bombs: number; // how many firecrackers at once
  fire: number; // spark length
  boots: number;
  kick: boolean;
  tinyReadyAt: number;
  score: number;
  stats: Stats;
  outAt: number;
};
export type Bomb = { id: number; tx: number; ty: number; owner: string; range: number; explodeAt: number; tiny: boolean; slide: Dir; progress: number; passers: Set<string> };
export type Spark = { tx: number; ty: number; until: number; tiny: boolean; owner: string };
export type AlleyEvent =
  | { t: "pop"; tx: number; ty: number; tiny: boolean }
  | { t: "crate"; tx: number; ty: number }
  | { t: "out"; id: string; by: string | null }
  | { t: "power"; id: string; power: Power; tx: number; ty: number }
  | { t: "shield"; id: string }
  | { t: "stun"; id: string }
  | { t: "kick"; id: string }
  | { t: "lion" }
  | { t: "ring"; k: number };

export type AlleyGame = {
  map: MapId;
  tiles: string[];
  items: Map<number, Power>;
  players: AlleyPlayer[];
  bombs: Bomb[];
  sparks: Spark[];
  phase: "countdown" | "playing" | "roundEnd" | "matchEnd";
  phaseEndsAt: number; // countdown / roundEnd
  playStartedAt: number;
  round: number;
  roundWinner: string | null; // null + roundEnd = a draw
  matchWinner: string | null;
  lion: { row: number; x: number; dir: 1 | -1 } | null;
  lionAt: number;
  rings: number; // how many lantern rings are down
  nextBombId: number;
  random: () => number;
  events: AlleyEvent[]; // what happened since the last view (sounds, little explosions on screen)
  botThinkAt: number;
};

/** A small seeded random number generator (mulberry32) */
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

const idx = (tx: number, ty: number) => ty * W + tx;
const tileOf = (p: { x: number; y: number }) => [Math.floor(p.x), Math.floor(p.y)] as const;
const freshStats = (): Stats => ({ crates: 0, outs: 0, selfOuts: 0, powers: 0, teases: 0, wins: 0 });

export function newAlleyMatch(seats: Seat[], map: MapId, seed: number, now: number): AlleyGame {
  const g: AlleyGame = {
    map,
    tiles: [],
    items: new Map(),
    players: seats.slice(0, 4).map((s) => ({
      ...s,
      x: 0,
      y: 0,
      dir: 0,
      alive: true,
      ghost: false,
      shield: false,
      invulnUntil: 0,
      stunUntil: 0,
      bombs: 1,
      fire: 2,
      boots: 0,
      kick: false,
      tinyReadyAt: 0,
      score: 0,
      stats: freshStats(),
      outAt: 0,
    })),
    bombs: [],
    sparks: [],
    phase: "countdown",
    phaseEndsAt: 0,
    playStartedAt: 0,
    round: 0,
    roundWinner: null,
    matchWinner: null,
    lion: null,
    lionAt: 0,
    rings: 0,
    nextBombId: 1,
    random: rng(seed),
    events: [],
    botThinkAt: 0,
  };
  startRound(g, now);
  return g;
}

/** Corners and the two tiles next to each: kept free of crates so nobody starts trapped */
function isSafeStart(tx: number, ty: number) {
  return SPAWNS.some(([sx, sy]) => Math.abs(sx - tx) + Math.abs(sy - ty) <= 1);
}

export function startRound(g: AlleyGame, now: number) {
  g.round++;
  g.tiles = MAPS[g.map].join("").split("");
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) if (g.tiles[idx(tx, ty)] === "." && !isSafeStart(tx, ty) && g.random() < 0.72) g.tiles[idx(tx, ty)] = "c";
  g.items.clear();
  g.bombs = [];
  g.sparks = [];
  g.players.forEach((p, i) => {
    const [sx, sy] = SPAWNS[i];
    Object.assign(p, { x: sx + 0.5, y: sy + 0.5, dir: 0, alive: true, ghost: false, shield: false, invulnUntil: 0, stunUntil: 0 });
    Object.assign(p, { bombs: 1, fire: 2, boots: 0, kick: false, tinyReadyAt: 0, outAt: 0 });
  });
  g.phase = "countdown";
  g.phaseEndsAt = now + T.countdown;
  g.playStartedAt = now + T.countdown;
  g.roundWinner = null;
  g.lion = null;
  g.lionAt = g.playStartedAt + 35_000 + Math.floor(g.random() * 25_000);
  g.rings = 0;
}

// --- moving ------------------------------------------------------------------------------------

function worldFor(g: AlleyGame, p: AlleyPlayer): MoveWorld {
  return {
    tiles: g.tiles.join(""),
    ghost: p.ghost,
    bombBlocks: (tx, ty) => g.bombs.some((b) => b.tx === tx && b.ty === ty && !b.passers.has(p.id)),
  };
}

export function setDir(g: AlleyGame, id: string, dir: Dir) {
  const p = g.players.find((x) => x.id === id);
  if (p) p.dir = dir;
}

/** Drop a firecracker (or, as a ghost, a tiny cracker). Returns false if not allowed right now. */
export function drop(g: AlleyGame, id: string, now: number): boolean {
  const p = g.players.find((x) => x.id === id);
  if (!p || g.phase !== "playing") return false;
  const [tx, ty] = tileOf(p);
  if (tileAt(g.tiles.join(""), tx, ty) !== "." || g.bombs.some((b) => b.tx === tx && b.ty === ty)) return false;
  let tiny = false;
  if (p.ghost) {
    if (now < p.tinyReadyAt) return false;
    p.tinyReadyAt = now + T.ghostCooldown;
    tiny = true;
  } else {
    if (!p.alive || now < p.stunUntil) return false;
    if (g.bombs.filter((b) => b.owner === id && !b.tiny).length >= p.bombs) return false;
  }
  const passers = new Set(g.players.filter((q) => !q.ghost && tileOf(q)[0] === tx && tileOf(q)[1] === ty).map((q) => q.id));
  g.bombs.push({ id: g.nextBombId++, tx, ty, owner: id, range: tiny ? 1 : p.fire, explodeAt: now + (tiny ? T.tinyFuse : T.fuse), tiny, slide: 0, progress: 0, passers });
  return true;
}

function movePlayers(g: AlleyGame, now: number, dt: number) {
  for (const p of g.players) {
    if (!p.alive && !p.ghost) continue;
    if (now < p.stunUntil || p.dir === 0) continue;
    const speed = p.ghost ? 2.6 : speedOf(p.boots);
    const r = walkFor(p.x, p.y, p.dir, (speed * dt) / 1000, worldFor(g, p));
    p.x = r.x;
    p.y = r.y;
    // Kick: walking into a firecracker sends it sliding
    if (r.bumped && p.kick && !p.ghost) {
      const b = g.bombs.find((x) => x.tx === r.bumped!.tx && x.ty === r.bumped!.ty && x.slide === 0);
      if (b) {
        b.slide = p.dir;
        g.events.push({ t: "kick", id: p.id });
      }
    }
  }
  // Once you've stepped off a firecracker, you can't walk back onto it
  for (const b of g.bombs)
    for (const id of b.passers) {
      const q = g.players.find((x) => x.id === id);
      if (!q || tileOf(q)[0] !== b.tx || tileOf(q)[1] !== b.ty) b.passers.delete(id);
    }
}

function slideBombs(g: AlleyGame, dt: number) {
  const tiles = g.tiles.join("");
  for (const b of g.bombs) {
    if (!b.slide) continue;
    b.progress += (T.kickSpeed * dt) / 1000;
    while (b.progress >= 1 && b.slide) {
      const nx = b.tx + DX[b.slide];
      const ny = b.ty + DY[b.slide];
      const blocked =
        tileAt(tiles, nx, ny) !== "." ||
        g.bombs.some((o) => o !== b && o.tx === nx && o.ty === ny) ||
        g.players.some((q) => q.alive && tileOf(q)[0] === nx && tileOf(q)[1] === ny);
      if (blocked) {
        b.slide = 0;
        b.progress = 0;
      } else {
        b.tx = nx;
        b.ty = ny;
        b.progress -= 1;
        b.passers.clear();
      }
    }
    // stop exactly at a tile if the next one is blocked
    if (b.slide) {
      const nx = b.tx + DX[b.slide];
      const ny = b.ty + DY[b.slide];
      if (tileAt(tiles, nx, ny) !== "." || g.bombs.some((o) => o !== b && o.tx === nx && o.ty === ny)) {
        b.slide = 0;
        b.progress = 0;
      }
    }
  }
}

// --- firecrackers ------------------------------------------------------------------------------

function pickPower(g: AlleyGame): Power | null {
  if (g.random() > 0.4) return null;
  const r = g.random() * 100;
  return r < 28 ? "bomb" : r < 56 ? "fire" : r < 74 ? "speed" : r < 86 ? "kick" : "shield";
}

/** The tiles a firecracker's sparks would reach (without changing anything) */
export function sparkTiles(tiles: string, bombs: { tx: number; ty: number }[], b: { tx: number; ty: number; range: number; tiny: boolean }) {
  const out: [number, number][] = [[b.tx, b.ty]];
  for (const d of [1, 2, 3, 4] as Dir[]) {
    for (let i = 1; i <= b.range; i++) {
      const tx = b.tx + DX[d] * i;
      const ty = b.ty + DY[d] * i;
      const tile = tileAt(tiles, tx, ty);
      if (tile === "#" || tile === "L") break;
      out.push([tx, ty]);
      if (tile === "c") break;
      if (!b.tiny && bombs.some((o) => o.tx === tx && o.ty === ty)) break;
    }
  }
  return out;
}

function explodeDue(g: AlleyGame, now: number) {
  for (;;) {
    const b = g.bombs.find((x) => x.explodeAt <= now);
    if (!b) return;
    g.bombs = g.bombs.filter((x) => x !== b);
    g.events.push({ t: "pop", tx: b.tx, ty: b.ty, tiny: b.tiny });
    const reach = sparkTiles(g.tiles.join(""), g.bombs, b);
    for (const [tx, ty] of reach) {
      g.sparks.push({ tx, ty, until: now + T.spark, tiny: b.tiny, owner: b.owner });
      if (b.tiny) continue;
      const i = idx(tx, ty);
      if (g.tiles[i] === "c") {
        g.tiles[i] = ".";
        g.events.push({ t: "crate", tx, ty });
        const owner = g.players.find((p) => p.id === b.owner);
        if (owner) owner.stats.crates++;
        const power = pickPower(g);
        if (power) g.items.set(i, power);
      }
      // A firecracker in the sparks goes off too (a chain)
      for (const o of g.bombs) if (o.tx === tx && o.ty === ty && !o.tiny) o.explodeAt = Math.min(o.explodeAt, now);
    }
  }
}

function knockOut(g: AlleyGame, p: AlleyPlayer, by: string | null, now: number) {
  p.alive = false;
  p.ghost = true;
  p.dir = 0;
  p.outAt = now;
  p.tinyReadyAt = now + 3000; // a moment before the first tease
  if (by === p.id) p.stats.selfOuts++;
  else if (by) {
    const killer = g.players.find((q) => q.id === by);
    if (killer) killer.stats.outs++;
  }
  g.events.push({ t: "out", id: p.id, by });
}

function sparksHit(g: AlleyGame, now: number) {
  g.sparks = g.sparks.filter((s) => s.until > now);
  for (const p of g.players) {
    if (!p.alive) continue;
    const [tx, ty] = tileOf(p);
    const here = g.sparks.filter((s) => s.tx === tx && s.ty === ty);
    if (here.length === 0) continue;
    const real = here.find((s) => !s.tiny);
    if (real) {
      if (now < p.invulnUntil) continue;
      if (p.shield) {
        p.shield = false;
        p.invulnUntil = now + T.shieldGrace;
        g.events.push({ t: "shield", id: p.id });
      } else knockOut(g, p, real.owner, now);
    } else if (now >= p.stunUntil) {
      p.stunUntil = now + T.stun;
      g.events.push({ t: "stun", id: p.id });
      const ghost = g.players.find((q) => q.id === here[0].owner);
      if (ghost) ghost.stats.teases++;
    }
  }
}

function pickUp(g: AlleyGame) {
  for (const p of g.players) {
    if (!p.alive) continue;
    const [tx, ty] = tileOf(p);
    const power = g.items.get(idx(tx, ty));
    if (!power) continue;
    g.items.delete(idx(tx, ty));
    p.stats.powers++;
    if (power === "bomb") p.bombs = Math.min(p.bombs + 1, 6);
    if (power === "fire") p.fire = Math.min(p.fire + 1, 7);
    if (power === "speed") p.boots = Math.min(p.boots + 1, 5);
    if (power === "kick") p.kick = true;
    if (power === "shield") p.shield = true;
    g.events.push({ t: "power", id: p.id, power, tx, ty });
  }
}

// --- the lion dance and the lanterns -----------------------------------------------------------

function lionDance(g: AlleyGame, now: number, dt: number) {
  if (!g.lion && now >= g.lionAt && g.lionAt > 0) {
    // A row where people can actually stand (a mostly open one)
    const rows = Array.from({ length: H }, (_, r) => r).filter((r) => MAPS[g.map][r].split("").filter((c) => c === ".").length >= 9);
    const row = rows[Math.floor(g.random() * rows.length)] ?? 0;
    const dir = g.random() < 0.5 ? 1 : -1;
    g.lion = { row, x: dir === 1 ? -1.5 : W + 1.5, dir };
    g.lionAt = 0; // once a round
    g.events.push({ t: "lion" });
  }
  if (!g.lion) return;
  g.lion.x += (g.lion.dir * T.lionSpeed * dt) / 1000;
  const tiles = g.tiles.join("");
  const free = (tx: number, ty: number) => tileAt(tiles, tx, ty) === "." && !g.bombs.some((b) => b.tx === tx && b.ty === ty);
  for (const p of g.players) {
    if (!p.alive) continue;
    const [tx, ty] = tileOf(p);
    if (ty !== g.lion.row || Math.abs(p.x - g.lion.x) > 0.8) continue;
    // Pushed aside to a free tile above or below, or carried ahead
    const options: [number, number][] = [
      [tx, ty - 1],
      [tx, ty + 1],
      [tx + g.lion.dir, ty],
    ];
    const to = options.find(([x, y]) => free(x, y));
    if (to) {
      p.x = to[0] + 0.5;
      p.y = to[1] + 0.5;
    }
  }
  if (g.lion.x < -2 || g.lion.x > W + 2) g.lion = null;
}

export const ringOf = (tx: number, ty: number) => Math.min(tx, ty, W - 1 - tx, H - 1 - ty);

function lanterns(g: AlleyGame, now: number) {
  const at = g.playStartedAt + T.suddenDeath + g.rings * T.ringEvery;
  if (now < at || g.rings > 5) return;
  const k = g.rings;
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) {
      if (ringOf(tx, ty) !== k) continue;
      g.tiles[idx(tx, ty)] = "L";
      g.items.delete(idx(tx, ty));
      g.bombs = g.bombs.filter((b) => b.tx !== tx || b.ty !== ty);
      for (const p of g.players) if (p.alive && tileOf(p)[0] === tx && tileOf(p)[1] === ty) knockOut(g, p, null, now);
    }
  g.rings++;
  g.events.push({ t: "ring", k });
}

/** When the next lantern ring falls (for the warning on screen), or null */
export function nextRingAt(g: AlleyGame) {
  if (g.phase !== "playing" || g.rings > 5) return null;
  return g.playStartedAt + T.suddenDeath + g.rings * T.ringEvery;
}

// --- bots --------------------------------------------------------------------------------------

/** Tiles that will be in sparks soon: tile index → ms until they burn */
export function dangerMap(g: AlleyGame, now: number): Map<number, number> {
  const danger = new Map<number, number>();
  const tiles = g.tiles.join("");
  const mark = (tx: number, ty: number, ms: number) => {
    const i = idx(tx, ty);
    danger.set(i, Math.min(danger.get(i) ?? Infinity, Math.max(0, ms)));
  };
  // Chains: a firecracker in another's reach goes off with the earlier one
  const fuse = new Map(g.bombs.map((b) => [b, b.explodeAt - now]));
  for (let pass = 0; pass < 3; pass++)
    for (const b of g.bombs)
      for (const [tx, ty] of sparkTiles(tiles, [], b))
        for (const o of g.bombs) if (o.tx === tx && o.ty === ty && !b.tiny) fuse.set(o, Math.min(fuse.get(o)!, fuse.get(b)!));
  for (const b of g.bombs) if (!b.tiny) for (const [tx, ty] of sparkTiles(tiles, g.bombs, b)) mark(tx, ty, fuse.get(b)!);
  for (const s of g.sparks) if (!s.tiny) mark(s.tx, s.ty, 0);
  const ring = nextRingAt(g);
  if (ring !== null && ring - now < 3500) for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (ringOf(tx, ty) === g.rings) mark(tx, ty, ring - now);
  return danger;
}

const dirTo = (fx: number, fy: number, tx: number, ty: number): Dir => (tx > fx ? 2 : tx < fx ? 4 : ty > fy ? 3 : ty < fy ? 1 : 0);

/** Breadth-first search over walkable tiles: the first step towards the nearest tile `goal` accepts */
function bfs(g: AlleyGame, p: AlleyPlayer, avoid: Map<number, number>, goal: (tx: number, ty: number, steps: number) => boolean, maxSteps = 30) {
  const tiles = g.tiles.join("");
  const [sx, sy] = tileOf(p);
  const first = new Map<number, number>([[idx(sx, sy), -1]]);
  let frontier: [number, number][] = [[sx, sy]];
  for (let steps = 0; steps <= maxSteps && frontier.length; steps++) {
    const next: [number, number][] = [];
    for (const [x, y] of frontier) {
      if (goal(x, y, steps)) {
        const f = first.get(idx(x, y))!;
        return { tx: x, ty: y, first: f === -1 ? null : ([f % W, Math.floor(f / W)] as [number, number]), steps };
      }
      for (const d of [1, 2, 3, 4] as Dir[]) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        const i = idx(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || first.has(i)) continue;
        if (tileAt(tiles, nx, ny) !== "." || g.bombs.some((b) => b.tx === nx && b.ty === ny)) continue;
        // Don't walk into tiles that will burn around the time we get there
        const burn = avoid.get(i);
        const arrive = ((steps + 1) * 1000) / speedOf(p.boots);
        if (burn !== undefined && burn < arrive + 700) continue;
        first.set(i, first.get(idx(x, y)) === -1 ? i : first.get(idx(x, y))!);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}

function steer(p: AlleyPlayer, target: { tx: number; ty: number; first: [number, number] | null } | null) {
  const [tx, ty] = tileOf(p);
  if (!target) {
    p.dir = 0;
    return;
  }
  if (target.first) {
    p.dir = dirTo(tx, ty, target.first[0], target.first[1]);
    return;
  }
  // Already on the target tile: walk to its middle, then stop
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  if (Math.abs(p.x - cx) > 0.06) p.dir = p.x < cx ? 2 : 4;
  else if (Math.abs(p.y - cy) > 0.06) p.dir = p.y < cy ? 3 : 1;
  else p.dir = 0;
}

function botThink(g: AlleyGame, p: AlleyPlayer, now: number) {
  if (p.ghost) {
    // Ghosts drift towards the nearest living player and tease them
    const living = g.players.filter((q) => q.alive);
    const near = living.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!near) return void (p.dir = 0);
    const dx = near.x - p.x;
    const dy = near.y - p.y;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : dy > 0 ? 3 : 1;
    if (Math.hypot(dx, dy) < 1.2 && g.random() < 0.3) drop(g, p.id, now);
    return;
  }
  if (!p.alive) return;
  const danger = dangerMap(g, now);
  const [tx, ty] = tileOf(p);
  const tiles = g.tiles.join("");
  if (danger.has(idx(tx, ty))) {
    steer(p, bfs(g, p, danger, (x, y) => !danger.has(idx(x, y))));
    return;
  }
  // Drop a firecracker next to a crate or in line with someone, if there's a way out afterwards
  const enemies = g.players.filter((q) => q.alive && q.id !== p.id);
  const crateNext = [1, 2, 3, 4].some((d) => tileAt(tiles, tx + DX[d], ty + DY[d]) === "c");
  const lined = enemies.some((q) => {
    const [ex, ey] = tileOf(q);
    if (ex !== tx && ey !== ty) return false;
    return sparkTiles(tiles, [], { tx, ty, range: p.fire, tiny: false }).some(([x, y]) => x === ex && y === ey);
  });
  const myBombs = g.bombs.filter((b) => b.owner === p.id && !b.tiny).length;
  if ((crateNext || lined) && myBombs < p.bombs && g.random() < 0.75) {
    const withMine = new Map(danger);
    for (const [x, y] of sparkTiles(tiles, g.bombs, { tx, ty, range: p.fire, tiny: false })) withMine.set(idx(x, y), Math.min(withMine.get(idx(x, y)) ?? Infinity, T.fuse));
    const escape = bfs(g, p, withMine, (x, y) => !withMine.has(idx(x, y)), 6);
    if (escape && drop(g, p.id, now)) {
      steer(p, escape);
      return;
    }
  }
  // Otherwise: a power-up, a spot next to a crate, or someone to chase
  const target =
    bfs(g, p, danger, (x, y) => g.items.has(idx(x, y)), 8) ??
    bfs(g, p, danger, (x, y) => [1, 2, 3, 4].some((d) => tileAt(tiles, x + DX[d], y + DY[d]) === "c")) ??
    bfs(g, p, danger, (x, y) => enemies.some((q) => Math.abs(tileOf(q)[0] - x) + Math.abs(tileOf(q)[1] - y) <= 1));
  steer(p, target);
}

// --- one step of the game ----------------------------------------------------------------------

/** Advance the game to `now` (dt ms since the last step). The server calls this 20 times a second. */
export function stepAlley(g: AlleyGame, now: number, dt: number) {
  if (g.phase === "countdown") {
    if (now >= g.phaseEndsAt) g.phase = "playing";
    return;
  }
  if (g.phase === "roundEnd") {
    if (now < g.phaseEndsAt) return;
    const champ = g.players.find((p) => p.score >= WINS_NEEDED);
    if (champ) {
      g.phase = "matchEnd";
      g.matchWinner = champ.id;
      return;
    }
    startRound(g, now);
    return;
  }
  if (g.phase !== "playing") return;

  if (now >= g.botThinkAt) {
    g.botThinkAt = now + 100; // bots think 10 times a second
    for (const p of g.players) if (p.bot) botThink(g, p, now);
  }
  movePlayers(g, now, dt);
  slideBombs(g, dt);
  explodeDue(g, now);
  sparksHit(g, now);
  pickUp(g);
  lionDance(g, now, dt);
  lanterns(g, now);

  const living = g.players.filter((p) => p.alive);
  if (living.length <= 1 || now - g.playStartedAt >= T.roundMax) {
    g.phase = "roundEnd";
    g.phaseEndsAt = now + T.roundEnd;
    g.roundWinner = living.length === 1 ? living[0].id : null;
    if (living.length === 1) {
      living[0].score++;
      living[0].stats.wins++;
    }
    g.bombs = [];
  }
}

/** Fun awards at the end of a match */
export function awards(g: AlleyGame): { award: string; id: string; value: number }[] {
  const best = (key: keyof Stats, award: string) => {
    const top = [...g.players].sort((a, b) => b.stats[key] - a.stats[key])[0];
    return top && top.stats[key] > 0 ? [{ award, id: top.id, value: top.stats[key] }] : [];
  };
  return [
    ...best("crates", "Most crates"),
    ...best("outs", "Sharpest aim"),
    ...best("powers", "Collector"),
    ...best("selfOuts", "Tripped on own cracker"),
    ...best("teases", "Pesky ghost"),
  ];
}

/** What every browser gets 20 times a second. Positions rounded: smaller messages. */
export function alleyView(g: AlleyGame, now: number) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const events = g.events;
  g.events = [];
  return {
    t: now,
    phase: g.phase,
    phaseEndsAt: g.phaseEndsAt,
    playStartedAt: g.playStartedAt,
    round: g.round,
    map: g.map,
    tiles: g.tiles.join(""),
    items: [...g.items].map(([i, power]) => [i, power] as [number, Power]),
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      hat: p.hat,
      bot: p.bot,
      x: r2(p.x),
      y: r2(p.y),
      dir: p.dir,
      alive: p.alive,
      ghost: p.ghost,
      shield: p.shield,
      stunned: now < p.stunUntil,
      blink: now < p.invulnUntil,
      bombs: p.bombs,
      fire: p.fire,
      boots: p.boots,
      kick: p.kick,
      tinyIn: p.ghost ? Math.max(0, p.tinyReadyAt - now) : 0,
      score: p.score,
    })),
    bombs: g.bombs.map((b) => ({ id: b.id, tx: b.tx, ty: b.ty, slide: b.slide, progress: r2(b.progress), tiny: b.tiny, left: b.explodeAt - now, mine: [...b.passers] })),
    sparks: g.sparks.map((s) => [s.tx, s.ty, s.tiny ? 1 : 0] as [number, number, number]),
    lion: g.lion && { row: g.lion.row, x: r2(g.lion.x), dir: g.lion.dir },
    ringAt: nextRingAt(g),
    rings: g.rings,
    roundWinner: g.roundWinner,
    matchWinner: g.matchWinner,
    awards: g.phase === "matchEnd" ? awards(g) : [],
    stats: g.phase === "matchEnd" || g.phase === "roundEnd" ? Object.fromEntries(g.players.map((p) => [p.id, p.stats])) : null,
    events,
  };
}
export type AlleyView = ReturnType<typeof alleyView>;

export { solid };
