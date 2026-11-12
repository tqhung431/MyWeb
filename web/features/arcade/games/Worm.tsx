"use client";

// Hungry Worm: a classic grid game, drawn on a <canvas>.
//
// A game loop: requestAnimationFrame calls draw() once per screen refresh (60, 90 or 120 times a second), and every
// tickMs() milliseconds the rules move the worm one cell (logic/worm.ts).
// The worm's state lives in a ref, not React state: it changes too often for re-rendering.
//
// Stage 19: smooth movement. The rules still move in whole cells, but the drawing slides each segment from where it
// was at the last tick to where it is now ("interpolation"), so the worm glides instead of jumping 8 times a second.
// The grass is painted once into an offscreen canvas, crumbs fly when it eats, and the board shakes when it crashes.

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { newGame, step, tickMs, turn, type Dir, type WormState } from "../logic/worm";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

import { useT } from "@/lib/i18n/I18nProvider";
import { tx } from "@/lib/i18n/core";
const CELL = 30;
const SIZE = 16;
const PX = CELL * SIZE;
const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};
const NOMS = [tx("nom!"), tx("yum!"), tx("burp"), tx("more!"), tx("mmm"), tx("crunch")];

export default function Worm({ onFinish }: GameProps) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<WormState>(newGame(SIZE));
  const turns = useRef<Dir[]>([]); // pressed faster than the worm moves? keep them in order
  const bubble = useRef<{ text: string; until: number } | null>(null);
  const [hud, setHud] = useState({ score: 0, eaten: 0 });
  const finish = useLatest(onFinish);

  const started = useRef(false); // the worm waits for your first move
  const [waiting, setWaiting] = useState(true);
  const steer = (d: Dir) => {
    if (!started.current) {
      started.current = true;
      setWaiting(false);
    }
    if (turns.current.length < 3) turns.current.push(d);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (!d || (e.target as HTMLElement).closest("input, textarea, select")) return;
      e.preventDefault(); // don't scroll the page
      steer(d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The game loop
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); // 3× screens gain nothing visible but cost 2× the pixels
    ctx.canvas.width = PX * dpr;
    ctx.canvas.height = PX * dpr;
    ctx.scale(dpr, dpr);
    const grass = paintGrass(dpr);
    let prev: WormState = game.current; // where the worm was at the last tick
    let crumbs: Crumb[] = [];
    let shake = 0;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let deadAt = 0;

    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      const g = game.current;
      if (g.alive && started.current && !document.hidden) {
        acc += Math.min(dt, 250);
        while (acc >= tickMs(g.eaten) && game.current.alive) {
          acc -= tickMs(game.current.eaten);
          tick(now);
        }
      }
      const g2 = game.current;
      const t = g2.alive && started.current ? Math.min(1, acc / tickMs(g2.eaten)) : 1;
      crumbs = crumbs.filter((c) => (c.life -= dt) > 0);
      for (const c of crumbs) {
        c.vy += 0.0012 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }
      shake *= Math.exp(-dt / 80);
      ctx.save();
      if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      ctx.drawImage(grass, 0, 0, PX, PX);
      draw(ctx, g2, prev, t, bubble.current && bubble.current.until > now ? bubble.current.text : null, crumbs);
      ctx.restore();
      if (!game.current.alive) {
        deadAt ||= now;
        if (now - deadAt > 700) return finish.current(game.current.score); // a moment to see the 😵
      }
      raf = requestAnimationFrame(frame);
    };

    const tick = (now: number) => {
      const before = game.current;
      let dir = before.dir;
      while (turns.current.length) {
        const wanted = turn(dir, turns.current.shift()!);
        if (wanted !== dir) {
          dir = wanted;
          break; // one turn per step
        }
      }
      const after = step({ ...before, dir });
      prev = before;
      game.current = after;
      if (!after.alive) {
        sfx("bonk");
        shake = 12;
        prev = after; // stay where it crashed
      } else if (after.eaten > before.eaten) {
        const cx = before.snack.x * CELL + CELL / 2;
        const cy = before.snack.y * CELL + CELL / 2;
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 0.05 + Math.random() * 0.12;
          crumbs.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 0.12,
            life: 450 + Math.random() * 250,
            color: before.snack.spicy ? "#ff6a3d" : CRUMB[i % CRUMB.length],
          });
        }
        sfx(before.snack.spicy ? "spicy" : "eat");
        bubble.current = {
          text: before.snack.spicy ? t("SPICY! 🔥") : t(NOMS[after.eaten % NOMS.length]),
          until: now + 700,
        };
        setHud({ score: after.score, eaten: after.eaten });
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  // Swipe on the board (phones)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => (touchStart.current = { x: e.clientX, y: e.clientY });
  const onPointerUp = (e: React.PointerEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between text-sm font-semibold">
        <span>
          Score: <span className="tabular-nums">{hud.score}</span>
        </span>
        <span className="text-muted">{t("Snacks eaten: {n}", { n: hud.eaten })}</span>
      </div>
      <div className="relative w-full">
        <canvas
          ref={canvas}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="aspect-square w-full max-w-[calc(100svh-20rem)] touch-none rounded-2xl select-none sm:max-w-none"
          role="img"
          aria-label={t("Hungry Worm board. Score {n}.", { n: hud.score })}
        />
        {waiting && (
          <p className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit animate-pop rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-900 shadow">
            {t("Press an arrow or swipe to start")}
          </p>
        )}
      </div>
      <DPad onSteer={steer} />
    </div>
  );
}

function DPad({ onSteer }: { onSteer: (d: Dir) => void }) {
  const t = useT();
  const btn = "inline-flex h-11 w-14 items-center justify-center rounded-2xl border border-border bg-surface-strong active:scale-95 active:bg-surface-muted";
  const press = (d: Dir) => (e: React.PointerEvent) => {
    e.preventDefault();
    onSteer(d);
  };
  return (
    <div className="flex gap-2 sm:hidden" aria-label={t("Steering buttons")}>
      <button type="button" className={btn} onPointerDown={press("left")} aria-label={t("Left")}>
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onPointerDown={press("up")} aria-label={t("Up")}>
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onPointerDown={press("down")} aria-label={t("Down")}>
        <ArrowDown className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onPointerDown={press("right")} aria-label={t("Right")}>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

type Crumb = { x: number; y: number; vx: number; vy: number; life: number; color: string };
const CRUMB = ["#fff3b0", "#ffd166", "#ffffff", "#f7a9c8"];

// The board: a soft checkerboard of grass, painted once
function paintGrass(dpr: number) {
  const c = document.createElement("canvas");
  c.width = PX * dpr;
  c.height = PX * dpr;
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      g.fillStyle = (x + y) % 2 ? "#a7d97a" : "#b5e186";
      g.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  return c;
}

// Where segment i is drawn: part of the way from its last spot to its new one
function segment(g: WormState, prev: WormState, i: number, t: number) {
  const now = g.worm[i];
  const was = prev.worm[i] ?? prev.worm[prev.worm.length - 1] ?? now;
  return { x: (was.x + (now.x - was.x) * t) * CELL + CELL / 2, y: (was.y + (now.y - was.y) * t) * CELL + CELL / 2 };
}

function draw(ctx: CanvasRenderingContext2D, g: WormState, prev: WormState, t: number, bubble: string | null, crumbs: Crumb[]) {
  // The snack (it bobs up and down a little)
  const bob = Math.sin(performance.now() / 180) * 2;
  ctx.font = `${CELL - 4}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(g.snack.emoji, g.snack.x * CELL + CELL / 2, g.snack.y * CELL + CELL / 2 + bob);

  // The worm, tail first so the head is drawn on top. A thick line joins the segments, so the body looks round
  // and continuous while it slides.
  const pts = g.worm.map((_, i) => segment(g, prev, i, t));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = pts.length - 1; i > 0; i--) {
    const k = i / Math.max(1, pts.length - 1);
    ctx.strokeStyle = `hsl(${335 - k * 20} 72% ${65 - k * 8}%)`;
    ctx.lineWidth = CELL - 4 - k * 6;
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
    ctx.stroke();
  }
  ctx.fillStyle = "hsl(340 75% 68%)";
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, CELL / 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes on the head, looking where it's going (or dizzy when it crashed)
  const hx = pts[0].x;
  const hy = pts[0].y;
  if (!g.alive) {
    ctx.font = `${CELL}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText("😵", hx, hy);
  } else {
    const look = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[g.dir];
    const side = [-look[1], look[0]];
    for (const s of [-1, 1]) {
      const ex = hx + side[0] * 6 * s + look[0] * 4;
      const ey = hy + side[1] * 6 * s + look[1] * 4;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c1830";
      ctx.beginPath();
      ctx.arc(ex + look[0] * 2, ey + look[1] * 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Crumbs from the last snack
  for (const c of crumbs) {
    ctx.globalAlpha = Math.min(1, c.life / 300);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // "nom!" speech bubble
  if (bubble && g.alive) {
    ctx.font = "bold 15px system-ui, sans-serif";
    const w = ctx.measureText(bubble).width + 14;
    const bx = Math.min(Math.max(hx, w / 2 + 2), PX - w / 2 - 2);
    const by = Math.max(hy - CELL, 14);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.roundRect(bx - w / 2, by - 12, w, 24, 12);
    ctx.fill();
    ctx.fillStyle = "#1c1830";
    ctx.fillText(bubble, bx, by + 1);
  }
}
