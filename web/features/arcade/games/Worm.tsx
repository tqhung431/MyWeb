"use client";

// Hungry Worm: a classic grid game, drawn on a <canvas>.
//
// A game loop: requestAnimationFrame calls draw() about 60 times a second, and every
// tickMs() milliseconds the rules move the worm one cell (logic/worm.ts).
// The worm's state lives in a ref, not React state: it changes too often for re-rendering.

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { newGame, step, tickMs, turn, type Dir, type WormState } from "../logic/worm";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

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
const NOMS = ["nom!", "yum!", "burp", "more!", "mmm", "crunch"];

export default function Worm({ onFinish }: GameProps) {
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
    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = PX * dpr;
    ctx.canvas.height = PX * dpr;
    ctx.scale(dpr, dpr);

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
      draw(ctx, game.current, bubble.current && bubble.current.until > now ? bubble.current.text : null);
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
      game.current = after;
      if (!after.alive) sfx("bonk");
      else if (after.eaten > before.eaten) {
        sfx(before.snack.spicy ? "spicy" : "eat");
        bubble.current = {
          text: before.snack.spicy ? "SPICY! 🔥" : NOMS[after.eaten % NOMS.length],
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
        <span className="text-muted">Snacks eaten: {hud.eaten}</span>
      </div>
      <div className="relative w-full">
        <canvas
          ref={canvas}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="aspect-square w-full max-w-[calc(100svh-20rem)] touch-none rounded-2xl select-none sm:max-w-none"
          role="img"
          aria-label={`Hungry Worm board. Score ${hud.score}.`}
        />
        {waiting && (
          <p className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit animate-pop rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-900 shadow">
            Press an arrow or swipe to start
          </p>
        )}
      </div>
      <DPad onSteer={steer} />
    </div>
  );
}

function DPad({ onSteer }: { onSteer: (d: Dir) => void }) {
  const btn = "inline-flex h-11 w-14 items-center justify-center rounded-2xl border border-border bg-surface-strong active:scale-95 active:bg-surface-muted";
  const press = (d: Dir) => (e: React.PointerEvent) => {
    e.preventDefault();
    onSteer(d);
  };
  return (
    <div className="flex gap-2 sm:hidden" aria-label="Steering buttons">
      <button type="button" className={btn} onPointerDown={press("left")} aria-label="Left">
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onPointerDown={press("up")} aria-label="Up">
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onPointerDown={press("down")} aria-label="Down">
        <ArrowDown className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onPointerDown={press("right")} aria-label="Right">
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, g: WormState, bubble: string | null) {
  // The board: a soft checkerboard of grass
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#a7d97a" : "#b5e186";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  // The snack (it bobs up and down a little)
  const bob = Math.sin(performance.now() / 180) * 2;
  ctx.font = `${CELL - 4}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(g.snack.emoji, g.snack.x * CELL + CELL / 2, g.snack.y * CELL + CELL / 2 + bob);

  // The worm, tail first so the head is drawn on top
  for (let i = g.worm.length - 1; i >= 0; i--) {
    const c = g.worm[i];
    const t = i / Math.max(1, g.worm.length - 1);
    ctx.fillStyle = i % 2 ? `hsl(${330 - t * 20} 70% ${62 - t * 8}%)` : `hsl(${340 - t * 20} 75% ${68 - t * 8}%)`;
    const r = i === 0 ? CELL / 2 : CELL / 2 - 2 - t * 3;
    ctx.beginPath();
    ctx.arc(c.x * CELL + CELL / 2, c.y * CELL + CELL / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes on the head, looking where it's going (or dizzy when it crashed)
  const head = g.worm[0];
  const hx = head.x * CELL + CELL / 2;
  const hy = head.y * CELL + CELL / 2;
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
