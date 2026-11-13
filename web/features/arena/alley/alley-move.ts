// Stage 23 · Ngõ Pháo: how a character walks through the alley. This file exists TWICE, byte for byte:
//   api/src/arena/alley-move.ts                (the game server: the real position)
//   web/features/arena/alley/alley-move.ts     (your browser: your own character moves at once, no waiting)
// api/tests/alley.test.ts fails if the two copies differ. Change one, copy it to the other.
//
// The alley is a grid of 13 × 11 tiles. Positions are in tiles: (0.5, 0.5) is the middle of the top-left tile.
// Characters walk along the middle of rows and columns, like on rails. Pressing towards a wall while slightly
// off-centre slides you round the corner, so you don't get stuck on edges.

export const W = 13;
export const H = 11;

/** 0 none · 1 up · 2 right · 3 down · 4 left */
export type Dir = 0 | 1 | 2 | 3 | 4;
export const DX = [0, 0, 1, 0, -1];
export const DY = [0, -1, 0, 1, 0];

/** Tiles: "." floor · "#" wall · "c" bamboo crate · "L" lantern (sudden death) */
export type MoveWorld = {
  tiles: string;
  /** Is there a firecracker this character can't walk through on that tile? */
  bombBlocks: (tx: number, ty: number) => boolean;
  /** Ghosts float over everything except the edge of the alley */
  ghost?: boolean;
};

export function tileAt(tiles: string, tx: number, ty: number): string {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return "#";
  return tiles[ty * W + tx];
}

export function solid(w: MoveWorld, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  if (w.ghost) return false;
  return tileAt(w.tiles, tx, ty) !== "." || w.bombBlocks(tx, ty);
}

export type MoveResult = { x: number; y: number; bumped: { tx: number; ty: number } | null };

/** Walk `dist` tiles in direction `dir` from (x, y). Returns the new position and the tile bumped into, if any. */
export function walk(x: number, y: number, dir: Dir, dist: number, w: MoveWorld): MoveResult {
  if (dir === 0 || dist <= 0) return { x, y, bumped: null };
  const dx = DX[dir];
  const dy = DY[dir];
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const toward = (v: number, target: number, d: number) => (Math.abs(target - v) <= d ? target : v + Math.sign(target - v) * d);

  if (dx !== 0) {
    if (!solid(w, tx + dx, ty)) {
      // The way ahead is open: keep to the middle of the row while walking
      return { x: x + dx * dist, y: toward(y, cy, dist), bumped: null };
    }
    // Something ahead: walk up to the middle of this tile, no further
    if (dx * (cx - x) > 1e-9) return { x: toward(x, cx, dist), y, bumped: null };
    // At the middle and still pushing: go round the corner if it's open on the side you lean to
    const off = y - cy;
    if (off < -1e-9 && !solid(w, tx + dx, ty - 1) && !solid(w, tx, ty - 1)) return { x, y: y - dist, bumped: null };
    if (off > 1e-9 && !solid(w, tx + dx, ty + 1) && !solid(w, tx, ty + 1)) return { x, y: y + dist, bumped: null };
    return { x, y: toward(y, cy, dist), bumped: { tx: tx + dx, ty } };
  }
  if (!solid(w, tx, ty + dy)) return { x: toward(x, cx, dist), y: y + dy * dist, bumped: null };
  if (dy * (cy - y) > 1e-9) return { x, y: toward(y, cy, dist), bumped: null };
  const off = x - cx;
  if (off < 0 && !solid(w, tx - 1, ty + dy) && !solid(w, tx - 1, ty)) return { x: x - dist, y, bumped: null };
  if (off > 1e-9 && !solid(w, tx + 1, ty + dy) && !solid(w, tx + 1, ty)) return { x: x + dist, y, bumped: null };
  return { x: toward(x, cx, dist), y, bumped: { tx, ty: ty + dy } };
}

/** Walk in small steps so a fast character never skips past a wall in one tick */
export function walkFor(x: number, y: number, dir: Dir, dist: number, w: MoveWorld): MoveResult {
  let r: MoveResult = { x, y, bumped: null };
  let left = dist;
  while (left > 1e-9) {
    const d = Math.min(left, 0.2);
    r = walk(r.x, r.y, dir, d, w);
    left -= d;
    if (r.bumped) break;
  }
  return r;
}

/** Walking speed in tiles per second, with `boots` speed power-ups */
export const speedOf = (boots: number) => Math.min(3.2 + boots * 0.45, 5.5);
