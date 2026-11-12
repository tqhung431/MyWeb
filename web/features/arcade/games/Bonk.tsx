"use client";

// Bonk-a-Blob: things pop out of 9 holes for a moment. Bonk the blobs, never the cat.
// A 100 ms "tick" runs the round: it counts down, hides poppers whose time is up, and adds new ones.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { BLOBS, HOLES, pick, points, ROUND_MS, upTime, type Popper } from "../logic/bonk";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

import { useT } from "@/lib/i18n/I18nProvider";
type Up = {
  id: number;
  kind: Popper;
  emoji: string;
  until: number;
  bonked: boolean;
};
type Float = { id: number; hole: number; text: string; good: boolean };

const EMOJI = { star: "🤩", cat: "😺" } as const;

export default function Bonk({ onFinish }: GameProps) {
  const t = useT();
  const [holes, setHoles] = useState<(Up | null)[]>(() => Array(HOLES).fill(null));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(ROUND_MS);
  const [floats, setFloats] = useState<Float[]>([]);
  const finish = useLatest(onFinish);
  const scoreRef = useRef(0);
  const nextId = useRef(1);

  useEffect(() => {
    const startedAt = performance.now();
    let nextSpawn = startedAt + 400;
    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startedAt;
      setLeft(Math.max(0, ROUND_MS - elapsed));
      if (elapsed >= ROUND_MS) {
        clearInterval(id);
        setHoles(Array(HOLES).fill(null));
        finish.current(Math.max(0, scoreRef.current));
        return;
      }
      setHoles((hs) => {
        let missed = false;
        const next = hs.map((h) => {
          if (h && h.until <= now) {
            if (h.kind !== "cat" && !h.bonked) missed = true;
            return null;
          }
          return h;
        });
        if (missed) setCombo(0); // a blob got away: combo over
        if (now >= nextSpawn) {
          const free = next.flatMap((h, i) => (h ? [] : [i]));
          const busy = HOLES - free.length;
          if (free.length && busy < 3) {
            const hole = free[Math.floor(Math.random() * free.length)];
            const kind = pick();
            next[hole] = {
              id: nextId.current++,
              kind,
              emoji: kind === "blob" ? BLOBS[Math.floor(Math.random() * BLOBS.length)] : EMOJI[kind],
              until: now + upTime(elapsed),
              bonked: false,
            };
          }
          nextSpawn = now + 450 + Math.random() * (500 - elapsed / 100);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [finish]);

  const bonk = (i: number) => {
    const h = holes[i];
    if (!h || h.bonked) return;
    const gained = points(h.kind, combo);
    scoreRef.current += gained;
    setScore(scoreRef.current);
    setCombo(h.kind === "cat" ? 0 : combo + 1);
    sfx(h.kind === "cat" ? "meow" : h.kind === "star" ? "star" : "bonk");
    setHoles((hs) =>
      hs.map((x, j) =>
        j === i && x
          ? {
              ...x,
              bonked: true,
              until: Math.min(x.until, performance.now() + 350),
            }
          : x,
      ),
    );
    const f: Float = {
      id: nextId.current++,
      hole: i,
      text: h.kind === "cat" ? "−20 😾" : `+${gained}`,
      good: gained > 0,
    };
    setFloats((fs) => [...fs, f]);
    setTimeout(() => setFloats((fs) => fs.filter((x) => x.id !== f.id)), 800);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Score: <span className="tabular-nums">{score}</span>
        </span>
        {combo >= 3 && <span className="animate-pop text-primary">{t("Combo ×{n}! 🔥", { n: combo })}</span>}
        <span className="text-muted tabular-nums">{Math.ceil(left / 1000)} s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-linear-to-r from-fuchsia-400 to-pink-500 transition-[width] duration-100 ease-linear"
          style={{ width: `${(left / ROUND_MS) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-3xl bg-linear-to-b from-lime-300 to-green-400 p-3 sm:gap-4 sm:p-5 dark:from-green-800 dark:to-green-950">
        {holes.map((h, i) => (
          <button
            key={i}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              bonk(i);
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && bonk(i)}
            aria-label={
              h
                ? h.kind === "cat"
                  ? t("Hole {n}: a cat, don't bonk!", { n: i + 1 })
                  : t("Hole {n}: bonk it!", { n: i + 1 })
                : t("Hole {n}: empty", { n: i + 1 })
            }
            className="relative aspect-square cursor-pointer touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full"
          >
            {/* the hole */}
            <span className="absolute inset-x-[8%] bottom-[8%] h-[38%] rounded-[50%] bg-amber-950/80 shadow-[inset_0_6px_10px_rgba(0,0,0,0.5)]" />
            {h && (
              <span
                key={h.id}
                className={cn(
                  "absolute inset-x-0 bottom-[22%] flex justify-center text-5xl leading-none sm:text-6xl",
                  h.bonked ? "scale-90 opacity-60" : "animate-pop",
                )}
              >
                {h.bonked ? (h.kind === "cat" ? "🙀" : "😵") : h.emoji}
              </span>
            )}
            {floats
              .filter((f) => f.hole === i)
              .map((f) => (
                <span
                  key={f.id}
                  className={cn(
                    "pointer-events-none absolute top-0 left-1/2 animate-float-up text-lg font-black drop-shadow",
                    f.good ? "text-white" : "text-rose-600",
                  )}
                >
                  {f.text}
                </span>
              ))}
          </button>
        ))}
      </div>
    </div>
  );
}
