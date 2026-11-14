"use client";

// Stage 26 · Mầm Thú: draws one area of the island with the Canvas 2D API (no game library needed for a tile map).
// The map itself is painted once per area into a hidden canvas; every frame only adds what moves: you, the
// villagers' little bob, the water shimmer and the shrine's lantern.

import { useEffect, useRef } from "react";
import { MAP_H, MAP_W, tileAt, type Area } from "./island";

export const TILE = 32;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const hash = (x: number, y: number, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function shade(n: number, f: number) {
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export type Pos = { x: number; y: number; dir: 0 | 1 | 2 | 3 }; // dir: 0 down, 1 left, 2 right, 3 up
export type IslandState = { area: Area; gateOpen: boolean; keeperBeaten: boolean; player: { from: Pos; to: Pos; at: number; ms: number } };

/** A person seen from above at an angle: the gardener (look -1) or a villager */
function person(c: CanvasRenderingContext2D, x: number, y: number, look: number, dir: number, bob: number, robe?: string) {
  const shirts = ["#3a7fd0", "#e0453a", "#8a5ce6", "#2fb38a"];
  c.save();
  c.translate(x, y + bob);
  c.fillStyle = "rgba(0,0,0,0.18)";
  c.beginPath();
  c.ellipse(0, 12, 10, 4, 0, 0, Math.PI * 2);
  c.fill();
  // body
  c.fillStyle = robe ?? (look < 0 ? "#3f8f4a" : shirts[look % 4]);
  c.beginPath();
  c.roundRect(-8, -2, 16, 14, 5);
  c.fill();
  // head
  c.fillStyle = "#ffe0c2";
  c.beginPath();
  c.arc(0, -8, 8, 0, Math.PI * 2);
  c.fill();
  if (dir !== 3) {
    c.fillStyle = "#2a1a22";
    const off = dir === 1 ? -3 : dir === 2 ? 3 : 0;
    c.fillRect(-4 + off, -9, 2, 3);
    c.fillRect(2 + off, -9, 2, 3);
  }
  if (look < 0) {
    // the gardener's conical hat (nón lá)
    c.fillStyle = "#f3dfa2";
    c.beginPath();
    c.moveTo(-14, -11);
    c.lineTo(0, -24);
    c.lineTo(14, -11);
    c.closePath();
    c.fill();
    c.strokeStyle = "#c9a85c";
    c.lineWidth = 1;
    c.stroke();
  } else if (look === 2) {
    c.fillStyle = "#e6e6e6"; // white hair
    c.beginPath();
    c.arc(0, -13, 6, Math.PI, 0);
    c.fill();
  } else {
    c.fillStyle = "#2a1a22";
    c.beginPath();
    c.arc(0, -11, 8, Math.PI, 0);
    c.fill();
  }
  c.restore();
}

function paintMap(area: Area, gateOpen: boolean): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = MAP_W * TILE;
  cv.height = MAP_H * TILE;
  const c = cv.getContext("2d")!;
  const T = area.theme;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = tileAt(area, x, y);
      const px = x * TILE;
      const py = y * TILE;
      c.fillStyle = shade(T.ground, 0.96 + hash(x, y) * 0.08);
      c.fillRect(px, py, TILE, TILE);
      if (t === "=" || t === "<" || t === "G" || t === "K") {
        c.fillStyle = "#e9d6a8";
        c.fillRect(px, py + 4, TILE, TILE - 8);
        c.fillStyle = "rgba(160,120,70,0.25)";
        for (let i = 0; i < 3; i++) c.fillRect(px + hash(x, y, i) * 26, py + 8 + hash(x, y, i + 9) * 16, 4, 3);
      }
      if (t === "~") {
        c.fillStyle = hex(T.water);
        c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = "rgba(255,255,255,0.35)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(px + 6, py + 12 + hash(x, y) * 8);
        c.quadraticCurveTo(px + 12, py + 8 + hash(x, y) * 8, px + 18, py + 12 + hash(x, y) * 8);
        c.stroke();
      }
      if (t === ",") {
        // tall grass: where wild sproutlings hide
        c.fillStyle = shade(T.grass, 0.85);
        c.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        c.strokeStyle = shade(T.grass, 0.6);
        c.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const gx = px + 4 + i * 6;
          c.beginPath();
          c.moveTo(gx, py + TILE - 4);
          c.lineTo(gx + (hash(x, y, i) - 0.5) * 6, py + 6 + hash(x, y, i + 3) * 8);
          c.stroke();
        }
      }
      if (t === "f") {
        for (let i = 0; i < 4; i++) {
          c.fillStyle = ["#ff8fb0", "#fff4c2", "#ffd84a", "#c3a6ff"][i];
          c.beginPath();
          c.arc(px + 6 + hash(x, y, i) * 20, py + 6 + hash(x, y, i + 5) * 20, 3, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  // things that stand up (drawn after the ground so they can overlap a little)
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = tileAt(area, x, y);
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      if (t === "#") {
        const bamboo = area.id === "bamboo";
        c.fillStyle = "rgba(0,0,0,0.15)";
        c.beginPath();
        c.ellipse(cx, cy + 12, 13, 5, 0, 0, Math.PI * 2);
        c.fill();
        if (bamboo) {
          for (let i = -1; i <= 1; i++) {
            c.fillStyle = shade(T.tree, 1 + i * 0.12);
            c.fillRect(cx + i * 8 - 2, cy - 14, 5, 28);
            c.fillStyle = shade(T.tree, 0.7);
            c.fillRect(cx + i * 8 - 2, cy - 4 + i * 4, 5, 2);
          }
          c.fillStyle = shade(T.grass, 1.1);
          c.beginPath();
          c.ellipse(cx + 6, cy - 14, 8, 3, -0.5, 0, Math.PI * 2);
          c.fill();
        } else {
          c.fillStyle = "#7a5528";
          c.fillRect(cx - 3, cy + 2, 6, 10);
          c.fillStyle = shade(T.tree, 0.9 + hash(x, y) * 0.2);
          c.beginPath();
          c.arc(cx, cy - 2, 13, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "rgba(255,255,255,0.12)";
          c.beginPath();
          c.arc(cx - 4, cy - 6, 5, 0, Math.PI * 2);
          c.fill();
        }
      }
      if (t === "H") {
        c.fillStyle = "#fff1d6";
        c.fillRect(cx - 14, cy - 4, 28, 18);
        c.fillStyle = "#b2222a";
        c.beginPath();
        c.moveTo(cx - 18, cy - 2);
        c.lineTo(cx, cy - 18);
        c.lineTo(cx + 18, cy - 2);
        c.fill();
        c.fillStyle = "#7a5528";
        c.fillRect(cx - 4, cy + 4, 8, 10);
      }
      if (t === "S") {
        // a little shrine: stone base, red pillars, curved roof
        c.fillStyle = "#b8b0a0";
        c.fillRect(cx - 13, cy + 6, 26, 8);
        c.fillStyle = "#c0392b";
        c.fillRect(cx - 10, cy - 6, 4, 13);
        c.fillRect(cx + 6, cy - 6, 4, 13);
        c.fillStyle = "#3a2a22";
        c.beginPath();
        c.moveTo(cx - 17, cy - 6);
        c.quadraticCurveTo(cx, cy - 22, cx + 17, cy - 6);
        c.lineTo(cx + 14, cy - 3);
        c.lineTo(cx - 14, cy - 3);
        c.fill();
        c.fillStyle = hex(T.accent);
        c.fillRect(cx - 3, cy - 2, 6, 8);
      }
      if (t === "G") {
        c.fillStyle = "#8a5a2b";
        c.fillRect(cx - 12, cy - 16, 4, 30);
        c.fillRect(cx + 8, cy - 16, 4, 30);
        c.fillStyle = "#b2222a";
        c.fillRect(cx - 15, cy - 16, 30, 4);
        if (!gateOpen) {
          c.fillStyle = "#a07040";
          for (let i = 0; i < 4; i++) c.fillRect(cx - 8 + i * 5, cy - 10, 3, 22);
        }
      }
      if (t === "<") {
        c.fillStyle = "rgba(60,40,20,0.35)";
        c.beginPath();
        c.moveTo(cx - 8, cy);
        c.lineTo(cx + 2, cy - 7);
        c.lineTo(cx + 2, cy + 7);
        c.fill();
      }
    }
  return cv;
}

export function IslandCanvas({ state, onTap }: { state: React.RefObject<IslandState>; onTap: (x: number, y: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = MAP_W * TILE * dpr;
    cv.height = MAP_H * TILE * dpr;
    const c = cv.getContext("2d")!;
    let painted: { key: string; img: HTMLCanvasElement } | null = null;
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = state.current;
      if (!s) return;
      const key = `${s.area.id}:${s.gateOpen}`;
      if (painted?.key !== key) painted = { key, img: paintMap(s.area, s.gateOpen) };
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.drawImage(painted.img, 0, 0);
      // water shimmer
      c.fillStyle = "rgba(255,255,255,0.18)";
      for (let y = 0; y < MAP_H; y++)
        for (let x = 0; x < MAP_W; x++)
          if (tileAt(s.area, x, y) === "~" && hash(x, y, Math.floor(now / 700)) < 0.12) c.fillRect(x * TILE + 8 + hash(x, y, 2) * 14, y * TILE + 20, 8, 2);
      // the shrine's lantern
      for (let y = 0; y < MAP_H; y++) {
        const x = s.area.rows[y].indexOf("S");
        if (x < 0) continue;
        const g = c.createRadialGradient(x * TILE + 16, y * TILE + 18, 0, x * TILE + 16, y * TILE + 18, 26);
        g.addColorStop(0, `rgba(255,200,90,${0.35 + Math.sin(now / 400) * 0.1})`);
        g.addColorStop(1, "rgba(255,200,90,0)");
        c.fillStyle = g;
        c.fillRect(x * TILE - 10, y * TILE - 8, 52, 52);
      }
      // people, back to front
      const actors: { y: number; draw: () => void }[] = [];
      for (const v of s.area.villagers) actors.push({ y: v.y, draw: () => person(c, v.x * TILE + 16, v.y * TILE + 14, v.look, 0, Math.sin(now / 500 + v.x) * 1.2) });
      for (let y = 0; y < MAP_H; y++) {
        const x = s.area.rows[y].indexOf("K");
        if (x < 0) continue;
        actors.push({
          y,
          draw: () => {
            person(c, x * TILE + 16, y * TILE + 14, 1, 1, Math.sin(now / 600) * 1, `#${s.area.theme.accent.toString(16).padStart(6, "0")}`);
            if (!s.keeperBeaten) {
              c.fillStyle = "#fff";
              c.font = "bold 14px system-ui";
              c.textAlign = "center";
              c.fillText("!", x * TILE + 16, y * TILE - 14 + Math.sin(now / 200) * 2);
            }
          },
        });
      }
      const p = s.player;
      const k = Math.min(1, (now - p.at) / p.ms);
      const px = p.from.x + (p.to.x - p.from.x) * k;
      const py = p.from.y + (p.to.y - p.from.y) * k;
      const walking = k < 1;
      actors.push({ y: py, draw: () => person(c, px * TILE + 16, py * TILE + 14, -1, p.to.dir, walking ? -Math.abs(Math.sin(now / 70)) * 2 : 0) });
      actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="block h-auto w-full touch-manipulation select-none"
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, imageRendering: "auto" }}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onTap(Math.floor(((e.clientX - box.left) / box.width) * MAP_W), Math.floor(((e.clientY - box.top) / box.height) * MAP_H));
      }}
    />
  );
}
