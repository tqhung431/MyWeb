// Building a floor of a secret realm (bí cảnh) from the random generator:
// rooms joined by corridors, then the stairs far from the start, enemies, herbs, chests and hidden traps.

import { FLOOR, WALL, type Pos } from "../engine/grid";
import { distances } from "../engine/path";
import type { Rng } from "../engine/rng";
import { enemyStats, ITEMS, realmInfo, stonesFor, type EnemyKind, type ItemId, type RealmId } from "./data";
import { newUid } from "./player";
import type { Enemy, Floor, Game, Thing } from "./types";

export const MAP_W = 40;
export const MAP_H = 26;

type Room = { x: number; y: number; w: number; h: number };
const center = (r: Room): Pos => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

export function carveRooms(rng: Rng, w = MAP_W, h = MAP_H): { tiles: string[]; rooms: Room[] } {
  const tiles = Array<string>(w * h).fill(WALL);
  const rooms: Room[] = [];
  for (let tries = 0; tries < 200 && rooms.length < 9; tries++) {
    const r = { w: rng.int(4, 9), h: rng.int(3, 6), x: 0, y: 0 };
    r.x = rng.int(1, w - r.w - 2);
    r.y = rng.int(1, h - r.h - 2);
    const overlaps = rooms.some((o) => r.x - 1 <= o.x + o.w && r.x + r.w + 1 >= o.x && r.y - 1 <= o.y + o.h && r.y + r.h + 1 >= o.y);
    if (overlaps) continue;
    rooms.push(r);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * w + x] = FLOOR;
  }
  const dig = (a: Pos, b: Pos) => {
    const horizontalFirst = rng.chance(0.5);
    const corner = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    for (const [p, q] of [
      [a, corner],
      [corner, b],
    ]) {
      for (let x = Math.min(p.x, q.x); x <= Math.max(p.x, q.x); x++) for (let y = Math.min(p.y, q.y); y <= Math.max(p.y, q.y); y++) tiles[y * w + x] = FLOOR;
    }
  };
  // Join rooms left to right, then add a couple of loops so there's more than one way round
  const order = [...rooms].sort((a, b) => a.x - b.x);
  for (let i = 1; i < order.length; i++) dig(center(order[i - 1]), center(order[i]));
  for (let i = 0; i < 2 && rooms.length > 3; i++) dig(center(rng.pick(rooms)), center(rng.pick(rooms)));
  return { tiles, rooms: order };
}

function randomTileIn(rng: Rng, r: Room): Pos {
  return { x: rng.int(r.x, r.x + r.w - 1), y: rng.int(r.y, r.y + r.h - 1) };
}

export function makeEnemy(g: Game, kind: EnemyKind, level: number, pos: Pos): Enemy {
  const s = enemyStats(kind, level);
  return { uid: newUid(g, "e"), kind, level, pos, hp: s.hp, maxHp: s.hp, awake: false, status: [], cooldown: 0 };
}

export function makeFloor(g: Game, rng: Rng, realm: RealmId, depth: number): { floor: Floor; start: Pos } {
  const info = realmInfo(realm);
  const { tiles, rooms } = carveRooms(rng);
  const grid = { w: MAP_W, h: MAP_H, tiles: tiles.join("") };
  const startRoom = rooms[0];
  const start = center(startRoom);
  const far = distances(grid, start);
  const d = (p: Pos) => far.get(p.y * MAP_W + p.x) ?? 0;

  const taken = new Set<string>([`${start.x},${start.y}`]);
  const free = (p: Pos) => tiles[p.y * MAP_W + p.x] === FLOOR && !taken.has(`${p.x},${p.y}`);
  const place = (room: Room, minDist = 0): Pos | null => {
    for (let i = 0; i < 30; i++) {
      const p = randomTileIn(rng, room);
      if (free(p) && d(p) >= minDist) {
        taken.add(`${p.x},${p.y}`);
        return p;
      }
    }
    return null;
  };

  const others = rooms.slice(1);
  const farthest = [...others].sort((a, b) => d(center(b)) - d(center(a)))[0] ?? startRoom;
  const things: Thing[] = [];
  const enemies: Enemy[] = [];
  const last = depth >= info.floors;

  // Stairs down, or the boss on the last floor
  const goal = place(farthest) ?? center(farthest);
  if (last) {
    const boss = makeEnemy(g, info.boss.kind, info.boss.level, goal);
    enemies.push(boss);
  } else things.push({ uid: newUid(g, "s"), kind: "stairs", pos: goal });

  // A return array (truyền tống trận) in another room
  const portalRoom = others.find((r) => r !== farthest) ?? startRoom;
  const portal = place(portalRoom);
  if (portal && !last) things.push({ uid: newUid(g, "p"), kind: "portal", pos: portal });

  const kinds = info.enemies[Math.min(depth, info.enemies.length) - 1];
  const level = (bonus: number) => info.firstLevel + (depth - 1) * 2 + bonus;
  const count = 4 + depth * 2;
  for (let i = 0; i < count && others.length; i++) {
    const p = place(rng.pick(others), 5);
    if (p) enemies.push(makeEnemy(g, rng.pick(kinds), level(rng.int(0, 1)), p));
  }
  for (let i = 0; i < rng.int(2, 3); i++) {
    const p = place(rng.pick(rooms));
    if (p) things.push({ uid: newUid(g, "h"), kind: "herb", pos: p });
  }
  for (let i = 0; i < rng.int(1, 2); i++) {
    const p = place(rng.pick(others));
    if (p) things.push({ uid: newUid(g, "c"), kind: "chest", pos: p });
  }
  for (let i = 0; i < 2; i++) {
    const p = place(rng.pick(others));
    if (p) things.push({ uid: newUid(g, "m"), kind: "stones", pos: p, amount: rng.int(4, 8) + depth * 3 });
  }
  // Hidden traps (sát trận) from the second floor
  for (let i = 0; i < depth - 1; i++) {
    const p = place(rng.pick(others), 3);
    if (p) things.push({ uid: newUid(g, "x"), kind: "trap", pos: p, hidden: true });
  }

  // Stage 18: urns and crates to smash, a shrine to pray at, sometimes a wandering merchant
  for (let i = 0; i < rng.int(3, 6); i++) {
    const p = place(rng.pick(others), 2);
    if (p) things.push({ uid: newUid(g, "u"), kind: rng.chance(0.7) ? "urn" : "crate", pos: p });
  }
  if (rng.chance(0.4)) {
    const p = place(rng.pick(others), 4);
    if (p) things.push({ uid: newUid(g, "r"), kind: "shrine", pos: p });
  }
  if (depth >= 2 && rng.chance(0.35)) {
    const p = place(rng.pick(others), 4);
    if (p) things.push({ uid: newUid(g, "n"), kind: "merchant", pos: p, offers: merchantOffers(rng, realm, info.firstLevel) });
  }

  // Stage 17: each deeper realm has its own danger on the ground (lava, whirlpools, grudge miasma)
  if (info.hazard) {
    for (let i = 0; i < 3 + depth; i++) {
      const p = place(rng.pick(others), 2);
      if (p) things.push({ uid: newUid(g, "z"), kind: "hazard", hazard: info.hazard, pos: p });
    }
  }

  // Decorations along the walls (they never block a path)
  const nearWall = (p: { x: number; y: number }) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => tiles[(p.y + dy) * MAP_W + p.x + dx] === WALL));
  for (let tries = 0, n = 0; tries < 300 && n < 18; tries++) {
    const room = rng.pick(rooms);
    const p = randomTileIn(rng, room);
    if (!free(p) || !nearWall(p)) continue;
    taken.add(`${p.x},${p.y}`);
    things.push({ uid: newUid(g, "d"), kind: "deco", deco: rng.pick(info.decos), pos: p });
    n++;
  }

  const floor: Floor = { depth, w: MAP_W, h: MAP_H, tiles: grid.tiles, seen: "0".repeat(MAP_W * MAP_H), things, enemies };
  return { floor, start };
}

// The tribulation arena: an open circle of rock under the sky, with a few boulders to hide behind
export const ARENA = 13;
export function makeArena(): { floor: Floor; start: Pos } {
  const tiles: string[] = [];
  const c = (ARENA - 1) / 2;
  for (let y = 0; y < ARENA; y++)
    for (let x = 0; x < ARENA; x++) {
      const inside = (x - c) ** 2 + (y - c) ** 2 <= (c - 0.5) ** 2;
      const boulder = [
        [3, 3],
        [9, 3],
        [3, 9],
        [9, 9],
      ].some(([bx, by]) => bx === x && by === y);
      tiles.push(inside && !boulder ? FLOOR : WALL);
    }
  return {
    floor: { depth: 0, w: ARENA, h: ARENA, tiles: tiles.join(""), seen: "1".repeat(ARENA * ARENA), things: [], enemies: [] },
    start: { x: c, y: c },
  };
}

// A wandering merchant (tán tu thương nhân): three things for sale, a little dearer than the market at home
export function merchantOffers(rng: Rng, realm: RealmId, level: number) {
  const info = realmInfo(realm);
  const pool: ItemId[] = [
    level >= 10 ? "dai-hoi-xuan" : "hoi-xuan",
    "hoi-linh",
    "bao-linh-phu",
    "truyen-tong-phu",
    info.herb,
    "yeu-dan",
    "huyen-thiet",
    "phu-chi",
  ];
  const out: { id: ItemId; price: number }[] = [];
  while (out.length < 3) {
    const id = rng.pick(pool);
    if (out.some((o) => o.id === id)) continue;
    const base = ITEMS[id].price * (level >= 10 ? stonesFor(level) / stonesFor(10) : 1);
    out.push({ id, price: Math.max(5, Math.round(base * 1.3)) });
  }
  return out;
}
