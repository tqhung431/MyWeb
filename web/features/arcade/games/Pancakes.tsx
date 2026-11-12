"use client";

// Pancake Tower: drop sliding pancakes onto the stack. A <canvas> game loop, like Hungry Worm,
// with a "camera" that scrolls up as the tower grows (we draw everything shifted by cameraY).

import { useEffect, useRef, useState } from "react";
import { land, slideSpeed, type Slab } from "../logic/pancakes";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

const W = 400;
const H = 500;
const LAYER = 22; // pancake thickness
const BASE_W = 200;
const GROUND = H - 40; // where the plate is
const TOPPINGS = ["🍓", "🫐", "🍌", "🧈", "🍒", "🍫"];
const MILESTONES: Record<number, string> = {
  5: "Breakfast for one! 🍳",
  10: "Breakfast for the family!",
  20: "Breakfast for the whole street!",
  30: "Is this a skyscraper? 🏙️",
  45: "Pilots are complaining. ✈️",
  60: "NASA called. 🚀",
};

type Falling = Slab & { y: number; vy: number; angle: number; spin: number };
type World = {
  stack: Slab[];
  moving: Slab;
  dir: 1 | -1;
  dropping: { y: number } | null;
  falling: Falling[];
  cameraY: number;
  over: boolean;
  banner: { text: string; until: number } | null;
};

function startWorld(): World {
  return {
    stack: [{ x: (W - BASE_W) / 2, w: BASE_W }],
    moving: { x: -BASE_W * 0.3, w: BASE_W },
    dir: 1,
    dropping: null,
    falling: [],
    cameraY: 0,
    over: false,
    banner: { text: "Tap to drop! 🥞", until: performance.now() + 1800 },
  };
}

const layerY = (i: number) => GROUND - (i + 1) * LAYER; // top edge of layer i

export default function Pancakes({ onFinish }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World>(startWorld());
  const [count, setCount] = useState(0);
  const finish = useLatest(onFinish);

  const drop = () => {
    const w = world.current;
    if (w.over || w.dropping) return;
    w.dropping = { y: layerY(w.stack.length) - 70 };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter" || e.key === "ArrowDown") && !(e.target as HTMLElement).closest("input, textarea, select, button")) {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.canvas.width = W * dpr;
    ctx.canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let last = performance.now();
    let overAt = 0;

    const frame = (now: number) => {
      const f = Math.min(now - last, 50) / (1000 / 60); // 1 = one frame at 60 fps
      last = now;
      const w = world.current;
      const n = w.stack.length;
      const topY = layerY(n);

      if (!w.over) {
        if (w.dropping) {
          w.dropping.y += 14 * f;
          if (w.dropping.y >= topY) settle(w, now);
        } else {
          // slide left and right, a bit past the edges so you CAN miss
          w.moving.x += w.dir * slideSpeed(n - 1) * f;
          if (w.moving.x > W - w.moving.w * 0.6) w.dir = -1;
          if (w.moving.x < -w.moving.w * 0.4) w.dir = 1;
        }
      }
      for (const p of w.falling) {
        p.vy += 0.5 * f;
        p.y += p.vy * f;
        p.angle += p.spin * f;
      }
      w.falling = w.falling.filter((p) => p.y - w.cameraY < H + 200);
      // keep the top of the tower around the middle of the screen
      const wanted = Math.min(0, topY - H * 0.5);
      w.cameraY += (wanted - w.cameraY) * (1 - Math.pow(0.92, f)); // the same glide at 60 or 120 fps

      draw(ctx, w, now);
      if (w.over) {
        overAt ||= now;
        if (now - overAt > 1100) return finish.current(w.stack.length - 1);
      }
      raf = requestAnimationFrame(frame);
    };

    const settle = (w: World, now: number) => {
      const below = w.stack[w.stack.length - 1];
      const result = land(below, w.moving, BASE_W);
      const y = layerY(w.stack.length);
      w.dropping = null;
      if (!result) {
        // missed: the whole pancake tumbles off
        w.falling.push({
          ...w.moving,
          y,
          vy: 0,
          angle: 0,
          spin: (w.moving.x < below.x ? -1 : 1) * 0.06,
        });
        w.over = true;
        w.banner = { text: "Splat! 💥", until: now + 2000 };
        sfx("miss");
        return;
      }
      if (result.cut)
        w.falling.push({
          ...result.cut,
          y,
          vy: 0,
          angle: 0,
          spin: (result.cut.x < result.slab.x ? -1 : 1) * 0.05,
        });
      w.stack.push(result.slab);
      const stacked = w.stack.length - 1;
      setCount(stacked);
      sfx(result.perfect ? "perfect" : "drop");
      if (MILESTONES[stacked]) w.banner = { text: MILESTONES[stacked], until: now + 1800 };
      else if (result.perfect) w.banner = { text: "PERFECT! ✨", until: now + 900 };
      // the next one starts from a random side
      const fromLeft = Math.random() < 0.5;
      w.moving = {
        x: fromLeft ? -result.slab.w * 0.4 : W - result.slab.w * 0.6,
        w: result.slab.w,
      };
      w.dir = fromLeft ? 1 : -1;
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Pancakes: <span className="tabular-nums">{count}</span>
        </span>
        <span className="text-muted">Tap the board or press Space</span>
      </div>
      <canvas
        ref={canvas}
        onPointerDown={(e) => {
          e.preventDefault();
          drop();
        }}
        className="aspect-[4/5] w-full cursor-pointer touch-none rounded-2xl select-none"
        role="img"
        aria-label={`Pancake Tower: ${count} pancakes stacked. Tap or press Space to drop the next one.`}
      />
    </div>
  );
}

function pancake(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + LAYER);
  g.addColorStop(0, "#f6c46b");
  g.addColorStop(0.5, "#e2a043");
  g.addColorStop(1, "#b8732a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y + 2, w, LAYER - 2, 10);
  ctx.fill();
  // a lighter top edge, and a syrup drip on some of them
  ctx.fillStyle = "rgba(255, 236, 190, 0.7)";
  ctx.fillRect(x + 8, y + 4, Math.max(0, w - 16), 3);
  if (seed % 3 === 0 && w > 40) {
    ctx.fillStyle = "#8a4b14";
    const dx = x + ((seed * 37) % Math.max(1, w - 20)) + 10;
    ctx.beginPath();
    ctx.roundRect(dx, y + 6, 7, 14 + (seed % 4) * 3, 4);
    ctx.fill();
  }
}

function draw(ctx: CanvasRenderingContext2D, w: World, now: number) {
  const height = w.stack.length;
  // The sky gets darker the higher you go (day → sunset → space)
  const t = Math.min(1, height / 60);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `hsl(${210 + t * 50} ${70 - t * 30}% ${80 - t * 65}%)`);
  sky.addColorStop(1, `hsl(${35 + t * 200} ${80 - t * 40}% ${88 - t * 60}%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (t > 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(t - 0.6) * 2})`;
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % W, (i * 53) % (H * 0.7), 2, 2);
  }

  ctx.save();
  ctx.translate(0, -w.cameraY);

  // the plate
  ctx.fillStyle = "#f4f4f8";
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND + 8, BASE_W * 0.75, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9d9e3";
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND + 10, BASE_W * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  w.stack.forEach((s, i) => pancake(ctx, s.x, layerY(i), s.w, i));

  // a topping on the top pancake
  if (height > 1) {
    const top = w.stack[height - 1];
    ctx.font = "22px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(TOPPINGS[(height - 2) % TOPPINGS.length], top.x + top.w / 2, layerY(height - 1) + 6);
  }

  if (!w.over) {
    const y = w.dropping ? w.dropping.y : layerY(height) - 70;
    pancake(ctx, w.moving.x, y, w.moving.w, height);
  }

  for (const p of w.falling) {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + LAYER / 2);
    ctx.rotate(p.angle);
    pancake(ctx, -p.w / 2, -LAYER / 2, p.w, 1);
    ctx.restore();
  }
  ctx.restore();

  if (w.banner && w.banner.until > now) {
    ctx.font = "bold 22px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(w.banner.text).width + 28;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - width / 2, 22, width, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#1c1830";
    ctx.fillText(w.banner.text, W / 2, 43);
  }
}
