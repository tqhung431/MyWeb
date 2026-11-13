// Stage 23 · Ngõ Pháo: every picture in the game, drawn in code with PixiJS shapes (our own art, no image files).
// Each drawing is turned into a texture once (a picture on the graphics card) and reused by many sprites,
// which is what keeps the game at 60+ frames a second on a phone.
//
// Style: a Tết night in an old town. Warm stone, red and gold, soft glows; round "lantern-head" characters with
// big shiny anime eyes.

import { Graphics, type Renderer, type Texture } from "pixi.js";
import { PLAYER_COLORS } from "./colors";

export const TILE = 48;

export { PLAYER_COLORS };
export const HAT_NAMES = ["No hat", "Leaf hat", "Cat ears", "Ribbon", "Dragon horns"] as const;

type Theme = { floor: number; floorAlt: number; grout: number; wall: number; wallTop: number; wallDark: number; accent: number };
export const THEMES: Record<string, Theme> = {
  "old-town": { floor: 0x5d4a3c, floorAlt: 0x67533f, grout: 0x43352b, wall: 0xd9a441, wallTop: 0x8a3221, wallDark: 0xa8762a, accent: 0xffd27a },
  market: { floor: 0x4d3f5c, floorAlt: 0x574868, grout: 0x382e45, wall: 0x9b6a43, wallTop: 0xd94c3d, wallDark: 0x6e4a2e, accent: 0xfff1d6 },
  rooftops: { floor: 0x9a4b33, floorAlt: 0xa4553a, grout: 0x6e2f1f, wall: 0x5a6b85, wallTop: 0x3e4b61, wallDark: 0x434f63, accent: 0xcfe3ff },
};

/** An invisible square so every texture has the same size and its middle is the tile's middle */
const frame = (g: Graphics, size = TILE) => g.rect(0, 0, size, size).fill({ color: 0x000000, alpha: 0.001 });

function glow(g: Graphics, x: number, y: number, r: number, color: number, strength = 0.5, rings = 6) {
  for (let i = rings; i >= 1; i--) g.circle(x, y, (r * i) / rings).fill({ color, alpha: (strength / rings) * 1.1 });
}

// --- the alley ---------------------------------------------------------------------------------

export function floorTile(theme: Theme, variant: number): Graphics {
  const g = new Graphics();
  g.rect(0, 0, TILE, TILE).fill(variant % 2 ? theme.floorAlt : theme.floor);
  // flagstones: two or three stones per tile, edges in a darker grout
  const s = TILE / 2;
  const off = variant % 3 === 0 ? 0 : variant % 3 === 1 ? 6 : -6;
  g.rect(0, s - 1, TILE, 2).fill({ color: theme.grout, alpha: 0.7 });
  g.rect(s + off - 1, 0, 2, s).fill({ color: theme.grout, alpha: 0.7 });
  g.rect(s - off - 1, s, 2, s).fill({ color: theme.grout, alpha: 0.7 });
  // worn highlights
  g.rect(3, 3, 10, 2).fill({ color: 0xffffff, alpha: 0.05 });
  g.rect(s + 4, s + 5, 12, 2).fill({ color: 0xffffff, alpha: 0.05 });
  if (variant % 5 === 0) g.circle(10 + (variant % 7) * 3, 34, 2).fill({ color: 0x000000, alpha: 0.12 }); // a pebble
  return g;
}

export function wallTile(map: string, theme: Theme): Graphics {
  const g = frame(new Graphics());
  if (map === "market") {
    // A little market stall: wooden counter under a striped awning
    g.roundRect(4, 20, 40, 26, 4).fill(theme.wall);
    g.rect(4, 38, 40, 8).fill(theme.wallDark);
    for (let i = 0; i < 3; i++) g.circle(13 + i * 11, 26, 4).fill([0xf2b230, 0x7fbf4d, 0xe0453a][i]); // fruit on the counter
    for (let i = 0; i < 5; i++) g.rect(2 + i * 9, 6, 9, 14).fill(i % 2 ? 0xfff1d6 : theme.wallTop);
    for (let i = 0; i < 5; i++) g.circle(6.5 + i * 9, 20, 4.5).fill(i % 2 ? 0xfff1d6 : theme.wallTop);
    g.rect(2, 4, 44, 3).fill(0x5a3a22);
  } else if (map === "rooftops") {
    // A chimney stack of blue-grey bricks with a moonlit top
    g.roundRect(6, 8, 36, 38, 5).fill(theme.wall);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) g.rect(8 + i * 12 + (row % 2) * 6, 14 + row * 8, 10, 6).fill({ color: theme.wallDark, alpha: 0.6 });
    g.roundRect(3, 4, 42, 8, 3).fill(theme.wallTop);
    g.rect(5, 4, 38, 2).fill({ color: theme.accent, alpha: 0.6 });
  } else {
    // An old-town house: ochre wall, tiled roof with curled ends, a warm window
    g.rect(5, 18, 38, 28).fill(theme.wall);
    g.rect(5, 40, 38, 6).fill(theme.wallDark);
    g.roundRect(17, 24, 14, 12, 2).fill(0x3a2418);
    glow(g, 24, 30, 9, theme.accent, 0.45);
    g.roundRect(18, 25, 12, 10, 2).fill(0xffc35a);
    g.rect(23.5, 25, 1, 10).fill(0x3a2418);
    g.poly([0, 20, 6, 8, 42, 8, 48, 20]).fill(theme.wallTop);
    g.poly([0, 20, -2, 14, 4, 17]).fill(theme.wallTop);
    g.poly([48, 20, 50, 14, 44, 17]).fill(theme.wallTop);
    for (let i = 0; i < 6; i++) g.rect(6 + i * 6.5, 9, 1.5, 10).fill({ color: 0x000000, alpha: 0.18 });
  }
  return g;
}

export function crateTile(): Graphics {
  const g = frame(new Graphics());
  g.roundRect(5, 7, 38, 37, 5).fill(0xb8894a);
  // bamboo slats with knots
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 7;
    g.roundRect(x, 9, 6, 33, 3).fill(i % 2 ? 0xd9b06a : 0xcfa25c);
    g.rect(x, 18 + (i % 3) * 3, 6, 2).fill({ color: 0x7a5528, alpha: 0.6 });
    g.rect(x + 1, 10, 1.5, 30).fill({ color: 0xffffff, alpha: 0.18 });
  }
  // rope bands
  g.rect(5, 14, 38, 4).fill(0x7a3b1f);
  g.rect(5, 33, 38, 4).fill(0x7a3b1f);
  g.roundRect(5, 7, 38, 37, 5).stroke({ width: 2, color: 0x5c3a18 });
  return g;
}

/** Sudden death: a big red lantern filling the tile */
export function lanternTile(): Graphics {
  const g = frame(new Graphics());
  glow(g, 24, 26, 26, 0xff6a3d, 0.35);
  g.rect(23, 0, 2, 8).fill(0x5a3a22);
  g.roundRect(15, 6, 18, 5, 2).fill(0xf2b230);
  g.ellipse(24, 26, 19, 16).fill(0xe0322a);
  for (const dx of [-10, 0, 10]) g.ellipse(24 + dx, 26, 3, 15.5).stroke({ width: 1.5, color: 0x9c1a14, alpha: 0.7 });
  g.ellipse(18, 21, 5, 4).fill({ color: 0xffffff, alpha: 0.25 });
  g.roundRect(15, 40, 18, 5, 2).fill(0xf2b230);
  g.rect(23, 45, 2, 3).fill(0xf2b230);
  return g;
}

// --- firecrackers and sparks -------------------------------------------------------------------

export function firecracker(tiny = false): Graphics {
  const g = frame(new Graphics());
  const s = tiny ? 0.62 : 1;
  const w = 16 * s;
  const h = 26 * s;
  const x = 24 - w / 2;
  const y = 28 - h / 2;
  g.ellipse(24, 28 + h / 2, w * 0.8, 4).fill({ color: 0x000000, alpha: 0.25 }); // shadow
  g.roundRect(x, y, w, h, 5 * s).fill(tiny ? 0xff7aa8 : 0xd8281f);
  g.rect(x, y + h * 0.2, w, 3 * s).fill(0xf2c94c);
  g.rect(x, y + h * 0.7, w, 3 * s).fill(0xf2c94c);
  g.rect(x + 3 * s, y + 2, 3 * s, h - 4).fill({ color: 0xffffff, alpha: 0.25 });
  if (!tiny) {
    // a little 福-style gold diamond (just a shape, no writing)
    g.poly([24, y + h * 0.36, 24 + 5, y + h * 0.5, 24, y + h * 0.64, 24 - 5, y + h * 0.5]).fill(0xf2c94c);
  }
  g.moveTo(24, y)
    .quadraticCurveTo(28, y - 6, 26, y - 10 * s)
    .stroke({ width: 2, color: 0x3a2a1a, cap: "round" });
  return g;
}

/** The spark at the end of the fuse (animated by the renderer) */
export function fuseSpark(): Graphics {
  const g = frame(new Graphics(), 24);
  glow(g, 12, 12, 11, 0xffd27a, 0.7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.moveTo(12, 12)
      .lineTo(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9)
      .stroke({ width: 1.5, color: 0xfff4c2 });
  }
  g.circle(12, 12, 3).fill(0xffffff);
  return g;
}

/** One tile of sparks (the cross is made of these) */
export function sparkTile(tiny = false): Graphics {
  const g = frame(new Graphics());
  const c = tiny ? 0xff9ad0 : 0xffb43a;
  glow(g, 24, 24, 30, c, 0.75, 8);
  g.circle(24, 24, 13).fill({ color: tiny ? 0xffd6ec : 0xffe7a8, alpha: 0.95 });
  g.circle(24, 24, 7).fill(0xffffff);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    g.poly([24 + Math.cos(a) * 6, 24 + Math.sin(a) * 6, 24 + Math.cos(a + 0.25) * 22, 24 + Math.sin(a + 0.25) * 22, 24 + Math.cos(a + 0.5) * 6, 24 + Math.sin(a + 0.5) * 6]).fill({
      color: 0xfff4c2,
      alpha: 0.8,
    });
  }
  return g;
}

// --- power-ups ---------------------------------------------------------------------------------

export const POWER_STYLE: Record<string, number> = { bomb: 0xe0453a, fire: 0xff8a2a, speed: 0x37b4e6, kick: 0x8a5ce6, shield: 0x2fb38a };

export function powerUp(kind: string): Graphics {
  const g = frame(new Graphics());
  const c = POWER_STYLE[kind] ?? 0xffffff;
  glow(g, 24, 24, 22, c, 0.4);
  g.circle(24, 24, 15).fill(0xfff7e6);
  g.circle(24, 24, 15).stroke({ width: 3, color: c });
  if (kind === "bomb") {
    g.roundRect(19, 16, 10, 16, 3).fill(0xd8281f);
    g.rect(19, 20, 10, 2).fill(0xf2c94c);
    g.moveTo(24, 16).quadraticCurveTo(27, 12, 26, 10).stroke({ width: 1.5, color: 0x3a2a1a });
    g.circle(31, 30, 5).fill(c);
    g.rect(29, 29.2, 4, 1.6).fill(0xffffff);
    g.rect(30.2, 28, 1.6, 4).fill(0xffffff);
  } else if (kind === "fire") {
    g.moveTo(24, 12)
      .bezierCurveTo(32, 20, 32, 28, 24, 34)
      .bezierCurveTo(16, 28, 17, 22, 21, 18)
      .bezierCurveTo(21, 23, 24, 24, 24, 12)
      .fill(0xff7a1a);
    g.circle(24, 28, 4).fill(0xffd27a);
  } else if (kind === "speed") {
    g.roundRect(15, 24, 18, 8, 3).fill(c);
    g.roundRect(15, 17, 8, 10, 3).fill(c);
    for (const y of [18, 22, 26]) g.rect(8, y, 5, 1.6).fill(c);
  } else if (kind === "kick") {
    g.roundRect(17, 13, 8, 15, 3).fill(c);
    g.roundRect(17, 24, 16, 8, 4).fill(c);
    g.moveTo(33, 22).lineTo(37, 18).stroke({ width: 2, color: c, cap: "round" });
    g.moveTo(34, 27).lineTo(39, 27).stroke({ width: 2, color: c, cap: "round" });
  } else {
    g.moveTo(24, 12).lineTo(33, 16).lineTo(32, 26).quadraticCurveTo(29, 33, 24, 36).quadraticCurveTo(19, 33, 16, 26).lineTo(15, 16).closePath().fill(c);
    g.moveTo(24, 15).lineTo(24, 33).stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 });
  }
  return g;
}

// --- the lantern-heads -------------------------------------------------------------------------

/** Big shiny anime eyes, looking a little towards `dir` */
function eyes(g: Graphics, cx: number, cy: number, dir: number, closed = false, dazed = false) {
  const lx = [0, 0, 2, 0, -2][dir];
  const ly = [0, -1.5, 0, 1.5, 0][dir];
  for (const side of [-1, 1]) {
    const ex = cx + side * 7 + lx;
    const ey = cy + ly;
    if (closed) {
      g.moveTo(ex - 4, ey).quadraticCurveTo(ex, ey + 3, ex + 4, ey).stroke({ width: 2, color: 0x2a1a22, cap: "round" });
      continue;
    }
    if (dazed) {
      g.moveTo(ex - 3, ey - 3).lineTo(ex + 3, ey + 3).stroke({ width: 2, color: 0x2a1a22, cap: "round" });
      g.moveTo(ex + 3, ey - 3).lineTo(ex - 3, ey + 3).stroke({ width: 2, color: 0x2a1a22, cap: "round" });
      continue;
    }
    g.ellipse(ex, ey, 4.2, 5.4).fill(0x2a1a22);
    g.ellipse(ex, ey + 1.5, 3, 3).fill(0x6b3fa0); // a coloured iris
    g.circle(ex - 1.4, ey - 2, 1.7).fill(0xffffff); // the big highlight
    g.circle(ex + 1.3, ey + 2.2, 0.8).fill(0xffffff);
  }
  // blushing cheeks and a tiny mouth
  g.ellipse(cx - 11 + lx, cy + 6 + ly, 3.2, 1.8).fill({ color: 0xff7a8a, alpha: 0.55 });
  g.ellipse(cx + 11 + lx, cy + 6 + ly, 3.2, 1.8).fill({ color: 0xff7a8a, alpha: 0.55 });
  if (dir !== 1) g.moveTo(cx - 2 + lx, cy + 6 + ly).quadraticCurveTo(cx + lx, cy + 8.5 + ly, cx + 2 + lx, cy + 6 + ly).stroke({ width: 1.5, color: 0x2a1a22, cap: "round" });
}

function hat(g: Graphics, kind: number, cx: number, top: number, color: (typeof PLAYER_COLORS)[number]) {
  if (kind === 1) {
    // nón lá, the conical leaf hat
    g.poly([cx - 17, top + 6, cx, top - 12, cx + 17, top + 6]).fill(0xf3dfa2);
    g.moveTo(cx - 17, top + 6).lineTo(cx + 17, top + 6).stroke({ width: 2, color: 0xc9a85c });
    for (const t of [0.35, 0.65]) g.moveTo(cx - 17 * t, top + 6 - 18 * (1 - t)).lineTo(cx + 17 * t, top + 6 - 18 * (1 - t)).stroke({ width: 1, color: 0xc9a85c, alpha: 0.7 });
  } else if (kind === 2) {
    for (const side of [-1, 1]) {
      g.poly([cx + side * 6, top + 4, cx + side * 14, top - 8, cx + side * 16, top + 6]).fill(color.dark);
      g.poly([cx + side * 9, top + 3, cx + side * 13.5, top - 3, cx + side * 14.5, top + 4]).fill(0xffb3c1);
    }
  } else if (kind === 3) {
    g.poly([cx + 4, top + 2, cx + 14, top - 6, cx + 14, top + 8]).fill(0xff5c8a);
    g.poly([cx + 4, top + 2, cx - 6, top - 6, cx - 6, top + 8]).fill(0xff5c8a);
    g.circle(cx + 4, top + 2, 3.5).fill(0xff8fb0);
  } else if (kind === 4) {
    for (const side of [-1, 1]) {
      g.moveTo(cx + side * 7, top + 4)
        .quadraticCurveTo(cx + side * 9, top - 6, cx + side * 15, top - 9)
        .quadraticCurveTo(cx + side * 12, top - 2, cx + side * 11, top + 5)
        .fill(0xf2c94c);
    }
  }
}

/** A lantern-head: a round paper-lantern head with gold caps on a little robed body. 64 × 64. */
export function character(colorIndex: number, hatKind: number, dir: number, opts: { ghost?: boolean; dazed?: boolean } = {}): Graphics {
  const c = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  const g = frame(new Graphics(), 64);
  const cx = 32;
  if (opts.ghost) {
    // A little floating ghost, still recognisable by its colour
    g.moveTo(14, 28)
      .bezierCurveTo(14, 6, 50, 6, 50, 28)
      .lineTo(50, 50)
      .quadraticCurveTo(46, 44, 42, 50)
      .quadraticCurveTo(38, 56, 34, 50)
      .quadraticCurveTo(30, 44, 26, 50)
      .quadraticCurveTo(22, 56, 18, 50)
      .quadraticCurveTo(16, 46, 14, 50)
      .closePath()
      .fill({ color: 0xf4f0ff, alpha: 0.85 });
    g.circle(cx, 27, 17).stroke({ width: 3, color: c.light, alpha: 0.7 });
    eyes(g, cx, 26, dir, false);
    return g;
  }
  g.ellipse(cx, 58, 15, 4).fill({ color: 0x000000, alpha: 0.28 }); // shadow
  // body: a little robe with a gold sash, and two feet
  g.roundRect(cx - 7, 52, 5, 6, 2).fill(0x3a2418);
  g.roundRect(cx + 2, 52, 5, 6, 2).fill(0x3a2418);
  g.roundRect(cx - 11, 38, 22, 17, 8).fill(c.dark);
  g.rect(cx - 11, 44, 22, 3).fill(0xf2c94c);
  // head: the lantern
  glow(g, cx, 27, 26, c.light, 0.18, 5);
  g.ellipse(cx, 27, 20, 17).fill(c.body);
  for (const dx of [-12, 0, 12]) g.ellipse(cx + dx * 0.85, 27, Math.abs(dx) > 0 ? 4 : 0.6, 16.5).stroke({ width: 1.2, color: c.dark, alpha: 0.35 });
  g.ellipse(cx - 7, 19, 7, 5).fill({ color: 0xffffff, alpha: 0.28 });
  g.roundRect(cx - 10, 8, 20, 5, 2).fill(0xf2c94c);
  g.roundRect(cx - 9, 41, 18, 4, 2).fill(0xf2c94c);
  // face (only when not facing away)
  g.ellipse(cx, 29, 15, 11).fill({ color: 0xfff1e0, alpha: dir === 1 ? 0 : 0.9 });
  if (dir !== 1) eyes(g, cx, 27, dir, false, opts.dazed);
  hat(g, hatKind, cx, 9, c);
  return g;
}

// --- the lion dance (múa lân) ------------------------------------------------------------------

export function lionHead(): Graphics {
  const g = frame(new Graphics(), 96);
  g.ellipse(48, 86, 34, 7).fill({ color: 0x000000, alpha: 0.25 });
  // fluffy white fringe
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i / 11) * Math.PI;
    g.circle(48 + Math.cos(a) * 36, 50 + Math.sin(a) * 30, 9).fill(0xfff7ea);
  }
  g.ellipse(48, 52, 34, 30).fill(0xe0322a);
  g.ellipse(48, 40, 26, 14).fill(0xf2b230);
  g.moveTo(48, 20).lineTo(54, 8).lineTo(42, 8).closePath().fill(0x2fb38a); // the horn
  g.circle(48, 8, 4).fill(0xffe08a);
  for (const side of [-1, 1]) {
    g.ellipse(48 + side * 14, 46, 10, 11).fill(0xffffff);
    g.circle(48 + side * 14, 48, 6).fill(0x2a1a22);
    g.circle(48 + side * 12, 45, 2.5).fill(0xffffff);
    g.moveTo(48 + side * 6, 33).quadraticCurveTo(48 + side * 14, 28, 48 + side * 24, 34).stroke({ width: 3, color: 0x2a1a22, cap: "round" });
  }
  g.ellipse(48, 62, 9, 6).fill(0xff8a6a);
  g.roundRect(30, 68, 36, 10, 5).fill(0xffffff);
  for (let i = 0; i < 5; i++) g.rect(33 + i * 7, 68, 1.5, 10).fill({ color: 0xd0c0b0 });
  g.ellipse(48, 52, 34, 30).stroke({ width: 3, color: 0xf2b230 });
  return g;
}

export function lionCloth(i: number): Graphics {
  const g = frame(new Graphics(), 48);
  const colors = [0xf2b230, 0xe0322a, 0x2fb38a];
  g.roundRect(4, 10, 40, 30, 12).fill(colors[i % 3]);
  for (let k = 0; k < 4; k++) g.circle(10 + k * 10, 40, 5).fill(0xfff7ea);
  g.roundRect(4, 10, 40, 30, 12).stroke({ width: 2, color: 0xf2c94c });
  return g;
}

/** Make all the textures the game needs, once */
export function makeTextures(renderer: Renderer, map: string) {
  const tex = (g: Graphics) => {
    const t = renderer.generateTexture({ target: g, resolution: 2, antialias: true });
    g.destroy();
    return t;
  };
  const theme = THEMES[map] ?? THEMES["old-town"];
  const cache = new Map<string, Texture>();
  return {
    floor: Array.from({ length: 6 }, (_, i) => tex(floorTile(theme, i))),
    wall: tex(wallTile(map, theme)),
    crate: tex(crateTile()),
    lantern: tex(lanternTile()),
    bomb: tex(firecracker()),
    tiny: tex(firecracker(true)),
    fuse: tex(fuseSpark()),
    spark: tex(sparkTile()),
    tinySpark: tex(sparkTile(true)),
    power: Object.fromEntries(["bomb", "fire", "speed", "kick", "shield"].map((k) => [k, tex(powerUp(k))])) as Record<string, Texture>,
    lion: tex(lionHead()),
    cloth: [0, 1, 2].map((i) => tex(lionCloth(i))),
    /** Characters are made the first time they're needed (colour × hat × facing × state) */
    character(color: number, hatKind: number, dir: number, state: "" | "ghost" | "dazed" = "") {
      const key = `${color}:${hatKind}:${dir}:${state}`;
      let t = cache.get(key);
      if (!t) {
        t = tex(character(color, hatKind, dir, { ghost: state === "ghost", dazed: state === "dazed" }));
        cache.set(key, t);
      }
      return t;
    },
    destroy() {
      for (const t of cache.values()) t.destroy(true);
    },
  };
}
export type AlleyTextures = ReturnType<typeof makeTextures>;
