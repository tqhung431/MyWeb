// Stage 24 · Giữ Làng: every picture, drawn in code with PixiJS shapes (our own art), turned into textures once.
// Style: a Vietnamese countryside at dusk and at night; round, cute spirits (mischief, not menace).

import { Graphics, type Renderer, type Texture } from "pixi.js";
import { COLS, MAPS, pathTiles, ROWS, type Branch, type MapId, type SpiritKind, type TowerKind } from "./village";

export const TILE = 48;

type Look = { ground: number; groundAlt: number; blade: number; path: number; pathEdge: number; pebble: number; night: boolean };
export const LOOKS: Record<MapId, Look> = {
  riverside: { ground: 0x74b354, groundAlt: 0x6aa84c, blade: 0x8fcf6a, path: 0xd2ad72, pathEdge: 0xa8834e, pebble: 0xb89660, night: false },
  terraces: { ground: 0x8cc152, groundAlt: 0x7fb547, blade: 0xa9d86e, path: 0xbf9658, pathEdge: 0x93703f, pebble: 0xa8824a, night: false },
  festival: { ground: 0x2e2a4d, groundAlt: 0x342f57, blade: 0x423b6b, path: 0x6c6690, pathEdge: 0x4d4870, pebble: 0x7d77a3, night: true },
};

const frame = (g: Graphics, w = TILE, h = w) => g.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.001 });
function glow(g: Graphics, x: number, y: number, r: number, color: number, strength = 0.5, rings = 6) {
  for (let i = rings; i >= 1; i--) g.circle(x, y, (r * i) / rings).fill({ color, alpha: (strength / rings) * 1.1 });
}
/** A deterministic "random" number for tile x, y (so decorations never jump around) */
const hash = (x: number, y: number, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// --- the whole map, drawn once -----------------------------------------------------------------

export function mapBackground(map: MapId): Graphics {
  const look = LOOKS[map];
  const def = MAPS[map];
  const g = new Graphics();
  const onPath = pathTiles(map);
  const water = new Set(def.water.map(([x, y]) => `${x},${y}`));
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      if (map === "terraces" && !onPath.has(`${tx},${ty}`)) {
        // rice paddies: rows of young rice, a band of water shine on some
        g.rect(x, y, TILE, TILE).fill(ty % 2 ? look.ground : look.groundAlt);
        if (hash(tx, ty) < 0.35) g.rect(x + 2, y + 2, TILE - 4, TILE - 4).fill({ color: 0x9fd3e6, alpha: 0.35 });
        for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) g.rect(x + 5 + c * 9, y + 6 + r * 11, 2, 6).fill(look.blade);
        g.rect(x, y + TILE - 3, TILE, 3).fill({ color: 0x5f8f33, alpha: 0.8 }); // the terrace step
      } else {
        g.rect(x, y, TILE, TILE).fill((tx + ty) % 2 ? look.ground : look.groundAlt);
        for (let i = 0; i < 4; i++) {
          const bx = x + hash(tx, ty, i) * 40 + 4;
          const by = y + hash(tx, ty, i + 9) * 40 + 4;
          g.rect(bx, by, 2, 4).fill({ color: look.blade, alpha: 0.8 });
        }
      }
      if (water.has(`${tx},${ty}`)) {
        g.rect(x, y, TILE, TILE).fill(0x4aa3d8);
        for (let i = 0; i < 3; i++) g.moveTo(x + 6, y + 12 + i * 12).quadraticCurveTo(x + 24, y + 6 + i * 12, x + 42, y + 12 + i * 12).stroke({ width: 2, color: 0xbfe6ff, alpha: 0.6 });
      }
    }
  // the paths: a soft edge, then the walkway with pebbles (or paving stones at the festival)
  for (const k of onPath) {
    const [tx, ty] = k.split(",").map(Number);
    g.roundRect(tx * TILE - 2, ty * TILE - 2, TILE + 4, TILE + 4, 10).fill(look.pathEdge);
  }
  for (const k of onPath) {
    const [tx, ty] = k.split(",").map(Number);
    const x = tx * TILE;
    const y = ty * TILE;
    g.rect(x + 2, y + 2, TILE - 4, TILE - 4).fill(look.path);
    if (look.night) {
      g.rect(x + 2, y + TILE / 2, TILE - 4, 1).fill({ color: 0x000000, alpha: 0.2 });
      g.rect(x + TILE / 2, y + 2, 1, TILE / 2 - 2).fill({ color: 0x000000, alpha: 0.2 });
    } else for (let i = 0; i < 3; i++) g.circle(x + 8 + hash(tx, ty, i) * 32, y + 8 + hash(tx, ty, i + 5) * 32, 2).fill(look.pebble);
  }
  // decorations: trees by day, little market tents at the night festival
  for (const [tx, ty] of def.trees) {
    const cx = tx * TILE + 24;
    const cy = ty * TILE + 26;
    if (look.night) {
      g.poly([cx - 18, cy + 4, cx, cy - 16, cx + 18, cy + 4]).fill(0xd94c3d);
      g.rect(cx - 14, cy + 4, 28, 14).fill(0x7a3b1f);
      glow(g, cx, cy + 8, 16, 0xffc35a, 0.5);
    } else {
      g.ellipse(cx, cy + 16, 14, 4).fill({ color: 0x000000, alpha: 0.2 });
      g.rect(cx - 3, cy + 2, 6, 14).fill(0x7a5528);
      g.circle(cx, cy - 4, 15).fill(0x3f8f3a);
      g.circle(cx - 7, cy - 9, 9).fill(0x4fa646);
      g.circle(cx + 6, cy, 8).fill(0x357d31);
    }
  }
  // festival: strings of little lanterns across the sky
  if (look.night) {
    for (const row of [0.3, 9.7]) {
      g.moveTo(0, row * TILE).quadraticCurveTo((COLS * TILE) / 2, row * TILE + 26, COLS * TILE, row * TILE).stroke({ width: 1.5, color: 0x1a1730 });
      for (let i = 1; i < 16; i++) {
        const t = i / 16;
        const lx = t * COLS * TILE;
        const ly = row * TILE + 4 * t * (1 - t) * 26;
        glow(g, lx, ly + 6, 10, [0xff6a3d, 0xffd27a, 0xff8fb0][i % 3], 0.5, 4);
        g.ellipse(lx, ly + 6, 4, 5).fill([0xe0322a, 0xf2b230, 0xff5c8a][i % 3]);
      }
    }
  }
  // entrances: a little wooden gate at the start of each path
  for (const p of def.paths) {
    const [tx, ty] = p[0];
    const x = tx * TILE + 24;
    const y = ty * TILE + 24;
    g.rect(x - 18, y - 20, 4, 30).fill(0x8a3221);
    g.rect(x + 14, y - 20, 4, 30).fill(0x8a3221);
    g.roundRect(x - 22, y - 24, 44, 6, 3).fill(0xb2442c);
  }
  return g;
}

/** The granary the spirits want to raid (drawn on top of the path's last tile) */
export function granary(night: boolean): Graphics {
  const g = frame(new Graphics(), 96, 96);
  g.ellipse(48, 88, 40, 7).fill({ color: 0x000000, alpha: 0.25 });
  g.roundRect(14, 46, 68, 40, 4).fill(0xa0703c);
  for (let i = 0; i < 6; i++) g.rect(16 + i * 11, 46, 2, 40).fill({ color: 0x6e4a24, alpha: 0.5 });
  g.roundRect(40, 62, 16, 24, 3).fill(0x5a3a1c);
  if (night) glow(g, 48, 74, 14, 0xffc35a, 0.6);
  g.poly([6, 50, 48, 14, 90, 50]).fill(0xd9b45a); // thatched roof
  for (let i = 0; i < 7; i++) g.moveTo(14 + i * 11, 48).lineTo(48, 18).stroke({ width: 1, color: 0xa8873a, alpha: 0.6 });
  // rice sacks
  for (const [x, y] of [[82, 78], [74, 82], [88, 84]] as const) {
    g.ellipse(x, y, 8, 9).fill(0xf3e6c8);
    g.rect(x - 4, y - 9, 8, 3).fill(0xb89660);
  }
  return g;
}

// --- defenders ---------------------------------------------------------------------------------

function levelMarks(g: Graphics, level: number, branch: Branch | null) {
  const color = branch === "a" ? 0xe0453a : branch === "b" ? 0x37a0e6 : 0xf2c94c;
  for (let i = 0; i < level; i++) g.poly([22 + i * 8, 60, 26 + i * 8, 54, 30 + i * 8, 60]).fill(color);
}

export function tower(kind: TowerKind, level: number, branch: Branch | null): Graphics {
  const g = frame(new Graphics(), 64, 64);
  g.ellipse(32, 56, 20, 5).fill({ color: 0x000000, alpha: 0.25 });
  if (kind === "archer") {
    // a bamboo lookout with a little archer in a conical hat
    for (const x of [16, 46]) {
      g.roundRect(x, 22, 4, 34, 2).fill(0x7fb547);
      for (const y of [30, 42]) g.rect(x - 1, y, 6, 2).fill(0x5f8f33);
    }
    g.roundRect(12, 24, 40, 6, 2).fill(0xc9a85c);
    g.circle(32, 14, 7).fill(0xffe0c2);
    g.poly([22, 12, 32, 2, 42, 12]).fill(0xf3dfa2);
    g.moveTo(42, 6).quadraticCurveTo(50, 16, 42, 26).stroke({ width: 2, color: 0x7a3b1f });
    g.moveTo(42, 6).lineTo(42, 26).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    if (branch === "a" && level > 1) g.moveTo(10, 18).lineTo(20, 18).stroke({ width: 2, color: 0xe0453a });
    if (branch === "b" && level > 1) g.poly([46, 16, 54, 16, 50, 12]).fill(0x37a0e6);
  } else if (kind === "lantern") {
    g.rect(30, 14, 4, 42).fill(0x5a3a22);
    g.rect(22, 14, 20, 3).fill(0x5a3a22);
    const count = level;
    for (let i = 0; i < count; i++) {
      const x = 24 + (count === 1 ? 8 : i * (16 / (count - 1)));
      const y = 26 + (i % 2) * 4;
      glow(g, x, y, 14, branch === "b" ? 0xff7a1a : 0xffd27a, 0.5, 4);
      g.ellipse(x, y, 6, 7).fill(0xe0322a);
      g.rect(x - 3, y - 8, 6, 2).fill(0xf2b230);
      if (branch === "b" && level > 1) g.ellipse(x, y + 1, 2.5, 3.5).fill(0xffd27a);
    }
  } else if (kind === "drum") {
    // a temple drum on its wooden stand
    g.rect(14, 42, 4, 14).fill(0x5a3a22);
    g.rect(46, 42, 4, 14).fill(0x5a3a22);
    g.roundRect(14, 22, 36, 26, 10).fill(0xb2222a);
    g.ellipse(32, 35, 14, 12).fill(0xf3dfa2);
    g.ellipse(32, 35, 14, 12).stroke({ width: 2, color: level > 1 ? 0xf2c94c : 0x7a3b1f });
    for (const x of [16, 48]) for (const y of [26, 44]) g.circle(x, y, 1.5).fill(0xf2c94c);
    g.moveTo(48, 14).lineTo(40, 26).stroke({ width: 3, color: 0x7a5528, cap: "round" });
    g.circle(48, 13, 3).fill(0xe0453a);
  } else if (kind === "kite") {
    // a child flying one kite (two with Twin kites)
    g.circle(26, 40, 6).fill(0xffe0c2);
    g.roundRect(20, 46, 12, 10, 4).fill(0x2fb38a);
    const kites = branch === "a" && level > 1 ? 2 : 1;
    for (let i = 0; i < kites; i++) {
      const kx = 40 + i * 12;
      const ky = 12 + i * 8;
      g.moveTo(28, 40).lineTo(kx, ky + 8).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
      g.poly([kx, ky, kx + 7, ky + 8, kx, ky + 16, kx - 7, ky + 8]).fill([0xff5c8a, 0xf2b230][i]);
      g.moveTo(kx - 7, ky + 8).lineTo(kx + 7, ky + 8).stroke({ width: 1, color: 0x7a3b1f });
      g.moveTo(kx, ky + 16).quadraticCurveTo(kx - 4, ky + 22, kx + 2, ky + 26).stroke({ width: 1.5, color: 0xe0453a });
    }
    if (branch === "b" && level > 1) g.circle(46, 10, 3).fill(0x37a0e6);
  } else {
    // a rice-cake cart with an umbrella
    g.roundRect(12, 30, 40, 18, 4).fill(0xa0703c);
    for (const x of [20, 44]) {
      g.circle(x, 50, 6).fill(0x5a3a22);
      g.circle(x, 50, 2).fill(0xc9a85c);
    }
    for (let i = 0; i < 2 + level; i++) g.rect(15 + i * 8, 24 - (i % 2) * 3, 7, 7).fill(0x3f8f3a); // bánh chưng
    g.rect(31, 6, 2, 26).fill(0x5a3a22);
    g.poly([14, 12, 32, 2, 50, 12]).fill(branch === "b" ? 0x37a0e6 : 0xe0453a);
  }
  levelMarks(g, level, branch);
  return g;
}

// --- spirits -----------------------------------------------------------------------------------

function face(g: Graphics, x: number, y: number, s = 1) {
  g.ellipse(x - 4 * s, y, 2.2 * s, 2.8 * s).fill(0x2a1a22);
  g.ellipse(x + 4 * s, y, 2.2 * s, 2.8 * s).fill(0x2a1a22);
  g.circle(x - 4.6 * s, y - 1, 0.9 * s).fill(0xffffff);
  g.circle(x + 3.4 * s, y - 1, 0.9 * s).fill(0xffffff);
  g.moveTo(x - 2 * s, y + 4 * s).quadraticCurveTo(x, y + 5.5 * s, x + 2 * s, y + 4 * s).stroke({ width: 1.2, color: 0x2a1a22 });
}

export function spirit(kind: SpiritKind): Graphics {
  const size = kind === "rabbit" ? 80 : 48;
  const g = frame(new Graphics(), size, size);
  const c = size / 2;
  if (kind !== "crane") g.ellipse(c, size - 6, size * 0.28, 4).fill({ color: 0x000000, alpha: 0.25 });
  if (kind === "fox") {
    // a fox-wisp: a little blue flame with fox ears
    glow(g, c, 26, 18, 0x7fd0ff, 0.45);
    g.moveTo(c - 12, 30).bezierCurveTo(c - 14, 18, c - 4, 12, c, 8).bezierCurveTo(c + 4, 12, c + 14, 18, c + 12, 30).quadraticCurveTo(c, 40, c - 12, 30).fill(0xbfe9ff);
    g.poly([c - 10, 16, c - 7, 6, c - 3, 13]).fill(0xbfe9ff);
    g.poly([c + 10, 16, c + 7, 6, c + 3, 13]).fill(0xbfe9ff);
    g.moveTo(c + 10, 32).quadraticCurveTo(c + 22, 30, c + 18, 18).stroke({ width: 4, color: 0x7fd0ff, cap: "round" }); // tail
    face(g, c, 24);
  } else if (kind === "turtle") {
    for (const [x, y] of [[c - 12, 36], [c + 12, 36]] as const) g.ellipse(x, y, 5, 4).fill(0x8a8a7a);
    g.circle(c + 15, 26, 6).fill(0x9a9a88);
    g.ellipse(c, 26, 16, 13).fill(0x6e6e66);
    g.ellipse(c - 4, 21, 6, 4).fill(0x7fb547); // moss
    for (const [x, y] of [[c - 6, 30], [c + 6, 26], [c, 18]] as const) g.circle(x, y, 2).fill({ color: 0x000000, alpha: 0.2 });
    g.circle(c + 17, 25, 1.5).fill(0x2a1a22);
  } else if (kind === "crane") {
    // a folded paper crane (it flies: drawn with a shadow far below by the renderer)
    g.poly([c, 22, c - 20, 12, c - 4, 26]).fill(0xffffff);
    g.poly([c, 22, c + 20, 10, c + 4, 26]).fill(0xf0f0f6);
    g.poly([c - 6, 26, c + 8, 26, c, 34]).fill(0xe6e6ee);
    g.poly([c + 6, 26, c + 16, 18, c + 12, 27]).fill(0xffffff);
    g.poly([c + 16, 18, c + 20, 17, c + 17, 21]).fill(0xe0453a);
    g.moveTo(c - 20, 12).lineTo(c - 4, 26).stroke({ width: 1, color: 0xc8c8d6 });
  } else if (kind === "gourd" || kind === "gourdlet") {
    const s = kind === "gourd" ? 1 : 0.7;
    g.circle(c, 30, 12 * s).fill(0x6fbf4a);
    g.circle(c, 18 - (1 - s) * -6, 8 * s).fill(0x7fcf58);
    g.rect(c - 1.5, 8 + (1 - s) * 8, 3, 5 * s).fill(0x5a3a22);
    g.ellipse(c + 7 * s, 38, 3 * s, 4 * s).fill({ color: 0x9fe07a, alpha: 0.8 }); // a drip of slime
    face(g, c, 30, s);
  } else {
    // the Moon-Rabbit of Mischief: big, white, a crescent moon on its forehead, a wooden mallet
    glow(g, c, 40, 34, 0xfff4c2, 0.3);
    g.ellipse(c - 10, 16, 6, 18).fill(0xffffff);
    g.ellipse(c + 10, 16, 6, 18).fill(0xffffff);
    g.ellipse(c - 10, 16, 3, 13).fill(0xffc6d6);
    g.ellipse(c + 10, 16, 3, 13).fill(0xffc6d6);
    g.ellipse(c, 52, 22, 20).fill(0xffffff);
    g.circle(c, 36, 16).fill(0xffffff);
    g.moveTo(c - 4, 24).arc(c, 26, 5, Math.PI * 1.1, Math.PI * 1.9).stroke({ width: 3, color: 0xf2c94c, cap: "round" });
    face(g, c, 38, 1.4);
    g.ellipse(c - 9, 44, 3.5, 2).fill({ color: 0xff7a8a, alpha: 0.6 });
    g.ellipse(c + 9, 44, 3.5, 2).fill({ color: 0xff7a8a, alpha: 0.6 });
    g.rect(c + 18, 30, 4, 34).fill(0x8a5a2c);
    g.roundRect(c + 10, 22, 20, 12, 4).fill(0xa0703c);
  }
  return g;
}

export function arrow(): Graphics {
  const g = new Graphics();
  g.rect(0, 2, 16, 2).fill(0x7a5528);
  g.poly([16, 0, 21, 3, 16, 6]).fill(0xd0d0d0);
  g.poly([0, 0, 3, 3, 0, 6]).fill(0xe0453a);
  return g;
}
export function kiteShot(): Graphics {
  const g = new Graphics();
  g.poly([6, 0, 12, 6, 6, 12, 0, 6]).fill(0xff5c8a);
  return g;
}
export function ring(): Graphics {
  const g = new Graphics();
  g.circle(50, 50, 46).stroke({ width: 6, color: 0xffe08a, alpha: 0.9 });
  g.circle(50, 50, 40).stroke({ width: 3, color: 0xffffff, alpha: 0.5 });
  return g;
}
export function lightAura(): Graphics {
  const g = new Graphics();
  glow(g, 100, 100, 100, 0xffd27a, 0.55, 10);
  return g;
}
export function puff(color: number): Graphics {
  const g = new Graphics();
  for (let i = 4; i >= 1; i--) g.circle(10, 10, (10 * i) / 4).fill({ color, alpha: 0.3 });
  return g;
}

/** Make the textures for one map, once (defenders are made the first time they're needed) */
export function makeVillageTextures(renderer: Renderer, map: MapId) {
  const tex = (g: Graphics, resolution = 2) => {
    const t = renderer.generateTexture({ target: g, resolution, antialias: true });
    g.destroy();
    return t;
  };
  const towers = new Map<string, Texture>();
  return {
    background: tex(mapBackground(map), 1.5),
    granary: tex(granary(LOOKS[map].night)),
    spirit: Object.fromEntries((["fox", "turtle", "crane", "gourd", "gourdlet", "rabbit"] as SpiritKind[]).map((k) => [k, tex(spirit(k))])) as Record<SpiritKind, Texture>,
    arrow: tex(arrow()),
    kite: tex(kiteShot()),
    ring: tex(ring()),
    aura: tex(lightAura(), 1),
    puff: tex(puff(0xffffff)),
    coin: tex(puff(0xf2c94c)),
    tower(kind: TowerKind, level: number, branch: Branch | null) {
      const key = `${kind}:${level}:${branch}`;
      let t = towers.get(key);
      if (!t) towers.set(key, (t = tex(tower(kind, level, branch))));
      return t;
    },
    destroy() {
      for (const t of towers.values()) t.destroy(true);
    },
  };
}
export type VillageTextures = ReturnType<typeof makeVillageTextures>;
