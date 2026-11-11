// Field of view: which tiles you can see from where you stand ("recursive shadowcasting").
// The view is split into 8 slices (octants); each slice is scanned row by row moving away from you,
// and walls cast shadows that hide the tiles behind them.

import { isFloor, type Grid, type Pos } from "./grid";

const OCTANTS = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
] as const;

export function fieldOfView(g: Grid, from: Pos, radius: number): Set<number> {
  const seen = new Set<number>([from.y * g.w + from.x]);
  const r2 = radius * radius;

  function scan(row: number, start: number, end: number, [xx, xy, yx, yy]: readonly number[]) {
    if (start < end) return;
    let next = start;
    for (let j = row; j <= radius; j++) {
      let blocked = false;
      for (let dx = -j, dy = -j; dx <= 0; dx++) {
        const l = (dx - 0.5) / (dy + 0.5);
        const r = (dx + 0.5) / (dy - 0.5);
        if (start < r) continue;
        if (end > l) break;
        const x = from.x + dx * xx + dy * xy;
        const y = from.y + dx * yx + dy * yy;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        if (dx * dx + dy * dy <= r2) seen.add(y * g.w + x);
        const wall = !isFloor(g, x, y);
        if (blocked) {
          if (wall) {
            next = r;
          } else {
            blocked = false;
            start = next;
          }
        } else if (wall && j < radius) {
          blocked = true;
          scan(j + 1, start, l, [xx, xy, yx, yy]);
          next = r;
        }
      }
      if (blocked) break;
    }
  }

  for (const o of OCTANTS) scan(1, 1, 0, o);
  return seen;
}
