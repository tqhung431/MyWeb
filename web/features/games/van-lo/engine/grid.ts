// The map is a grid of tiles. Positions are {x, y}; tiles are stored row by row in one string.

export type Pos = { x: number; y: number };

export const WALL = "#";
export const FLOOR = ".";

export type Grid = { w: number; h: number; tiles: string };

export const at = (g: Grid, x: number, y: number) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? WALL : g.tiles[y * g.w + x]);
export const isFloor = (g: Grid, x: number, y: number) => at(g, x, y) !== WALL;
export const key = (p: Pos) => `${p.x},${p.y}`;
export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
// Chebyshev distance: diagonal steps count as one, like a king in chess
export const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// The 8 neighbours, straight ones first (so paths prefer straight lines)
export const DIRS: readonly Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

// A diagonal step may not cut a wall corner
export function canStep(g: Grid, from: Pos, d: Pos) {
  const x = from.x + d.x;
  const y = from.y + d.y;
  if (!isFloor(g, x, y)) return false;
  if (d.x !== 0 && d.y !== 0) return isFloor(g, from.x + d.x, from.y) && isFloor(g, from.x, from.y + d.y);
  return true;
}

// The tiles on a straight line from a to b (Bresenham), without a, up to and including b
export function line(a: Pos, b: Pos): Pos[] {
  const out: Pos[] = [];
  let { x, y } = a;
  const dx = Math.abs(b.x - x);
  const dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  while (!(x === b.x && y === b.y)) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    out.push({ x, y });
  }
  return out;
}

// Can a sees b? Nothing but floor between them.
export function clearLine(g: Grid, a: Pos, b: Pos) {
  const pts = line(a, b);
  return pts.slice(0, -1).every((p) => isFloor(g, p.x, p.y));
}
