// Stage 18: the sprite library. Every character, prop and particle Vân Lộ shows, drawn in code (no image files)
// and kept in a cache of small canvases, so each frame only copies pictures instead of re-drawing paths.
//
//   heroSprite(path, major, pose, frame, facing, dark, size)   one of 6 cultivators, animated
//   drawProp(g, kind, x, y, size, ink, time)                  urns, shrines, torches, banners, bones…
//
// The /games/van-lo/assets page shows them all.

import type { PathId } from "../logic/data";
import type { Deco } from "../logic/types";
import { DARK, type Ink } from "./draw";

export type Pose = "idle" | "walk" | "attack" | "hurt";
export const FRAMES: Record<Pose, number> = { idle: 2, walk: 4, attack: 3, hurt: 1 };

// ---- The cache ----
const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 600;
function cached(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  draw(c.getContext("2d")!);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, c);
  return c;
}

// A white silhouette of any sprite: drawn over it for a moment when it's hit
export function flashOf(sprite: HTMLCanvasElement, key: string) {
  return cached(`flash:${key}`, sprite.width, sprite.height, (g) => {
    g.drawImage(sprite, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, sprite.width, sprite.height);
  });
}

// ---- Heroes ----
type Look = { robe: string; trim: string; skin: string; hair: string; light: string };
const LOOKS: Record<PathId, { light: Look; dark: Look }> = {
  kiem: {
    light: { robe: "#eef1f2", trim: "#4f8a9a", skin: "#f1d6bd", hair: "#1d1a16", light: "#9fd3e6" },
    dark: { robe: "#dfe6e8", trim: "#6fb3c4", skin: "#f1d6bd", hair: "#2a2622", light: "#9fd3e6" },
  },
  vo: {
    light: { robe: "#7a4a2a", trim: "#a8231b", skin: "#d9a77a", hair: "#1d1a16", light: "#ffb36b" },
    dark: { robe: "#a8683e", trim: "#e0645a", skin: "#d9a77a", hair: "#2a2622", light: "#ffb36b" },
  },
  nho: {
    light: { robe: "#2f5a45", trim: "#e9e1cf", skin: "#f1d6bd", hair: "#1d1a16", light: "#c9f0d6" },
    dark: { robe: "#4c8a6c", trim: "#f3ecdc", skin: "#f1d6bd", hair: "#2a2622", light: "#c9f0d6" },
  },
  dao: {
    light: { robe: "#4a3a72", trim: "#d8b25e", skin: "#f1d6bd", hair: "#1d1a16", light: "#d7c6ff" },
    dark: { robe: "#6e5aa8", trim: "#e8c77a", skin: "#f1d6bd", hair: "#2a2622", light: "#d7c6ff" },
  },
  phat: {
    light: { robe: "#c8741f", trim: "#8a2a14", skin: "#e2b48a", hair: "#e2b48a", light: "#ffe08a" },
    dark: { robe: "#e08f35", trim: "#c4552f", skin: "#e2b48a", hair: "#e2b48a", light: "#ffe08a" },
  },
  binh: {
    light: { robe: "#7a2a22", trim: "#8f979e", skin: "#e6c3a2", hair: "#1d1a16", light: "#ff9a8a" },
    dark: { robe: "#a8443a", trim: "#b8c0c6", skin: "#e6c3a2", hair: "#2a2622", light: "#ff9a8a" },
  },
};

const OUTLINE = "rgba(20,16,12,0.85)";

// Leg swing for the 4 walking frames, and the weapon arm's angle for the 3 attack frames
const WALK = [0, 1, 0, -1];
const SWING = [-1.7, -0.3, 0.9];

export function heroSprite(path: PathId, major: number, pose: Pose, frame: number, facing: 1 | -1, dark: boolean, size: number): HTMLCanvasElement {
  const s = Math.round(size);
  const f = frame % FRAMES[pose];
  return cached(`hero:${path}:${major}:${pose}:${f}:${facing}:${dark}:${s}`, s * 2, s * 2, (g) => {
    g.translate(s, s * 1.08);
    g.scale(facing, 1);
    drawHero(g, path, major, pose, f, dark, s);
  });
}

function drawHero(g: CanvasRenderingContext2D, path: PathId, major: number, pose: Pose, f: number, dark: boolean, s: number) {
  const L = LOOKS[path][dark ? "dark" : "light"];
  const step = pose === "walk" ? WALK[f] : 0;
  const breathe = pose === "idle" ? f * 0.012 : 0;
  const lean = pose === "attack" ? 0.06 * (f - 0.5) : pose === "hurt" ? -0.12 : 0;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.lineWidth = Math.max(1, s * 0.03);
  g.strokeStyle = OUTLINE;

  // Realm aura (behind): a ring at Trúc Cơ, a golden core at Kết Đan, a little spirit at Nguyên Anh
  if (major >= 1) {
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = L.light;
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.ellipse(0, s * 0.36, s * (0.32 + major * 0.03), s * 0.09, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  // shadow
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.beginPath();
  g.ellipse(0, s * 0.38, s * 0.24, s * 0.06, 0, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.rotate(lean);
  g.translate(0, -breathe * s);
  const armour = path === "binh";
  const bare = path === "vo";

  // Binh gia's cape, behind everything
  if (armour) {
    g.fillStyle = dark ? "#c25a4a" : "#9a2f22";
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.1);
    g.quadraticCurveTo(-s * 0.3 - step * s * 0.03, s * 0.15, -s * 0.22, s * 0.34);
    g.lineTo(s * 0.04, s * 0.3);
    g.closePath();
    g.fill();
  }

  // legs
  g.strokeStyle = bare ? "#3a2618" : dark ? "#2a2622" : "#2b2722";
  g.lineWidth = s * 0.07;
  for (const side of [-1, 1]) {
    const swing = step * side * 0.32;
    g.beginPath();
    g.moveTo(side * s * 0.06, s * 0.16);
    g.lineTo(side * s * 0.06 + Math.sin(swing) * s * 0.2, s * 0.16 + Math.cos(swing) * s * 0.2);
    g.stroke();
  }

  // back arm (no weapon)
  const shoulder = { x: -s * 0.12, y: -s * 0.07 };
  g.strokeStyle = bare ? L.skin : L.robe;
  g.lineWidth = s * (bare ? 0.07 : 0.085);
  g.beginPath();
  g.moveTo(shoulder.x, shoulder.y);
  g.lineTo(shoulder.x - s * 0.04 - step * s * 0.04, shoulder.y + s * 0.2);
  g.stroke();

  // body: robe, vest or armour
  g.fillStyle = L.robe;
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(1, s * 0.025);
  g.beginPath();
  if (bare) {
    // a short vest over a bare chest, wide trousers
    g.fillStyle = L.skin;
    g.moveTo(-s * 0.13, -s * 0.12);
    g.lineTo(s * 0.13, -s * 0.12);
    g.lineTo(s * 0.11, s * 0.08);
    g.lineTo(-s * 0.11, s * 0.08);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = L.robe;
    g.beginPath();
    g.moveTo(-s * 0.13, -s * 0.12);
    g.lineTo(-s * 0.04, -s * 0.12);
    g.lineTo(-s * 0.07, s * 0.08);
    g.lineTo(-s * 0.12, s * 0.08);
    g.closePath();
    g.moveTo(s * 0.13, -s * 0.12);
    g.lineTo(s * 0.04, -s * 0.12);
    g.lineTo(s * 0.07, s * 0.08);
    g.lineTo(s * 0.12, s * 0.08);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#3a2618";
    g.beginPath();
    g.moveTo(-s * 0.12, s * 0.06);
    g.lineTo(s * 0.12, s * 0.06);
    g.lineTo(s * 0.15, s * 0.22);
    g.lineTo(-s * 0.15, s * 0.22);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    const hem = path === "nho" || path === "dao" ? 0.25 : path === "phat" ? 0.23 : 0.21;
    g.moveTo(-s * 0.12, -s * 0.13);
    g.lineTo(s * 0.12, -s * 0.13);
    g.quadraticCurveTo(s * 0.2, s * 0.1, s * hem + step * s * 0.015, s * 0.3);
    g.lineTo(-s * hem + step * s * 0.015, s * 0.3);
    g.quadraticCurveTo(-s * 0.2, s * 0.1, -s * 0.12, -s * 0.13);
    g.closePath();
    g.fill();
    g.stroke();
    // trim: the front edge of the robe, and a belt
    g.strokeStyle = L.trim;
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(-s * 0.03, -s * 0.13);
    g.lineTo(s * 0.04, s * 0.3);
    g.stroke();
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.moveTo(-s * 0.14, s * 0.05);
    g.lineTo(s * 0.14, s * 0.05);
    g.stroke();
    if (path === "phat") {
      // the kasaya over one shoulder
      g.strokeStyle = L.trim;
      g.lineWidth = s * 0.06;
      g.beginPath();
      g.moveTo(s * 0.12, -s * 0.13);
      g.lineTo(-s * 0.14, s * 0.2);
      g.stroke();
    }
    if (armour) {
      // lamellar plates and shoulder guards
      g.fillStyle = L.trim;
      for (let r = 0; r < 3; r++)
        for (let c = -1; c <= 1; c++) {
          g.fillRect(c * s * 0.07 - s * 0.03, -s * 0.1 + r * s * 0.055, s * 0.06, s * 0.045);
        }
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(side * s * 0.14, -s * 0.11, s * 0.07, s * 0.045, side * 0.3, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    if (path === "dao") {
      // a small taiji on the chest
      g.fillStyle = "#f3ecdc";
      g.beginPath();
      g.arc(0, -s * 0.03, s * 0.04, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#1d1a16";
      g.beginPath();
      g.arc(0, -s * 0.03, s * 0.04, -Math.PI / 2, Math.PI / 2);
      g.fill();
    }
  }

  // head
  const head = { x: 0, y: -s * 0.25 };
  g.fillStyle = L.skin;
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(1, s * 0.025);
  g.beginPath();
  g.arc(head.x, head.y, s * 0.095, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // eye (facing right) and a calm mouth line
  g.fillStyle = "#1d1a16";
  g.beginPath();
  g.arc(head.x + s * 0.04, head.y - s * 0.005, s * 0.014, 0, Math.PI * 2);
  g.fill();

  // hair and headwear
  g.fillStyle = L.hair;
  switch (path) {
    case "kiem": {
      g.beginPath();
      g.arc(head.x, head.y - s * 0.02, s * 0.1, Math.PI * 0.95, Math.PI * 2.05);
      g.fill();
      g.beginPath();
      g.arc(head.x - s * 0.02, head.y - s * 0.12, s * 0.045, 0, Math.PI * 2);
      g.fill();
      // long hair and a flowing ribbon
      g.beginPath();
      g.moveTo(head.x - s * 0.08, head.y);
      g.quadraticCurveTo(head.x - s * 0.14 - step * s * 0.02, head.y + s * 0.12, head.x - s * 0.1, head.y + s * 0.2);
      g.lineTo(head.x - s * 0.05, head.y + s * 0.04);
      g.fill();
      g.strokeStyle = L.trim;
      g.lineWidth = s * 0.025;
      g.beginPath();
      g.moveTo(head.x - s * 0.04, head.y - s * 0.12);
      g.quadraticCurveTo(head.x - s * 0.18, head.y - s * 0.1 + step * s * 0.03, head.x - s * 0.22, head.y + s * 0.02);
      g.stroke();
      break;
    }
    case "vo": {
      g.beginPath();
      g.arc(head.x, head.y - s * 0.02, s * 0.1, Math.PI, Math.PI * 2);
      g.fill();
      g.strokeStyle = L.trim;
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(head.x - s * 0.1, head.y - s * 0.04);
      g.lineTo(head.x + s * 0.1, head.y - s * 0.04);
      g.moveTo(head.x - s * 0.1, head.y - s * 0.04);
      g.lineTo(head.x - s * 0.2, head.y + s * 0.02 + step * s * 0.03);
      g.stroke();
      break;
    }
    case "nho": {
      g.beginPath();
      g.arc(head.x, head.y - s * 0.02, s * 0.1, Math.PI, Math.PI * 2);
      g.fill();
      // a square scholar's cap with two wings
      g.fillStyle = "#1d1a16";
      g.fillRect(head.x - s * 0.08, head.y - s * 0.17, s * 0.16, s * 0.07);
      g.fillRect(head.x - s * 0.17, head.y - s * 0.12, s * 0.34, s * 0.02);
      break;
    }
    case "dao": {
      g.beginPath();
      g.arc(head.x, head.y - s * 0.02, s * 0.1, Math.PI, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(head.x, head.y - s * 0.12, s * 0.04, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = L.trim; // a lotus crown pin
      g.beginPath();
      g.moveTo(head.x - s * 0.05, head.y - s * 0.12);
      g.lineTo(head.x, head.y - s * 0.2);
      g.lineTo(head.x + s * 0.05, head.y - s * 0.12);
      g.fill();
      // a long beard
      g.fillStyle = dark ? "#cfc6b2" : "#6b655a";
      g.beginPath();
      g.moveTo(head.x + s * 0.02, head.y + s * 0.06);
      g.lineTo(head.x + s * 0.06, head.y + s * 0.2);
      g.lineTo(head.x + s * 0.08, head.y + s * 0.05);
      g.fill();
      break;
    }
    case "phat": {
      // shaved head with a soft shine, and a faint halo
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath();
      g.arc(head.x - s * 0.03, head.y - s * 0.05, s * 0.03, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,214,120,0.6)";
      g.lineWidth = s * 0.02;
      g.beginPath();
      g.arc(head.x, head.y - s * 0.02, s * 0.15, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      break;
    }
    case "binh": {
      // a round helmet with a red plume
      g.fillStyle = L.trim;
      g.beginPath();
      g.arc(head.x, head.y - s * 0.02, s * 0.11, Math.PI, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillRect(head.x - s * 0.12, head.y - s * 0.03, s * 0.24, s * 0.025);
      g.fillStyle = "#c42a1f";
      g.beginPath();
      g.moveTo(head.x, head.y - s * 0.13);
      g.quadraticCurveTo(head.x - s * 0.1 - step * s * 0.02, head.y - s * 0.24, head.x - s * 0.16, head.y - s * 0.12);
      g.quadraticCurveTo(head.x - s * 0.06, head.y - s * 0.16, head.x, head.y - s * 0.13);
      g.fill();
      break;
    }
  }

  // front arm with the weapon
  const swing = pose === "attack" ? SWING[f] : pose === "walk" ? step * 0.25 : 0.15;
  const hand = { x: s * 0.12 + Math.sin(swing + 0.3) * s * 0.18, y: -s * 0.06 + Math.cos(swing + 0.3) * s * 0.18 };
  g.strokeStyle = bare ? L.skin : L.robe;
  g.lineWidth = s * (bare ? 0.075 : 0.09);
  g.beginPath();
  g.moveTo(s * 0.12, -s * 0.07);
  g.lineTo(hand.x, hand.y);
  g.stroke();
  drawWeapon(g, path, hand, swing, pose === "attack", L, s);
  g.restore();

  // Golden core at Kết Đan; a little spirit (nguyên anh) floating at the shoulder at Nguyên Anh
  if (major >= 2) {
    const glow = g.createRadialGradient(0, s * 0.02, 0, 0, s * 0.02, s * 0.12);
    glow.addColorStop(0, "rgba(255,226,130,0.9)");
    glow.addColorStop(1, "rgba(255,226,130,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, s * 0.02, s * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  if (major >= 3) {
    g.save();
    g.globalAlpha = 0.75;
    g.translate(-s * 0.26, -s * 0.36 + (pose === "idle" ? f * s * 0.02 : 0));
    g.fillStyle = L.light;
    g.beginPath();
    g.arc(0, -s * 0.05, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.04, s * 0.06);
    g.lineTo(0, -s * 0.02);
    g.lineTo(s * 0.04, s * 0.06);
    g.fill();
    g.restore();
  }
}

function drawWeapon(g: CanvasRenderingContext2D, path: PathId, hand: { x: number; y: number }, angle: number, striking: boolean, L: Look, s: number) {
  g.save();
  g.translate(hand.x, hand.y);
  g.rotate(-angle + Math.PI);
  g.lineCap = "round";
  switch (path) {
    case "kiem": {
      // a straight sword, glowing while it strikes
      if (striking) {
        g.strokeStyle = L.light;
        g.globalAlpha = 0.5;
        g.lineWidth = s * 0.09;
        g.beginPath();
        g.moveTo(0, s * 0.04);
        g.lineTo(0, s * 0.42);
        g.stroke();
        g.globalAlpha = 1;
      }
      g.strokeStyle = "#dfe8ee";
      g.lineWidth = s * 0.035;
      g.beginPath();
      g.moveTo(0, s * 0.04);
      g.lineTo(0, s * 0.42);
      g.stroke();
      g.strokeStyle = "#b08a2e";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(-s * 0.05, s * 0.04);
      g.lineTo(s * 0.05, s * 0.04);
      g.moveTo(0, s * 0.04);
      g.lineTo(0, -s * 0.03);
      g.stroke();
      break;
    }
    case "vo": {
      g.fillStyle = L.skin;
      g.strokeStyle = L.trim;
      g.lineWidth = s * 0.02;
      g.beginPath();
      g.arc(0, 0, s * 0.055, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (striking) {
        g.strokeStyle = "rgba(255,179,107,0.7)";
        g.lineWidth = s * 0.02;
        for (const r of [0.09, 0.13]) {
          g.beginPath();
          g.arc(0, 0, s * r, 0, Math.PI * 2);
          g.stroke();
        }
      }
      break;
    }
    case "nho": {
      // a brush, dripping ink
      g.strokeStyle = "#8a6a3f";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(0, -s * 0.04);
      g.lineTo(0, s * 0.22);
      g.stroke();
      g.fillStyle = "#1d1a16";
      g.beginPath();
      g.moveTo(-s * 0.025, s * 0.22);
      g.lineTo(0, s * 0.31);
      g.lineTo(s * 0.025, s * 0.22);
      g.fill();
      break;
    }
    case "dao": {
      // a horsetail whisk, and a talisman when striking
      g.strokeStyle = "#8a6a3f";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, s * 0.16);
      g.stroke();
      g.strokeStyle = "#f3ecdc";
      g.lineWidth = s * 0.012;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.moveTo(0, s * 0.16);
        g.quadraticCurveTo(i * s * 0.012, s * 0.24, i * s * 0.03, s * 0.33);
        g.stroke();
      }
      if (striking) {
        g.fillStyle = "#e8c35a";
        g.fillRect(-s * 0.04, -s * 0.18, s * 0.08, s * 0.13);
        g.fillStyle = "#a8231b";
        g.fillRect(-s * 0.015, -s * 0.16, s * 0.03, s * 0.09);
      }
      break;
    }
    case "phat": {
      // a monk's staff with rings on top
      g.strokeStyle = "#7a4a2a";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(0, -s * 0.2);
      g.lineTo(0, s * 0.42);
      g.stroke();
      g.strokeStyle = "#d8b25e";
      g.lineWidth = s * 0.02;
      g.beginPath();
      g.arc(0, s * 0.45, s * 0.05, 0, Math.PI * 2);
      g.stroke();
      for (const k of [-1, 1]) {
        g.beginPath();
        g.arc(k * s * 0.05, s * 0.48, s * 0.02, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case "binh": {
      // a spear with a red tassel
      g.strokeStyle = "#6b4a2a";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(0, -s * 0.22);
      g.lineTo(0, s * 0.42);
      g.stroke();
      g.fillStyle = "#c9d1d6";
      g.beginPath();
      g.moveTo(-s * 0.035, s * 0.42);
      g.lineTo(0, s * 0.54);
      g.lineTo(s * 0.035, s * 0.42);
      g.fill();
      g.fillStyle = "#c42a1f";
      g.beginPath();
      g.arc(0, s * 0.4, s * 0.03, 0, Math.PI * 2);
      g.fill();
      break;
    }
  }
  g.restore();
}

// ---- Props: things that make each floor feel lived in ----
export const DECOS: Deco[] = [
  "torch",
  "lantern",
  "bones",
  "banner",
  "statue",
  "bush",
  "crystal",
  "rock",
  "mushroom",
  "flowers",
  "coral",
  "spear",
  "skull",
  "campfire",
];

export function drawProp(
  g: CanvasRenderingContext2D,
  kind: Deco | "urn" | "crate" | "shrine" | "shrine-used" | "merchant",
  x: number,
  y: number,
  s: number,
  ink: Ink,
  t: number,
) {
  const dark = ink === DARK;
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  g.lineJoin = "round";
  const shadow = (w = 0.22) => {
    g.fillStyle = "rgba(0,0,0,0.15)";
    g.beginPath();
    g.ellipse(0, s * 0.34, s * w, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  };
  switch (kind) {
    case "torch":
    case "campfire": {
      const camp = kind === "campfire";
      shadow(camp ? 0.26 : 0.1);
      g.strokeStyle = "#5a3a22";
      g.lineWidth = s * 0.06;
      if (camp) {
        g.beginPath();
        g.moveTo(-s * 0.2, s * 0.3);
        g.lineTo(s * 0.18, s * 0.18);
        g.moveTo(s * 0.2, s * 0.3);
        g.lineTo(-s * 0.18, s * 0.18);
        g.stroke();
      } else {
        g.beginPath();
        g.moveTo(0, s * 0.34);
        g.lineTo(0, -s * 0.05);
        g.stroke();
      }
      const fy = camp ? s * 0.12 : -s * 0.1;
      const flick = Math.sin(t * 13 + x) * 0.15 + Math.sin(t * 7.3 + y) * 0.1;
      for (const [col, k] of [
        ["rgba(214,92,36,0.95)", 1],
        ["rgba(255,196,80,0.95)", 0.6],
        ["rgba(255,250,210,0.9)", 0.3],
      ] as const) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(-s * 0.08 * k * (camp ? 1.6 : 1), fy);
        g.quadraticCurveTo(0, fy - s * (0.3 + flick) * k * (camp ? 1.3 : 1), s * 0.08 * k * (camp ? 1.6 : 1), fy);
        g.quadraticCurveTo(0, fy + s * 0.05, -s * 0.08 * k * (camp ? 1.6 : 1), fy);
        g.fill();
      }
      break;
    }
    case "lantern": {
      g.strokeStyle = dark ? "#cfc6b2" : "#3a3129";
      g.lineWidth = s * 0.02;
      g.beginPath();
      g.moveTo(0, -s * 0.4);
      g.lineTo(0, -s * 0.2);
      g.stroke();
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.35);
      glow.addColorStop(0, "rgba(255,170,90,0.45)");
      glow.addColorStop(1, "rgba(255,170,90,0)");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, s * 0.35, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#c42a1f";
      g.beginPath();
      g.ellipse(0, 0, s * 0.13, s * 0.17, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e8c35a";
      g.fillRect(-s * 0.08, -s * 0.2, s * 0.16, s * 0.04);
      g.fillRect(-s * 0.08, s * 0.16, s * 0.16, s * 0.04);
      break;
    }
    case "bones":
    case "skull": {
      g.fillStyle = dark ? "#e9e1cf" : "#d8d0c0";
      g.strokeStyle = "rgba(40,32,20,0.6)";
      g.lineWidth = 1;
      if (kind === "skull") {
        g.beginPath();
        g.arc(0, s * 0.12, s * 0.12, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = "#2b2722";
        for (const k of [-1, 1]) {
          g.beginPath();
          g.arc(k * s * 0.045, s * 0.11, s * 0.03, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        for (const [a, ox] of [
          [0.4, -0.06],
          [-0.5, 0.08],
        ]) {
          g.save();
          g.translate(ox * s, s * 0.22);
          g.rotate(a);
          g.fillRect(-s * 0.15, -s * 0.02, s * 0.3, s * 0.04);
          for (const k of [-1, 1]) {
            g.beginPath();
            g.arc(k * s * 0.15, -s * 0.02, s * 0.03, 0, Math.PI * 2);
            g.arc(k * s * 0.15, s * 0.02, s * 0.03, 0, Math.PI * 2);
            g.fill();
          }
          g.restore();
        }
      }
      break;
    }
    case "banner": {
      shadow(0.08);
      g.strokeStyle = "#5a3a22";
      g.lineWidth = s * 0.04;
      g.beginPath();
      g.moveTo(-s * 0.12, s * 0.34);
      g.lineTo(-s * 0.12, -s * 0.42);
      g.stroke();
      const wave = Math.sin(t * 2 + x) * s * 0.03;
      g.fillStyle = "#a8231b";
      g.beginPath();
      g.moveTo(-s * 0.12, -s * 0.38);
      g.lineTo(s * 0.18, -s * 0.36 + wave);
      g.lineTo(s * 0.16, s * 0.02 + wave);
      g.lineTo(-s * 0.12, -s * 0.02);
      g.closePath();
      g.fill();
      g.fillStyle = "#e8c35a";
      g.beginPath();
      g.arc(s * 0.02, -s * 0.19 + wave / 2, s * 0.05, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "statue": {
      shadow(0.2);
      g.fillStyle = dark ? "#8a8578" : "#a8a395";
      g.strokeStyle = "rgba(40,32,20,0.5)";
      g.lineWidth = 1;
      g.fillRect(-s * 0.18, s * 0.14, s * 0.36, s * 0.18);
      g.beginPath();
      g.moveTo(-s * 0.13, s * 0.14);
      g.quadraticCurveTo(-s * 0.16, -s * 0.12, 0, -s * 0.2);
      g.quadraticCurveTo(s * 0.16, -s * 0.12, s * 0.13, s * 0.14);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(0, -s * 0.28, s * 0.09, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    }
    case "bush":
    case "flowers": {
      g.fillStyle = dark ? "#4f7a52" : "#3f6f4a";
      for (const [dx, dy, r] of [
        [-0.12, 0.2, 0.13],
        [0.1, 0.2, 0.12],
        [0, 0.1, 0.14],
      ]) {
        g.beginPath();
        g.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
        g.fill();
      }
      if (kind === "flowers") {
        for (const [dx, dy, c] of [
          [-0.1, 0.08, "#e0645a"],
          [0.08, 0.06, "#f0c040"],
          [0, 0.2, "#e88ab8"],
        ] as const) {
          g.fillStyle = c;
          g.beginPath();
          g.arc(dx * s, dy * s, s * 0.035, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case "crystal": {
      const glow = 0.6 + Math.sin(t * 2 + x) * 0.2;
      g.fillStyle = `rgba(150,210,235,${glow})`;
      g.strokeStyle = "rgba(47,111,154,0.9)";
      g.lineWidth = 1.2;
      for (const [dx, h, w] of [
        [-0.1, 0.32, 0.07],
        [0.04, 0.44, 0.08],
        [0.14, 0.26, 0.06],
      ]) {
        g.beginPath();
        g.moveTo(dx * s - w * s, s * 0.32);
        g.lineTo(dx * s, s * 0.32 - h * s);
        g.lineTo(dx * s + w * s, s * 0.32);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    }
    case "rock": {
      g.fillStyle = dark ? "#6b665a" : "#8f8a7c";
      g.beginPath();
      g.ellipse(0, s * 0.22, s * 0.2, s * 0.13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.15)";
      g.beginPath();
      g.ellipse(-s * 0.06, s * 0.17, s * 0.08, s * 0.04, -0.3, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "mushroom": {
      for (const [dx, sz, c] of [
        [-0.08, 0.1, "#b8432f"],
        [0.1, 0.07, "#d0662e"],
      ] as const) {
        g.fillStyle = "#efe6d2";
        g.fillRect(dx * s - s * 0.02, s * 0.15, s * 0.04, s * 0.15);
        g.fillStyle = c;
        g.beginPath();
        g.arc(dx * s, s * 0.16, sz * s, Math.PI, 0);
        g.fill();
      }
      break;
    }
    case "coral": {
      g.strokeStyle = "#d0662e";
      g.lineWidth = s * 0.05;
      g.beginPath();
      g.moveTo(0, s * 0.32);
      g.lineTo(0, s * 0.05);
      g.lineTo(-s * 0.1, -s * 0.08);
      g.moveTo(0, s * 0.12);
      g.lineTo(s * 0.12, -s * 0.02);
      g.moveTo(0, s * 0.2);
      g.lineTo(-s * 0.12, s * 0.12);
      g.stroke();
      break;
    }
    case "spear": {
      g.strokeStyle = dark ? "#cfc6b2" : "#5a4a3a";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(-s * 0.2, s * 0.32);
      g.lineTo(s * 0.16, -s * 0.3);
      g.stroke();
      g.fillStyle = "#8f979e";
      g.beginPath();
      g.moveTo(s * 0.12, -s * 0.26);
      g.lineTo(s * 0.22, -s * 0.4);
      g.lineTo(s * 0.18, -s * 0.24);
      g.fill();
      break;
    }
    case "urn":
    case "crate": {
      shadow(0.2);
      if (kind === "urn") {
        g.fillStyle = dark ? "#a8683e" : "#8a5a32";
        g.strokeStyle = "rgba(30,20,10,0.8)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(-s * 0.08, -s * 0.12);
        g.quadraticCurveTo(-s * 0.26, s * 0.1, -s * 0.12, s * 0.32);
        g.lineTo(s * 0.12, s * 0.32);
        g.quadraticCurveTo(s * 0.26, s * 0.1, s * 0.08, -s * 0.12);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = "#e8c35a";
        g.fillRect(-s * 0.17, s * 0.06, s * 0.34, s * 0.03);
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(-s * 0.1, -s * 0.06, s * 0.03, s * 0.25);
      } else {
        g.fillStyle = dark ? "#9a7a52" : "#7a5a32";
        g.strokeStyle = "rgba(30,20,10,0.8)";
        g.lineWidth = 1.2;
        g.fillRect(-s * 0.2, -s * 0.08, s * 0.4, s * 0.4);
        g.strokeRect(-s * 0.2, -s * 0.08, s * 0.4, s * 0.4);
        g.beginPath();
        g.moveTo(-s * 0.2, -s * 0.08);
        g.lineTo(s * 0.2, s * 0.32);
        g.stroke();
      }
      break;
    }
    case "shrine":
    case "shrine-used": {
      shadow(0.26);
      g.fillStyle = dark ? "#8a8578" : "#9a9585";
      g.fillRect(-s * 0.22, s * 0.16, s * 0.44, s * 0.16);
      g.fillStyle = "#7a2a22";
      g.beginPath();
      g.moveTo(-s * 0.3, -s * 0.12);
      g.lineTo(0, -s * 0.32);
      g.lineTo(s * 0.3, -s * 0.12);
      g.closePath();
      g.fill();
      g.fillStyle = dark ? "#b8b2a0" : "#cfc9b8";
      g.fillRect(-s * 0.16, -s * 0.12, s * 0.32, s * 0.28);
      if (kind === "shrine") {
        const glow = g.createRadialGradient(0, s * 0.02, 0, 0, s * 0.02, s * 0.3);
        glow.addColorStop(0, `rgba(255,214,120,${0.7 + Math.sin(t * 3) * 0.2})`);
        glow.addColorStop(1, "rgba(255,214,120,0)");
        g.fillStyle = glow;
        g.beginPath();
        g.arc(0, s * 0.02, s * 0.3, 0, Math.PI * 2);
        g.fill();
        // incense smoke
        g.strokeStyle = "rgba(160,150,140,0.5)";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(0, -s * 0.02);
        for (let i = 1; i < 6; i++) g.lineTo(Math.sin(t * 2 + i) * s * 0.04, -s * 0.02 - i * s * 0.07);
        g.stroke();
      }
      break;
    }
    case "merchant": {
      shadow(0.24);
      const bob = Math.sin(t * 2) * s * 0.01;
      // a wandering cultivator with a big backpack and a straw hat
      g.fillStyle = "#6b5a3a";
      g.fillRect(-s * 0.24, -s * 0.16 + bob, s * 0.16, s * 0.3);
      g.fillStyle = dark ? "#8fa3a6" : "#5d7a7f";
      g.beginPath();
      g.moveTo(-s * 0.1, -s * 0.12 + bob);
      g.lineTo(s * 0.1, -s * 0.12 + bob);
      g.lineTo(s * 0.17, s * 0.32);
      g.lineTo(-s * 0.17, s * 0.32);
      g.closePath();
      g.fill();
      g.fillStyle = "#f1d6bd";
      g.beginPath();
      g.arc(0, -s * 0.2 + bob, s * 0.08, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#d8b25e";
      g.beginPath();
      g.moveTo(-s * 0.2, -s * 0.22 + bob);
      g.lineTo(0, -s * 0.36 + bob);
      g.lineTo(s * 0.2, -s * 0.22 + bob);
      g.closePath();
      g.fill();
      // a coin sign above
      g.fillStyle = "#e8c35a";
      g.beginPath();
      g.arc(s * 0.22, -s * 0.36 + Math.sin(t * 3) * s * 0.03, s * 0.06, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7a5a1e";
      g.fillRect(s * 0.2, -s * 0.38 + Math.sin(t * 3) * s * 0.03, s * 0.04, s * 0.04);
      break;
    }
  }
  g.restore();
}

// Which props give light, and how far (in tiles)
export const LIGHTS: Partial<Record<Deco | "shrine", number>> = { torch: 2.6, campfire: 3.2, lantern: 2.2, crystal: 1.6, shrine: 2 };
