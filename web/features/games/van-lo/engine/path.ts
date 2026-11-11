// A* pathfinding: the shortest walk from a to b, around walls and (optionally) other things in the way.
// Used by enemies to chase you, and by "tap a tile to walk there" on phones.

import { canStep, DIRS, dist, type Grid, type Pos } from "./grid";

export function findPath(
  g: Grid,
  from: Pos,
  to: Pos,
  opts: { blocked?: (p: Pos) => boolean; maxSteps?: number; walkable?: (p: Pos) => boolean } = {},
): Pos[] | null {
  const idx = (p: Pos) => p.y * g.w + p.x;
  const goal = idx(to);
  const open: { p: Pos; f: number }[] = [{ p: from, f: dist(from, to) }];
  const cost = new Map<number, number>([[idx(from), 0]]);
  const came = new Map<number, Pos>();
  const max = opts.maxSteps ?? 4000;
  let steps = 0;

  while (open.length && steps++ < max) {
    // A small list is fine here: maps are small (about 40 × 26)
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const { p } = open.splice(best, 1)[0];
    if (idx(p) === goal) {
      const out: Pos[] = [];
      let c: Pos | undefined = p;
      while (c && idx(c) !== idx(from)) {
        out.unshift(c);
        c = came.get(idx(c));
      }
      return out;
    }
    for (const d of DIRS) {
      if (!canStep(g, p, d)) continue;
      const n = { x: p.x + d.x, y: p.y + d.y };
      if (opts.walkable && !opts.walkable(n)) continue;
      if (idx(n) !== goal && opts.blocked?.(n)) continue;
      const c = cost.get(idx(p))! + (d.x && d.y ? 1.01 : 1); // straight steps win ties
      if (c < (cost.get(idx(n)) ?? Infinity)) {
        cost.set(idx(n), c);
        came.set(idx(n), p);
        open.push({ p: n, f: c + dist(n, to) });
      }
    }
  }
  return null;
}

// How many steps from `from` to every reachable tile (breadth-first). Used to put the stairs far away.
export function distances(g: Grid, from: Pos): Map<number, number> {
  const out = new Map<number, number>([[from.y * g.w + from.x, 0]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const d of DIRS) {
      if (!canStep(g, p, d)) continue;
      const n = { x: p.x + d.x, y: p.y + d.y };
      const i = n.y * g.w + n.x;
      if (!out.has(i)) {
        out.set(i, out.get(p.y * g.w + p.x)! + 1);
        queue.push(n);
      }
    }
  }
  return out;
}
