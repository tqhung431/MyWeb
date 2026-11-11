"use client";

// Odd Emoji Out: find the one emoji that's different. The grid grows from 2×2 to 7×7.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { newRound, ROUND_SECONDS, WRONG_PENALTY_S, type Round } from "../logic/odd";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

const CHEERS = ["Eagle eyes! 🦅", "Sharp! 🔍", "Nice spot!", "Too easy? 😏", "Wow!", "Detective mode 🕵️"];
const TEXT_SIZE = ["", "", "text-6xl", "text-5xl", "text-4xl", "text-3xl", "text-3xl", "text-2xl"];

export default function Odd({ onFinish }: GameProps) {
  const [found, setFound] = useState(0);
  const [round, setRound] = useState<Round>(() => newRound(0));
  const [left, setLeft] = useState(ROUND_SECONDS * 1000);
  const [wrong, setWrong] = useState<number | null>(null);
  const [cheer, setCheer] = useState<{ text: string; key: number } | null>(null);
  const deadline = useRef(performance.now() + ROUND_SECONDS * 1000);
  const foundRef = useRef(0);
  const finish = useLatest(onFinish);
  const over = left <= 0;

  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, deadline.current - performance.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(id);
        finish.current(foundRef.current);
      }
    }, 100);
    return () => clearInterval(id);
  }, [finish]);

  const pick = (i: number) => {
    if (over) return;
    if (i === round.oddIndex) {
      foundRef.current += 1;
      setFound(foundRef.current);
      setRound(newRound(foundRef.current));
      sfx("match");
      if (foundRef.current % 3 === 0)
        setCheer({
          text: CHEERS[Math.floor(Math.random() * CHEERS.length)],
          key: Date.now(),
        });
    } else {
      deadline.current -= WRONG_PENALTY_S * 1000;
      setWrong(i);
      setCheer({ text: `−${WRONG_PENALTY_S} s 🙈`, key: Date.now() });
      sfx("miss");
      setTimeout(() => setWrong(null), 400);
    }
  };

  const cells = round.size * round.size;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Found: <span className="tabular-nums">{found}</span>
        </span>
        <span className="min-w-0 truncate px-2 text-primary" key={cheer?.key} aria-live="polite">
          {cheer && <span className="inline-block animate-pop">{cheer.text}</span>}
        </span>
        <span className={cn("tabular-nums", left < 10_000 ? "text-rose-500" : "text-muted")}>{Math.ceil(left / 1000)} s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-linear-to-r from-violet-400 to-purple-600 transition-[width] duration-100 ease-linear"
          style={{ width: `${(left / (ROUND_SECONDS * 1000)) * 100}%` }}
        />
      </div>

      <div
        className="grid aspect-square w-full gap-1.5 rounded-2xl bg-surface-muted p-2 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${round.size}, minmax(0, 1fr))` }}
        role="group"
        aria-label={`Find the odd one out in this ${round.size} by ${round.size} grid`}
      >
        {Array.from({ length: cells }, (_, i) => (
          <button
            key={`${found}-${i}`}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              pick(i);
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick(i)}
            aria-label={i === round.oddIndex ? round.odd : round.common}
            className={cn(
              "flex cursor-pointer touch-manipulation items-center justify-center rounded-xl bg-surface-strong leading-none shadow-sm transition select-none hover:scale-105",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              TEXT_SIZE[round.size],
              wrong === i && "animate-shake bg-rose-500/20",
            )}
          >
            {i === round.oddIndex ? round.odd : round.common}
          </button>
        ))}
      </div>
    </div>
  );
}
