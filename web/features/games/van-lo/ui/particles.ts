// Stage 18: little moving dots that make the world feel alive: dust when you step, sparks when you hit,
// shards from a smashed urn, golden motes at a shrine, and each realm's own air (fireflies, embers, bubbles, ash).
//
// Positions are in tiles (not pixels), so particles stay put when the camera moves.
// The pool has a fixed size: on older phones ("light effects") it is much smaller.

import type { RealmId } from "../logic/data";

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number; // ms left
  max: number;
  size: number; // in tiles
  color: string;
  shape: "dot" | "shard" | "spark" | "glow";
  spin?: number;
};

export class Particles {
  list: Particle[] = [];
  constructor(public cap = 400) {}

  add(p: Omit<Particle, "max">) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({ ...p, max: p.life });
  }

  burst(
    x: number,
    y: number,
    n: number,
    o: { color: string | string[]; speed?: number; up?: number; gravity?: number; life?: number; size?: number; shape?: Particle["shape"] },
  ) {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      this.add({
        x: x + (Math.random() - 0.5) * 0.2,
        y: y + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (o.up ?? 0),
        gravity: o.gravity ?? 0,
        life: (o.life ?? 500) * (0.6 + Math.random() * 0.6),
        size: (o.size ?? 0.06) * (0.6 + Math.random() * 0.8),
        color: colors[i % colors.length],
        shape: o.shape ?? "dot",
        spin: Math.random() * 6,
      });
    }
  }

  // dt in ms
  update(dt: number) {
    const s = dt / 1000;
    let w = 0;
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.gravity * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      if (p.spin !== undefined) p.spin += s * 8;
      this.list[w++] = p;
    }
    this.list.length = w;
  }

  draw(g: CanvasRenderingContext2D, tile: number, cam: { x: number; y: number }) {
    for (const p of this.list) {
      const k = p.life / p.max;
      const x = (p.x - cam.x) * tile;
      const y = (p.y - cam.y) * tile;
      const r = Math.max(0.8, p.size * tile);
      g.globalAlpha = Math.min(1, k * 1.6);
      g.fillStyle = p.color;
      if (p.shape === "glow") {
        g.globalAlpha = Math.min(1, k * 1.6) * (0.55 + Math.sin((p.spin ?? 0) * 0.7) * 0.35);
        g.beginPath();
        g.arc(x, y, r * 2.2, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha *= 1.6;
        g.fillStyle = "#fff8d8";
        g.beginPath();
        g.arc(x, y, r * 0.8, 0, Math.PI * 2);
        g.fill();
      } else if (p.shape === "shard") {
        g.save();
        g.translate(x, y);
        g.rotate(p.spin ?? 0);
        g.fillRect(-r, -r * 0.5, r * 2, r);
        g.restore();
      } else if (p.shape === "spark") {
        g.strokeStyle = p.color;
        g.lineWidth = Math.max(1, r * 0.7);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - p.vx * tile * 0.03, y - p.vy * tile * 0.03);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}

// Each realm's air: what floats around the tiles you can see
export type Ambient = { color: string[]; shape: Particle["shape"]; rise: number; drift: number; rate: number; size: number; life: number };
export const AMBIENT: Record<RealmId | "tribulation", Ambient> = {
  "vu-an-coc": { color: ["#d8f27a", "#f4f0a0"], shape: "glow", rise: 0.08, drift: 0.25, rate: 2.2, size: 0.03, life: 3200 }, // fireflies
  "luu-hoa": { color: ["#ff8a3d", "#ffc15e", "#e0452b"], shape: "dot", rise: 0.7, drift: 0.2, rate: 5, size: 0.03, life: 1800 }, // embers
  "bich-hai": { color: ["rgba(170,220,255,0.8)", "rgba(220,245,255,0.8)"], shape: "dot", rise: 0.45, drift: 0.1, rate: 3.5, size: 0.04, life: 2200 }, // bubbles
  "co-chien": { color: ["#8f8679", "#6d6458", "#a29785"], shape: "dot", rise: -0.15, drift: 0.35, rate: 4, size: 0.025, life: 2600 }, // ash
  tribulation: { color: ["#fff2a8", "#ffd84a"], shape: "spark", rise: -1.2, drift: 0.3, rate: 3, size: 0.03, life: 900 }, // falling sparks
};
