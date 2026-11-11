"use client";

// Silly Pairs: a memory game. Plain buttons (no canvas) that flip with a CSS 3D turn.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ANIMALS, isMatch, newDeck } from "../logic/pairs";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

export default function Pairs({ onFinish }: GameProps) {
  const [deck] = useState(() => newDeck(8));
  const [open, setOpen] = useState<number[]>([]); // face up, not matched yet (0–2 cards)
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number[]>([]); // shaking
  const [moves, setMoves] = useState(0);
  const [said, setSaid] = useState<{ text: string; key: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const finish = useLatest(onFinish);
  const done = matched.size === deck.length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [done]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => finish.current(moves), 900);
    return () => clearTimeout(id);
  }, [done, moves, finish]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || matched.has(i)) return;
    sfx("flip");
    if (open.length === 0) return setOpen([i]);

    const [first] = open;
    setMoves((m) => m + 1);
    if (isMatch(deck, first, i)) {
      setMatched((m) => new Set([...m, first, i]));
      setOpen([]);
      setSaid({
        text: `${ANIMALS[deck[i].animal].emoji} ${ANIMALS[deck[i].animal].says}`,
        key: Date.now(),
      });
      sfx("match");
    } else {
      setOpen([first, i]);
      timer.current = setTimeout(() => {
        setWrong([first, i]);
        sfx("miss");
        timer.current = setTimeout(() => {
          setOpen([]);
          setWrong([]);
        }, 400);
      }, 600);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Moves: <span className="tabular-nums">{moves}</span>
        </span>
        <span className="min-w-0 truncate px-2 text-primary" aria-live="polite" key={said?.key}>
          {said && <span className="inline-block animate-pop">{said.text}</span>}
        </span>
        <span className="text-muted tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {deck.map((card, i) => {
          const up = open.includes(i) || matched.has(i);
          const animal = ANIMALS[card.animal];
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(i)}
              aria-label={up ? animal.emoji : `Card ${i + 1}, face down`}
              aria-pressed={up}
              className={cn(
                "aspect-square cursor-pointer perspective-distant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl",
                wrong.includes(i) && "animate-shake",
              )}
            >
              <span className={cn("relative block h-full w-full transition-transform duration-300 transform-3d", up && "rotate-y-180")}>
                {/* back */}
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-linear-to-br from-sky-400 to-indigo-500 text-2xl font-black text-white/80 shadow-md backface-hidden">
                  ?
                </span>
                {/* front */}
                <span
                  className={cn(
                    "absolute inset-0 flex rotate-y-180 items-center justify-center rounded-2xl border-2 bg-surface-strong text-4xl shadow-md backface-hidden sm:text-5xl",
                    matched.has(i) ? "border-emerald-400" : "border-border",
                  )}
                >
                  {animal.emoji}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
