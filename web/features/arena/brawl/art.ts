// Stage 25 · Chợ Đêm Brawl: every picture, drawn in code with PixiJS shapes (our own art), turned into textures once.
// Seen from above at a slight angle: round chibi heroes with big anime eyes, a warm night market full of lanterns.

import { Graphics, type Renderer, type Texture } from "pixi.js";
import { AREAS, H, W, type EnemyKind, type HeroKind } from "./brawl";

export const TILE = 48;
const frame = (g: Graphics, w: number, h = w) => g.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.001 });
function glow(g: Graphics, x: number, y: number, r: number, color: number, strength = 0.5, rings = 6) {
  for (let i = rings; i >= 1; i--) g.circle(x, y, (r * i) / rings).fill({ color, alpha: (strength / rings) * 1.1 });
}
const hash = (x: number, y: number, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Each area has its own colours: awnings and the glow of its lanterns
const AREA_LOOK = [
  { ground: 0x3a3048, alt: 0x40354f, awning: [0xe0453a, 0xfff1d6], light: 0xffc35a },
  { ground: 0x2f3a3a, alt: 0x354242, awning: [0x2fb38a, 0xfff1d6], light: 0xffd27a },
  { ground: 0x3d2e3a, alt: 0x453441, awning: [0xf2b230, 0xb2222a], light: 0xff9a4a },
  { ground: 0x2e3350, alt: 0x343a5a, awning: [0x37a0e6, 0xfff1d6], light: 0xbfe6ff },
  { ground: 0x3a2a40, alt: 0x432f4a, awning: [0x8a5ce6, 0xff5c8a], light: 0xff8fd0 },
];

// --- the market --------------------------------------------------------------------------------

export function marketBackground(area: number): Graphics {
  const look = AREA_LOOK[area % AREA_LOOK.length];
  const g = new Graphics();
  // paving stones
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) {
      g.rect(tx * TILE, ty * TILE, TILE, TILE).fill((tx + ty) % 2 ? look.ground : look.alt);
      g.rect(tx * TILE, ty * TILE + TILE - 1, TILE, 1).fill({ color: 0x000000, alpha: 0.18 });
      g.rect(tx * TILE + TILE - 1, ty * TILE, 1, TILE).fill({ color: 0x000000, alpha: 0.12 });
      if (hash(tx, ty) < 0.12) g.circle(tx * TILE + 12 + hash(tx, ty, 1) * 24, ty * TILE + 12 + hash(tx, ty, 2) * 24, 3).fill({ color: 0xffffff, alpha: 0.05 });
    }
  // warm pools of light on the ground under the lanterns
  for (let i = 0; i < 9; i++) glow(g, (i + 0.5) * (W / 9) * TILE, (i % 2 ? 1.2 : H - 1.2) * TILE, 90, look.light, 0.18, 6);
  // stalls (the solid parts): a counter with goods, under a striped awning
  for (const s of AREAS[area].stalls) {
    const x = s.x * TILE;
    const y = s.y * TILE;
    const w = s.w * TILE;
    const h = s.h * TILE;
    g.roundRect(x + 4, y + 10, w - 8, h - 10, 8).fill({ color: 0x000000, alpha: 0.35 }); // shadow
    g.roundRect(x + 2, y + 6, w - 4, h - 8, 6).fill(0x7a5528);
    // goods on the counter: bowls, fruit, toys, lanterns, depending on the area
    const cols = Math.max(1, Math.floor(w / 22));
    const rows = Math.max(1, Math.floor((h - 20) / 22));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const gx = x + 12 + c * ((w - 24) / Math.max(1, cols - 1 || 1));
        const gy = y + 22 + r * 22;
        const color = [0xf2b230, 0xe0453a, 0x7fbf4d, 0xff8fb0, 0xffffff][(c + r + area) % 5];
        if (area === 0) g.ellipse(gx, gy, 8, 5).fill(0xfff1e0).ellipse(gx, gy - 1, 6, 3).fill(0xe8b070);
        else g.circle(gx, gy, 6).fill(color);
      }
    // the awning along the top edge
    const stripes = Math.max(2, Math.round(w / 16));
    for (let i = 0; i < stripes; i++) {
      g.rect(x + (i * w) / stripes, y, w / stripes + 0.5, 14).fill(look.awning[i % 2]);
      g.circle(x + (i + 0.5) * (w / stripes), y + 14, w / stripes / 2).fill(look.awning[i % 2]);
    }
  }
  // lantern strings across the market
  for (const row of [0.35, H - 0.35]) {
    g.moveTo(0, row * TILE).quadraticCurveTo((W * TILE) / 2, row * TILE + 20, W * TILE, row * TILE).stroke({ width: 1.5, color: 0x1a1428 });
    for (let i = 1; i < 20; i++) {
      const t = i / 20;
      const lx = t * W * TILE;
      const ly = row * TILE + 4 * t * (1 - t) * 20 + 6;
      glow(g, lx, ly, 12, look.light, 0.5, 4);
      g.ellipse(lx, ly, 5, 6).fill([0xe0322a, 0xf2b230, 0xff5c8a][i % 3]);
    }
  }
  return g;
}

// --- heroes ------------------------------------------------------------------------------------

function eyes(g: Graphics, cx: number, cy: number, s = 1, closed = false) {
  for (const side of [-1, 1]) {
    const ex = cx + side * 6 * s;
    if (closed) {
      g.moveTo(ex - 3 * s, cy).quadraticCurveTo(ex, cy + 2.5 * s, ex + 3 * s, cy).stroke({ width: 1.8, color: 0x2a1a22, cap: "round" });
      continue;
    }
    g.ellipse(ex, cy, 3.4 * s, 4.4 * s).fill(0x2a1a22);
    g.ellipse(ex, cy + 1.2 * s, 2.4 * s, 2.4 * s).fill(0x5b3fa0);
    g.circle(ex - 1.1 * s, cy - 1.6 * s, 1.4 * s).fill(0xffffff);
  }
  g.ellipse(cx - 9 * s, cy + 5 * s, 2.6 * s, 1.5 * s).fill({ color: 0xff7a8a, alpha: 0.55 });
  g.ellipse(cx + 9 * s, cy + 5 * s, 2.6 * s, 1.5 * s).fill({ color: 0xff7a8a, alpha: 0.55 });
}

/** A chibi hero, 64 × 72, facing right (the renderer flips it to face left). down = knocked down (dizzy, lying) */
export function hero(kind: HeroKind, down = false): Graphics {
  const g = frame(new Graphics(), 64, 72);
  const cx = 32;
  g.ellipse(cx, 66, 16, 5).fill({ color: 0x000000, alpha: 0.3 });
  const skin = kind === "grandma" ? 0xf3d2b5 : 0xffe0c2;
  const outfit = { chef: 0xffffff, shipper: 0x2fb38a, grandma: 0x8a5ce6, student: 0x37a0e6 }[kind];
  if (down) {
    // lying down, dizzy
    g.roundRect(10, 44, 44, 16, 8).fill(outfit);
    g.circle(14, 46, 12).fill(skin);
    eyes(g, 14, 46, 0.7, true);
    for (let i = 0; i < 3; i++) g.circle(10 + i * 8, 26 - (i % 2) * 4, 3).fill(0xffe08a);
    return g;
  }
  // feet, body
  g.roundRect(cx - 9, 58, 7, 7, 3).fill(0x3a2418);
  g.roundRect(cx + 2, 58, 7, 7, 3).fill(0x3a2418);
  g.roundRect(cx - 12, 40, 24, 21, 9).fill(outfit);
  // head
  g.circle(cx, 28, 17).fill(skin);
  if (kind === "chef") {
    // a tall chef's hat, an apron, a big ladle
    g.roundRect(cx - 12, 2, 24, 14, 6).fill(0xffffff);
    g.circle(cx - 8, 6, 7).fill(0xffffff);
    g.circle(cx + 8, 6, 7).fill(0xffffff);
    g.rect(cx - 13, 14, 26, 4).fill(0xe6e6ee);
    g.roundRect(cx - 8, 44, 16, 16, 4).fill(0xe0453a);
    g.rect(cx + 14, 26, 4, 28).fill(0x9a9aa8);
    g.ellipse(cx + 16, 24, 8, 5).fill(0xbfc0cc);
  } else if (kind === "shipper") {
    // a helmet and a delivery box on the back
    g.roundRect(cx - 18, 30, 12, 14, 3).fill(0xf2b230);
    g.circle(cx, 24, 18).fill(0x2fb38a);
    g.rect(cx - 18, 24, 36, 6).fill(0x2fb38a);
    g.roundRect(cx - 4, 18, 22, 8, 4).fill({ color: 0xbfe9ff, alpha: 0.85 }); // visor
    g.circle(cx, 30, 14).fill(skin);
  } else if (kind === "grandma") {
    // white bun, glasses, a cup of tea; a slipper in hand
    g.circle(cx, 12, 9).fill(0xf0f0f0);
    g.circle(cx, 22, 16).fill(0xe6e6e6);
    g.circle(cx, 30, 14).fill(skin);
    g.roundRect(cx + 14, 42, 10, 6, 3).fill(0xe0453a);
    g.roundRect(cx - 24, 44, 9, 8, 2).fill(0xfff1e0);
  } else {
    // school uniform, red scarf, backpack, slingshot
    g.roundRect(cx - 18, 36, 10, 18, 4).fill(0xf2b230);
    g.circle(cx, 22, 16).fill(0x2a1a22); // hair
    g.circle(cx, 30, 14).fill(skin);
    g.poly([cx - 6, 42, cx + 6, 42, cx, 50]).fill(0xe0453a);
    g.moveTo(cx + 14, 50).lineTo(cx + 18, 38).lineTo(cx + 22, 50).stroke({ width: 2.5, color: 0x7a5528 });
  }
  eyes(g, cx + 2, 31, 0.9);
  if (kind === "grandma") {
    g.circle(cx - 4, 31, 5).stroke({ width: 1.2, color: 0x7a5528 });
    g.circle(cx + 8, 31, 5).stroke({ width: 1.2, color: 0x7a5528 });
  }
  return g;
}

// --- trouble-makers ----------------------------------------------------------------------------

export function enemy(kind: EnemyKind): Graphics {
  const big = kind === "umbrellaBoss" || kind === "karaokeKing";
  const size = big ? 112 : 56;
  const g = frame(new Graphics(), size, size);
  const c = size / 2;
  g.ellipse(c, size - 6, size * 0.3, 5).fill({ color: 0x000000, alpha: 0.3 });
  if (kind === "rat") {
    // a pickpocket rat with a bandit mask and a little sack
    g.moveTo(c + 12, 40).quadraticCurveTo(c + 26, 44, c + 22, 30).stroke({ width: 3, color: 0xd9a0a0, cap: "round" });
    g.ellipse(c, 38, 14, 11).fill(0x9a9aa8);
    g.circle(c - 4, 24, 11).fill(0xa8a8b6);
    g.circle(c - 12, 15, 5).fill(0xa8a8b6);
    g.circle(c + 4, 15, 5).fill(0xa8a8b6);
    g.circle(c - 12, 15, 2.5).fill(0xffb3c1);
    g.circle(c + 4, 15, 2.5).fill(0xffb3c1);
    g.rect(c - 14, 21, 20, 6).fill(0x2a1a22); // mask
    g.circle(c - 9, 24, 2).fill(0xffffff);
    g.circle(c + 1, 24, 2).fill(0xffffff);
    g.circle(c - 4, 31, 2).fill(0xff7a8a);
    g.circle(c + 12, 40, 7).fill(0xc9a85c); // the sack
  } else if (kind === "ninja") {
    // an umbrella ninja: dark wrap, a paper umbrella over the shoulder
    g.moveTo(c - 10, 8).lineTo(c + 18, 30).stroke({ width: 2, color: 0x5a3a22 });
    g.poly([c - 22, 10, c - 4, -2, c + 8, 14]).fill(0xe0453a);
    g.roundRect(c - 11, 30, 22, 20, 8).fill(0x2a2440);
    g.circle(c, 24, 13).fill(0x2a2440);
    g.rect(c - 11, 20, 22, 7).fill(0xffe0c2);
    g.ellipse(c - 4, 23, 2.5, 3).fill(0x2a1a22);
    g.ellipse(c + 4, 23, 2.5, 3).fill(0x2a1a22);
    g.rect(c - 13, 16, 26, 3).fill(0xe0453a); // headband
  } else if (kind === "balloon") {
    // a balloon seller with a bunch of balloons
    for (const [bx, by, col] of [[c - 12, 8, 0xff5c8a], [c, 4, 0xf2b230], [c + 12, 9, 0x37a0e6]] as const) {
      g.moveTo(c, 34).lineTo(bx, by + 8).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
      g.ellipse(bx, by, 7, 9).fill(col);
      g.circle(bx - 2, by - 3, 2).fill({ color: 0xffffff, alpha: 0.5 });
    }
    g.roundRect(c - 11, 36, 22, 16, 7).fill(0xc9a85c);
    g.circle(c, 30, 10).fill(0xffe0c2);
    g.poly([c - 13, 26, c, 16, c + 13, 26]).fill(0xf3dfa2);
    eyes(g, c, 31, 0.6);
  } else if (kind === "umbrellaBoss") {
    // the Umbrella Master: a huge spinning umbrella above a stout ninja
    g.circle(c, 34, 40).fill(0xb2222a);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.moveTo(c, 34).lineTo(c + Math.cos(a) * 40, 34 + Math.sin(a) * 40).stroke({ width: 2, color: 0xf2c94c, alpha: 0.8 });
    }
    g.circle(c, 34, 6).fill(0xf2c94c);
    g.roundRect(c - 20, 70, 40, 30, 12).fill(0x2a2440);
    g.circle(c, 66, 16).fill(0x2a2440);
    g.rect(c - 14, 62, 28, 8).fill(0xffe0c2);
    g.ellipse(c - 5, 66, 3, 3.5).fill(0x2a1a22);
    g.ellipse(c + 5, 66, 3, 3.5).fill(0x2a1a22);
  } else {
    // the Karaoke King: a glittering jacket, a crown, a microphone, speakers on his back
    glow(g, c, 60, 50, 0xff8fd0, 0.35);
    g.roundRect(c - 40, 40, 16, 30, 4).fill(0x2a2440);
    g.roundRect(c + 24, 40, 16, 30, 4).fill(0x2a2440);
    for (const x of [c - 32, c + 32]) {
      g.circle(x, 50, 5).fill(0x555577);
      g.circle(x, 62, 6).fill(0x555577);
    }
    g.roundRect(c - 24, 54, 48, 40, 16).fill(0x8a5ce6);
    for (let i = 0; i < 12; i++) g.circle(c - 18 + (i % 4) * 12, 60 + Math.floor(i / 4) * 10, 2).fill(0xfff4c2);
    g.circle(c, 40, 22).fill(0xffe0c2);
    g.poly([c - 18, 22, c - 12, 8, c - 4, 18, c, 4, c + 4, 18, c + 12, 8, c + 18, 22]).fill(0xf2c94c);
    g.roundRect(c - 14, 34, 28, 8, 4).fill(0x2a1a22); // sunglasses
    g.moveTo(c - 6, 50).quadraticCurveTo(c, 54, c + 6, 50).stroke({ width: 2, color: 0x2a1a22 });
    g.rect(c + 22, 46, 4, 18).fill(0x2a2a2a);
    g.circle(c + 24, 44, 6).fill(0x9a9aa8);
  }
  return g;
}

// --- effects -----------------------------------------------------------------------------------

export function shotTexture(kind: string): Graphics {
  const g = new Graphics();
  if (kind === "pebble") g.circle(5, 5, 4).fill(0x9a9a88);
  else if (kind === "slipper") g.roundRect(0, 0, 18, 9, 4).fill(0xe0453a).roundRect(3, 2, 12, 5, 3).fill(0xff8a6a);
  else if (kind === "plane") g.poly([0, 0, 18, 6, 0, 12, 4, 6]).fill(0xffffff);
  else if (kind === "balloon") g.ellipse(9, 11, 9, 11).fill(0xff5c8a).circle(6, 7, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
  else g.circle(50, 50, 46).stroke({ width: 5, color: 0xff8fd0, alpha: 0.85 }).circle(50, 50, 40).stroke({ width: 2, color: 0xffffff, alpha: 0.5 }); // sound wave
  return g;
}
export function swingArc(color: number): Graphics {
  const g = new Graphics();
  g.arc(40, 40, 34, -0.9, 0.9).stroke({ width: 8, color, alpha: 0.85, cap: "round" });
  g.arc(40, 40, 26, -0.7, 0.7).stroke({ width: 3, color: 0xffffff, alpha: 0.6, cap: "round" });
  return g;
}
export function confetti(): Graphics {
  const g = new Graphics();
  g.circle(64, 64, 62).fill({ color: 0xff8fd0, alpha: 0.18 });
  for (let i = 0; i < 40; i++) {
    const a = hash(i, 1) * Math.PI * 2;
    const r = Math.sqrt(hash(i, 2)) * 58;
    g.rect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 4, 3).fill([0xf2c94c, 0xe0453a, 0x2fb38a, 0x37a0e6, 0xff5c8a][i % 5]);
  }
  return g;
}
export function star(): Graphics {
  const g = new Graphics();
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4 : 10;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push(10 + Math.cos(a) * r, 10 + Math.sin(a) * r);
  }
  return g.poly(pts).fill(0xffe08a);
}
export function softDot(color: number): Graphics {
  const g = new Graphics();
  for (let i = 4; i >= 1; i--) g.circle(12, 12, (12 * i) / 4).fill({ color, alpha: 0.3 });
  return g;
}

export const HERO_COLOR: Record<HeroKind, number> = { chef: 0xffe08a, shipper: 0x7fe0bd, grandma: 0xc3a6ff, student: 0x8fd0ff };

export function makeBrawlTextures(renderer: Renderer) {
  const tex = (g: Graphics, resolution = 2) => {
    const t = renderer.generateTexture({ target: g, resolution, antialias: true });
    g.destroy();
    return t;
  };
  const backgrounds = new Map<number, Texture>();
  return {
    background(area: number) {
      let t = backgrounds.get(area);
      if (!t) backgrounds.set(area, (t = tex(marketBackground(area), 1.5)));
      return t;
    },
    hero: Object.fromEntries((["chef", "shipper", "grandma", "student"] as HeroKind[]).map((k) => [k, tex(hero(k))])) as Record<HeroKind, Texture>,
    heroDown: Object.fromEntries((["chef", "shipper", "grandma", "student"] as HeroKind[]).map((k) => [k, tex(hero(k, true))])) as Record<HeroKind, Texture>,
    enemy: Object.fromEntries((["rat", "ninja", "balloon", "umbrellaBoss", "karaokeKing"] as EnemyKind[]).map((k) => [k, tex(enemy(k))])) as Record<EnemyKind, Texture>,
    shot: Object.fromEntries(["pebble", "slipper", "plane", "balloon", "wave"].map((k) => [k, tex(shotTexture(k))])) as Record<string, Texture>,
    swing: Object.fromEntries((["chef", "shipper", "grandma", "student"] as HeroKind[]).map((k) => [k, tex(swingArc(HERO_COLOR[k]))])) as Record<HeroKind, Texture>,
    confetti: tex(confetti()),
    star: tex(star()),
    puff: tex(softDot(0xffffff)),
    heal: tex(softDot(0x7fe07a)),
    destroy() {
      for (const t of backgrounds.values()) t.destroy(true);
    },
  };
}
export type BrawlTextures = ReturnType<typeof makeBrawlTextures>;
