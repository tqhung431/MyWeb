// Pancake Tower: what's left of a pancake after it lands on the one below.
// Positions are the left edge (x) and width (w), in canvas pixels.

export type Slab = { x: number; w: number };

export const PERFECT_PX = 5; // closer than this counts as a perfect drop

// null = it missed the stack completely.
export function land(below: Slab, dropped: Slab, maxW: number): { slab: Slab; perfect: boolean; cut: Slab | null } | null {
  if (Math.abs(dropped.x - below.x) <= PERFECT_PX) {
    // Perfect: snap onto the one below and grow back a little (never wider than the first)
    const w = Math.min(maxW, below.w + 6);
    return {
      slab: { x: below.x - (w - below.w) / 2, w },
      perfect: true,
      cut: null,
    };
  }
  const left = Math.max(below.x, dropped.x);
  const right = Math.min(below.x + below.w, dropped.x + dropped.w);
  if (right <= left) return null;
  const slab = { x: left, w: right - left };
  // the piece that falls off
  const cut = dropped.x < below.x ? { x: dropped.x, w: below.x - dropped.x } : { x: right, w: dropped.x + dropped.w - right };
  return { slab, perfect: false, cut };
}

// The slide speed goes up with the height of the tower.
export function slideSpeed(stacked: number): number {
  return Math.min(7, 2.2 + stacked * 0.18); // pixels per frame at 60 fps
}
