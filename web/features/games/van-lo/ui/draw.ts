// Drawing Vân Lộ in an ink-wash (thủy mặc) style, all with canvas paths: no image files.
// The map is painted once into an offscreen canvas (paper, rocks, grass) and reused every frame;
// characters and effects are drawn on top each frame.

import { makeRng } from "../engine/rng";
import type { Pos } from "../engine/grid";
import { ALLIES, ENEMIES, PATHS, type PathId } from "../logic/data";
import type { Ally, Enemy, Floor, Thing } from "../logic/types";

export type Ink = { paper: string; paperDeep: string; ink: string; inkSoft: string; seal: string; mist: string; text: string; gold: string; jade: string };
export const LIGHT: Ink = {
  paper: "#f3ecdc",
  paperDeep: "#e6dcc5",
  ink: "#1d1a16",
  inkSoft: "rgba(29,26,22,0.55)",
  seal: "#a8231b",
  mist: "rgba(243,236,220,",
  text: "#1d1a16",
  gold: "#b08a2e",
  jade: "#3f7d6a",
};
export const DARK: Ink = {
  paper: "#1b1915",
  paperDeep: "#24211b",
  ink: "#e9e1cf",
  inkSoft: "rgba(233,225,207,0.5)",
  seal: "#e0645a",
  mist: "rgba(27,25,21,",
  text: "#ece6da",
  gold: "#d8b25e",
  jade: "#6fb39c",
};

const hash = (x: number, y: number, z: number) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;

// ---- The floor, painted once ----
export function paintFloor(floor: Floor, tile: number, ink: Ink, dpr: number, tribulation = false, paper = ink.paper): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(floor.w * tile * dpr);
  c.height = Math.ceil(floor.h * tile * dpr);
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  g.fillStyle = tribulation ? (ink === DARK ? "#15141c" : "#d9d4cc") : paper;
  g.fillRect(0, 0, floor.w * tile, floor.h * tile);
  const wall = (x: number, y: number) => x < 0 || y < 0 || x >= floor.w || y >= floor.h || floor.tiles[y * floor.w + x] === "#";
  const rgba = (a: number) => (ink === DARK ? `rgba(233,225,207,${a})` : `rgba(29,26,22,${a})`);

  // Paper grain
  const grain = makeRng(hash(floor.w, floor.h, floor.depth + 7));
  for (let i = 0; i < floor.w * floor.h * 2; i++) {
    g.fillStyle = rgba(grain.next() * 0.05);
    g.fillRect(grain.next() * floor.w * tile, grain.next() * floor.h * tile, 1.2, 1.2);
  }

  for (let y = 0; y < floor.h; y++)
    for (let x = 0; x < floor.w; x++) {
      const rng = makeRng(hash(x, y, floor.depth));
      const px = x * tile;
      const py = y * tile;
      if (wall(x, y)) {
        const edge = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => !wall(x + dx, y + dy)));
        // Rocks next to the paths: layered washes of ink, darker at the bottom like mountains
        const layers = edge ? 4 : 2;
        for (let i = 0; i < layers; i++) {
          g.fillStyle = rgba((edge ? 0.12 : 0.05) + rng.next() * (edge ? 0.12 : 0.05));
          g.beginPath();
          g.ellipse(
            px + tile * (0.2 + rng.next() * 0.6),
            py + tile * (0.35 + rng.next() * 0.5),
            tile * (0.45 + rng.next() * 0.4),
            tile * (0.3 + rng.next() * 0.35),
            rng.next() * 0.6 - 0.3,
            0,
            Math.PI * 2,
          );
          g.fill();
        }
        if (edge && rng.chance(0.45)) {
          // a dry-brush crease
          g.strokeStyle = rgba(0.45);
          g.lineWidth = 1 + rng.next() * 1.4;
          g.lineCap = "round";
          g.beginPath();
          g.moveTo(px + tile * rng.next() * 0.4, py + tile * (0.3 + rng.next() * 0.4));
          g.quadraticCurveTo(px + tile * 0.5, py + tile * rng.next() * 0.3, px + tile * (0.6 + rng.next() * 0.4), py + tile * (0.4 + rng.next() * 0.5));
          g.stroke();
        }
        if (!edge && rng.chance(0.08) && !tribulation) {
          // a tiny pine on the hills
          drawPine(g, px + tile / 2, py + tile * 0.8, tile * 0.5, rgba(0.4));
        }
      } else {
        g.fillStyle = tribulation ? rgba(0.03) : ink === DARK ? "rgba(255,248,235,0.025)" : "rgba(255,252,245,0.5)";
        g.fillRect(px, py, tile, tile);
        if (!tribulation && rng.chance(0.18)) {
          // grass strokes
          g.strokeStyle = rgba(0.22);
          g.lineWidth = 1;
          const gx = px + tile * (0.2 + rng.next() * 0.6);
          const gy = py + tile * (0.5 + rng.next() * 0.4);
          for (let k = -1; k <= 1; k++) {
            g.beginPath();
            g.moveTo(gx, gy);
            g.quadraticCurveTo(gx + k * tile * 0.08, gy - tile * 0.15, gx + k * tile * 0.15, gy - tile * 0.22);
            g.stroke();
          }
        }
      }
    }
  return c;
}

function drawPine(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - s);
  g.stroke();
  g.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const yy = y - s * (0.35 + i * 0.25);
    g.beginPath();
    g.ellipse(x, yy, s * (0.35 - i * 0.08), s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// ---- Characters ----
// Each path looks a little different: robe colour, headwear and what they carry
export function drawPlayer(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  ink: Ink,
  opts: { shield?: boolean; echo?: boolean; path?: PathId } = {},
) {
  const s = t;
  const path = opts.path ?? "kiem";
  const dark = ink === DARK;
  const bob = Math.sin(performance.now() / 500) * s * 0.015;
  g.save();
  g.translate(x, y + bob);
  // shadow
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.beginPath();
  g.ellipse(0, s * 0.38, s * 0.28, s * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  if (opts.shield) {
    g.strokeStyle = "rgba(122,167,199,0.7)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, s * 0.48, 0, Math.PI * 2);
    g.stroke();
  }
  const robes: Record<PathId, [string, string]> = {
    kiem: ["#2b2722", "#d9d1bf"],
    vo: ["#5a3a22", "#c9a27a"],
    nho: ["#2f4a3a", "#bcd6c3"],
    dao: ["#3a2f55", "#c7b8e6"],
    phat: ["#a8651e", "#e6b366"],
    binh: ["#5a1f1a", "#d98a7f"],
  };
  // robe: a brushy triangle (martial artists wear short trousers instead)
  g.fillStyle = robes[path][dark ? 1 : 0];
  g.beginPath();
  g.moveTo(0, -s * 0.18);
  g.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.24, s * 0.38);
  g.lineTo(-s * 0.24, s * 0.38);
  g.quadraticCurveTo(-s * 0.3, s * 0.1, 0, -s * 0.18);
  g.fill();
  // inner robe
  g.fillStyle = dark ? "#1b1915" : "#f3ecdc";
  g.beginPath();
  g.moveTo(0, -s * 0.12);
  g.lineTo(s * 0.06, s * 0.38);
  g.lineTo(-s * 0.06, s * 0.38);
  g.fill();
  // sash in the path's colour
  g.strokeStyle = path === "kiem" ? ink.seal : PATHS[path].color;
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.moveTo(-s * 0.16, s * 0.1);
  g.lineTo(s * 0.16, s * 0.08);
  g.stroke();
  // head
  const skin = dark ? "#e9e1cf" : "#1d1a16";
  g.fillStyle = skin;
  g.beginPath();
  g.arc(0, -s * 0.26, s * 0.1, 0, Math.PI * 2);
  g.fill();
  g.lineCap = "round";
  switch (path) {
    case "kiem": // hair bun and a sword on the back
      g.beginPath();
      g.arc(0, -s * 0.37, s * 0.05, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = opts.echo ? "#9fd3e6" : "#4f8a9a";
      g.lineWidth = s * 0.035;
      g.beginPath();
      g.moveTo(-s * 0.22, s * 0.22);
      g.lineTo(s * 0.26, -s * 0.36);
      g.stroke();
      break;
    case "vo": // red headband, bare fists
      g.strokeStyle = ink.seal;
      g.lineWidth = s * 0.035;
      g.beginPath();
      g.moveTo(-s * 0.1, -s * 0.29);
      g.lineTo(s * 0.1, -s * 0.29);
      g.lineTo(s * 0.2, -s * 0.24);
      g.stroke();
      g.fillStyle = skin;
      for (const k of [-1, 1]) {
        g.beginPath();
        g.arc(k * s * 0.27, s * 0.05, s * 0.055, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "nho": // scholar's cap and a brush
      g.fillRect(-s * 0.09, -s * 0.42, s * 0.18, s * 0.08);
      g.strokeStyle = "#8a6a3f";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(s * 0.2, s * 0.15);
      g.lineTo(s * 0.32, -s * 0.12);
      g.stroke();
      g.fillStyle = skin;
      g.beginPath();
      g.arc(s * 0.33, -s * 0.15, s * 0.03, 0, Math.PI * 2);
      g.fill();
      break;
    case "dao": // lotus crown and a horsetail whisk
      g.fillStyle = ink.gold;
      g.beginPath();
      g.moveTo(-s * 0.06, -s * 0.34);
      g.lineTo(0, -s * 0.44);
      g.lineTo(s * 0.06, -s * 0.34);
      g.fill();
      g.strokeStyle = dark ? "#e9e1cf" : "#6b5a7a";
      g.lineWidth = s * 0.02;
      g.beginPath();
      g.moveTo(-s * 0.2, s * 0.12);
      g.lineTo(-s * 0.28, -s * 0.08);
      for (let i = -2; i <= 2; i++) {
        g.moveTo(-s * 0.28, -s * 0.08);
        g.lineTo(-s * 0.36 + i * s * 0.02, s * 0.06);
      }
      g.stroke();
      break;
    case "phat": // shaved head and prayer beads
      g.fillStyle = dark ? "#f0e6cf" : "#c48a52";
      g.beginPath();
      g.arc(0, -s * 0.26, s * 0.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#7a3f1e";
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.15 + (i / 6) * 0.7);
        g.beginPath();
        g.arc(Math.cos(a) * s * 0.12, -s * 0.12 + Math.sin(a) * s * 0.08, s * 0.025, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "binh": // helmet with a plume and a spear
      g.beginPath();
      g.arc(0, -s * 0.28, s * 0.12, Math.PI, 0);
      g.fill();
      g.fillStyle = ink.seal;
      g.beginPath();
      g.ellipse(0, -s * 0.42, s * 0.04, s * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = dark ? "#cfc6b2" : "#3a3129";
      g.lineWidth = s * 0.03;
      g.beginPath();
      g.moveTo(s * 0.26, s * 0.36);
      g.lineTo(s * 0.26, -s * 0.42);
      g.stroke();
      g.fillStyle = "#9aa4ad";
      g.beginPath();
      g.moveTo(s * 0.26, -s * 0.5);
      g.lineTo(s * 0.22, -s * 0.4);
      g.lineTo(s * 0.3, -s * 0.4);
      g.fill();
      break;
  }
  g.restore();
}

// A summoned soldier or archer: small, in the strategist's red, with a life bar
export function drawAlly(g: CanvasRenderingContext2D, a: Ally, x: number, y: number, s: number, ink: Ink) {
  const dark = ink === DARK;
  g.save();
  g.translate(x, y + s * 0.04);
  g.globalAlpha = 0.92;
  g.fillStyle = dark ? "#d98a7f" : "#7a2a22";
  g.beginPath();
  g.moveTo(0, -s * 0.12);
  g.lineTo(s * 0.2, s * 0.32);
  g.lineTo(-s * 0.2, s * 0.32);
  g.fill();
  g.fillStyle = dark ? "#e9e1cf" : "#1d1a16";
  g.beginPath();
  g.arc(0, -s * 0.2, s * 0.085, Math.PI, 0);
  g.arc(0, -s * 0.18, s * 0.075, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = dark ? "#cfc6b2" : "#3a3129";
  g.lineWidth = s * 0.03;
  g.lineCap = "round";
  g.beginPath();
  if (ALLIES[a.kind].range > 1) {
    g.arc(s * 0.22, 0, s * 0.18, -Math.PI / 2.4, Math.PI / 2.4); // a bow
  } else {
    g.moveTo(s * 0.22, s * 0.3);
    g.lineTo(s * 0.22, -s * 0.34); // a spear
  }
  g.stroke();
  g.restore();
  const w = s * 0.6;
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(x - w / 2, y + s * 0.42, w, 3);
  g.fillStyle = "#3f7d4b";
  g.fillRect(x - w / 2, y + s * 0.42, (w * Math.max(0, a.hp)) / a.maxHp, 3);
}

export function drawEnemy(g: CanvasRenderingContext2D, e: Enemy, x: number, y: number, s: number, ink: Ink) {
  const dark = ink === DARK;
  const info = ENEMIES[e.kind];
  const body = info.tint ? (dark ? lighten(info.tint) : info.tint) : dark ? "#cfc6b2" : "#2b2722";
  const t = performance.now() / 1000;
  g.save();
  g.translate(x, y);
  g.fillStyle = "rgba(0,0,0,0.1)";
  g.beginPath();
  g.ellipse(0, s * 0.36, s * 0.3, s * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  const kind = info.shape;
  if (info.boss && kind !== "mang") g.scale(1.45, 1.45); // bosses are big
  g.fillStyle = body;
  g.strokeStyle = body;
  g.lineCap = "round";
  g.lineJoin = "round";
  switch (kind) {
    case "lang": {
      g.beginPath();
      g.ellipse(-s * 0.05, s * 0.12, s * 0.28, s * 0.15, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath(); // head with ears
      g.moveTo(s * 0.18, -s * 0.05);
      g.lineTo(s * 0.22, -s * 0.28);
      g.lineTo(s * 0.3, -s * 0.1);
      g.lineTo(s * 0.4, -s * 0.24);
      g.lineTo(s * 0.42, s * 0.02);
      g.lineTo(s * 0.18, s * 0.1);
      g.fill();
      g.lineWidth = s * 0.06;
      g.beginPath(); // tail
      g.moveTo(-s * 0.3, s * 0.08);
      g.quadraticCurveTo(-s * 0.45, -s * 0.1, -s * 0.38, -s * 0.2);
      g.stroke();
      g.strokeStyle = "#8a8a8a"; // iron back
      g.lineWidth = s * 0.05;
      g.beginPath();
      g.moveTo(-s * 0.25, s * 0.0);
      g.lineTo(s * 0.12, -s * 0.02);
      g.stroke();
      eye(g, s * 0.33, -s * 0.06, s, ink.seal);
      break;
    }
    case "xa": {
      g.strokeStyle = body;
      g.lineWidth = s * 0.12;
      g.beginPath();
      const w = Math.sin(t * 3) * s * 0.04;
      g.moveTo(-s * 0.32, s * 0.25);
      g.bezierCurveTo(-s * 0.1, s * 0.05 + w, s * 0.05, s * 0.4 - w, s * 0.22, s * 0.05);
      g.quadraticCurveTo(s * 0.3, -s * 0.12, s * 0.18, -s * 0.22);
      g.stroke();
      g.fillStyle = "#c4562f"; // flame pattern
      for (const [px, py] of [
        [-0.2, 0.18],
        [0.0, 0.2],
        [0.16, 0.12],
      ]) {
        g.beginPath();
        g.arc(px * s, py * s, s * 0.03, 0, Math.PI * 2);
        g.fill();
      }
      eye(g, s * 0.2, -s * 0.22, s, ink.seal);
      break;
    }
    case "hung": {
      g.beginPath();
      g.ellipse(0, s * 0.08, s * 0.36, s * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(-s * 0.2, -s * 0.2, s * 0.08, 0, Math.PI * 2);
      g.arc(s * 0.2, -s * 0.2, s * 0.08, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = dark ? "#8a826f" : "#6b655a"; // stone plates
      g.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.arc(i * s * 0.13, s * 0.1, s * 0.09, Math.PI, 0);
        g.stroke();
      }
      eye(g, -s * 0.1, -s * 0.06, s, ink.seal);
      eye(g, s * 0.1, -s * 0.06, s, ink.seal);
      break;
    }
    case "hon": {
      g.globalAlpha = 0.55 + Math.sin(t * 2) * 0.15;
      g.fillStyle = info.tint ? body : dark ? "#9fc3d9" : "#5d7f99";
      g.beginPath();
      g.moveTo(0, -s * 0.35);
      g.bezierCurveTo(s * 0.32, -s * 0.2, s * 0.25, s * 0.25, s * 0.1 * Math.sin(t * 4), s * 0.38);
      g.bezierCurveTo(-s * 0.1, s * 0.2, -s * 0.32, s * 0.1, 0, -s * 0.35);
      g.fill();
      g.globalAlpha = 1;
      eye(g, -s * 0.07, -s * 0.12, s, "#e8f4ff");
      eye(g, s * 0.07, -s * 0.12, s, "#e8f4ff");
      break;
    }
    case "tu": {
      const demon = e.kind === "tam-ma";
      const robe = body;
      g.fillStyle = robe;
      g.beginPath();
      g.moveTo(0, -s * 0.18);
      g.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.25, s * 0.38);
      g.lineTo(-s * 0.25, s * 0.38);
      g.quadraticCurveTo(-s * 0.3, s * 0.1, 0, -s * 0.18);
      g.fill();
      g.fillStyle = demon ? "#1a0a08" : body;
      g.beginPath();
      g.arc(0, -s * 0.26, s * 0.1, 0, Math.PI * 2);
      g.fill();
      if (demon) {
        g.shadowColor = "#ff3b2f";
        g.shadowBlur = 10;
      }
      eye(g, -s * 0.04, -s * 0.27, s, "#ff4b3a");
      eye(g, s * 0.04, -s * 0.27, s, "#ff4b3a");
      g.shadowBlur = 0;
      g.strokeStyle = demon ? "#ff4b3a" : "#6b5a7a";
      g.lineWidth = s * 0.035;
      g.beginPath();
      g.moveTo(s * 0.22, s * 0.22);
      g.lineTo(-s * 0.26, -s * 0.36);
      g.stroke();
      break;
    }
    case "buc": {
      const flap = Math.sin(t * 10) * s * 0.08;
      g.fillStyle = dark ? "#b9a3a3" : "#3a1f22";
      g.beginPath();
      g.moveTo(0, -s * 0.02);
      g.quadraticCurveTo(-s * 0.2, -s * 0.25 - flap, -s * 0.4, -s * 0.05);
      g.quadraticCurveTo(-s * 0.25, 0, -s * 0.2, s * 0.1);
      g.quadraticCurveTo(-s * 0.1, s * 0.02, 0, s * 0.12);
      g.quadraticCurveTo(s * 0.1, s * 0.02, s * 0.2, s * 0.1);
      g.quadraticCurveTo(s * 0.25, 0, s * 0.4, -s * 0.05);
      g.quadraticCurveTo(s * 0.2, -s * 0.25 - flap, 0, -s * 0.02);
      g.fill();
      eye(g, -s * 0.03, 0, s, "#ff4b3a");
      eye(g, s * 0.03, 0, s, "#ff4b3a");
      break;
    }
    case "mang": {
      const big = s * 1.5;
      g.strokeStyle = dark ? "#c9bfa9" : "#241f1a";
      g.lineWidth = big * 0.13;
      g.beginPath();
      g.arc(0, big * 0.12, big * 0.24, 0.2, Math.PI * 1.9);
      g.stroke();
      g.lineWidth = big * 0.1;
      g.beginPath();
      g.moveTo(big * 0.22, big * 0.0);
      g.quadraticCurveTo(big * 0.32, -big * 0.25, big * 0.12, -big * 0.32);
      g.stroke();
      g.fillStyle = "#b8432f"; // red horns
      g.beginPath();
      g.moveTo(big * 0.08, -big * 0.36);
      g.lineTo(big * 0.02, -big * 0.52);
      g.lineTo(big * 0.14, -big * 0.38);
      g.moveTo(big * 0.16, -big * 0.36);
      g.lineTo(big * 0.22, -big * 0.5);
      g.lineTo(big * 0.2, -big * 0.34);
      g.fill();
      eye(g, big * 0.12, -big * 0.3, big, "#ffcf3a");
      break;
    }
  }
  // status marks
  let mx = -s * 0.3;
  for (const st of e.status) {
    const color = st.kind === "burn" ? "#e0782f" : st.kind === "stun" ? "#e0c03a" : st.kind === "weak" ? "#9b5fc0" : null;
    if (!color) continue;
    g.fillStyle = color;
    g.beginPath();
    g.arc(mx, -s * 0.42, s * 0.06, 0, Math.PI * 2);
    g.fill();
    mx += s * 0.15;
  }
  g.restore();
  // health bar when hurt
  if (e.hp < e.maxHp) {
    const w = s * (ENEMIES[e.kind].boss ? 1.2 : 0.7);
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.fillRect(x - w / 2, y + s * 0.42, w, 3);
    g.fillStyle = ink.seal;
    g.fillRect(x - w / 2, y + s * 0.42, (w * Math.max(0, e.hp)) / e.maxHp, 3);
  }
}

// A lighter version of a colour, for dark mode
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (235 - c) * 0.55);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function eye(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, Math.max(1.2, s * 0.028), 0, Math.PI * 2);
  g.fill();
}

// ---- Things on the floor ----
export function drawThing(g: CanvasRenderingContext2D, th: Thing, x: number, y: number, s: number, ink: Ink) {
  const t = performance.now() / 1000;
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  switch (th.kind) {
    case "herb": {
      g.strokeStyle = ink.jade;
      g.fillStyle = ink.jade;
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, s * 0.3);
      g.lineTo(0, -s * 0.15);
      g.stroke();
      for (const k of [-1, 1]) {
        g.beginPath();
        g.ellipse(k * s * 0.1, s * 0.05, s * 0.12, s * 0.05, k * -0.6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = ink.seal;
      g.beginPath();
      g.arc(0, -s * 0.18, s * 0.06, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "chest": {
      g.fillStyle = "#7a4e2a";
      g.fillRect(-s * 0.26, -s * 0.12, s * 0.52, s * 0.36);
      g.fillStyle = ink.gold;
      g.fillRect(-s * 0.26, -s * 0.02, s * 0.52, s * 0.06);
      g.fillRect(-s * 0.04, -s * 0.06, s * 0.08, s * 0.14);
      break;
    }
    case "stones": {
      g.fillStyle = "#8fc3d6";
      g.strokeStyle = "#3f6f9a";
      g.lineWidth = 1;
      for (const [dx, h] of [
        [-0.12, 0.22],
        [0.06, 0.3],
        [0.18, 0.18],
      ]) {
        g.beginPath();
        g.moveTo(dx * s, s * 0.2);
        g.lineTo(dx * s - s * 0.06, s * 0.2 - h * s * 0.6);
        g.lineTo(dx * s, s * 0.2 - h * s);
        g.lineTo(dx * s + s * 0.06, s * 0.2 - h * s * 0.6);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    }
    case "stairs": {
      g.strokeStyle = ink.ink;
      g.lineWidth = 2;
      g.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const r = s * 0.04 * a;
        g.lineTo(Math.cos(a + t) * r * 0.9, Math.sin(a + t) * r * 0.6);
      }
      g.stroke();
      break;
    }
    case "portal": {
      g.strokeStyle = ink.gold;
      g.shadowColor = ink.gold;
      g.shadowBlur = 8;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, s * 0.34, 0, Math.PI * 2);
      g.stroke();
      // eight trigram dashes
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.4;
        g.beginPath();
        g.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2);
        g.lineTo(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28);
        g.stroke();
      }
      g.shadowBlur = 0;
      break;
    }
    case "hazard": {
      if (th.hazard === "lava") {
        const glow = 0.75 + Math.sin(t * 3 + th.pos.x) * 0.15;
        g.fillStyle = `rgba(214,92,36,${glow})`;
        g.beginPath();
        g.ellipse(0, s * 0.05, s * 0.4, s * 0.28, 0.2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,210,90,0.8)";
        g.beginPath();
        g.ellipse(s * 0.05, s * 0.02, s * 0.16, s * 0.09, 0.2, 0, Math.PI * 2);
        g.fill();
      } else if (th.hazard === "whirlpool") {
        g.strokeStyle = "rgba(47,111,154,0.8)";
        g.lineWidth = 1.6;
        g.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.25) {
          const rr = s * 0.03 * a;
          g.lineTo(Math.cos(a - t * 2) * rr, Math.sin(a - t * 2) * rr * 0.7);
        }
        g.stroke();
      } else {
        g.fillStyle = `rgba(90,63,122,${0.35 + Math.sin(t * 2 + th.pos.y) * 0.1})`;
        for (const [dx, dy, rr] of [
          [-0.15, 0, 0.22],
          [0.15, -0.05, 0.2],
          [0, 0.12, 0.25],
        ]) {
          g.beginPath();
          g.arc(dx * s, dy * s, rr * s, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case "trap": {
      if (th.hidden) break;
      g.strokeStyle = ink.seal;
      g.lineWidth = 1.5;
      g.strokeRect(-s * 0.22, -s * 0.22, s * 0.44, s * 0.44);
      g.beginPath();
      g.moveTo(-s * 0.15, -s * 0.15);
      g.lineTo(s * 0.15, s * 0.15);
      g.moveTo(s * 0.15, -s * 0.15);
      g.lineTo(-s * 0.15, s * 0.15);
      g.stroke();
      break;
    }
  }
  g.restore();
}

// ---- Effects ----
export type Anim =
  | { kind: "number"; at: Pos; text: string; color: string; big?: boolean; start: number }
  | { kind: "slash"; from: Pos; to: Pos; color: string; start: number }
  | { kind: "ring"; at: Pos; r: number; color: string; start: number }
  | { kind: "bolt"; at: Pos; start: number }
  | { kind: "splash"; at: Pos; start: number };
export const ANIM_MS = { number: 900, slash: 260, ring: 450, bolt: 350, splash: 600 };

export function drawAnim(g: CanvasRenderingContext2D, a: Anim, now: number, tile: number, toScreen: (p: Pos) => { x: number; y: number }, ink: Ink): boolean {
  const k = (now - a.start) / ANIM_MS[a.kind];
  if (k < 0) return true;
  if (k > 1) return false;
  g.save();
  if (a.kind === "number") {
    const p = toScreen(a.at);
    g.globalAlpha = 1 - k * k;
    g.font = `800 ${a.big ? tile * 0.5 : tile * 0.38}px var(--font-jakarta), system-ui, sans-serif`;
    g.textAlign = "center";
    g.lineWidth = 3;
    g.strokeStyle = ink === DARK ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
    g.strokeText(a.text, p.x, p.y - tile * 0.3 - k * tile * 0.6);
    g.fillStyle = a.color;
    g.fillText(a.text, p.x, p.y - tile * 0.3 - k * tile * 0.6);
  } else if (a.kind === "slash") {
    const p = toScreen(a.from);
    const q = toScreen(a.to);
    g.globalAlpha = 1 - k;
    g.strokeStyle = a.color;
    g.lineCap = "round";
    g.lineWidth = tile * 0.16 * (1 - k * 0.6);
    g.beginPath();
    g.moveTo(p.x, p.y);
    const mx = (p.x + q.x) / 2 + (q.y - p.y) * 0.15;
    const my = (p.y + q.y) / 2 - (q.x - p.x) * 0.15;
    g.quadraticCurveTo(mx, my, p.x + (q.x - p.x) * Math.min(1, k * 2.5), p.y + (q.y - p.y) * Math.min(1, k * 2.5));
    g.stroke();
  } else if (a.kind === "ring") {
    const p = toScreen(a.at);
    g.globalAlpha = 1 - k;
    g.strokeStyle = a.color;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(p.x, p.y, tile * (0.4 + (a.r + 0.5) * k), 0, Math.PI * 2);
    g.stroke();
  } else if (a.kind === "bolt") {
    const p = toScreen(a.at);
    g.globalAlpha = 1 - k;
    g.strokeStyle = "#fff6c2";
    g.shadowColor = "#ffd84a";
    g.shadowBlur = 16;
    g.lineWidth = 3;
    g.beginPath();
    let x = p.x + tile * 0.2;
    g.moveTo(x, p.y - tile * 3);
    for (let i = 1; i <= 6; i++) {
      x = p.x + (i % 2 ? -1 : 1) * tile * 0.18;
      g.lineTo(x, p.y - tile * 3 + (tile * 3 * i) / 6);
    }
    g.stroke();
    g.fillStyle = "rgba(255,230,120,0.35)";
    g.beginPath();
    g.arc(p.x, p.y, tile * 0.45, 0, Math.PI * 2);
    g.fill();
  } else if (a.kind === "splash") {
    const p = toScreen(a.at);
    g.globalAlpha = 0.6 * (1 - k);
    g.fillStyle = ink.ink;
    const rng = makeRng(hash(a.at.x, a.at.y, Math.round(a.start)));
    for (let i = 0; i < 7; i++) {
      const ang = rng.next() * Math.PI * 2;
      const d = tile * (0.1 + rng.next() * 0.5) * (0.4 + k);
      g.beginPath();
      g.arc(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, tile * (0.05 + rng.next() * 0.1) * (1 - k * 0.5), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  return true;
}
