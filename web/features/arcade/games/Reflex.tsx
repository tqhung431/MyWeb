"use client";

// Too Early!: wait for green, then tap as fast as you can. 5 rounds, your score is the average.
// performance.now() measures time in fractions of a millisecond, unlike Date.now().

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { animalFor, average, EARLY_LINES, ROUNDS, waitMs, WAITING_LINES } from "../logic/reflex";
import { sfx } from "../sfx";
import type { GameProps } from "../types";
import { useLatest } from "../useLatest";

import { useT } from "@/lib/i18n/I18nProvider";
type State = { name: "waiting"; line: string } | { name: "go"; at: number } | { name: "early"; line: string } | { name: "result"; ms: number };

export default function Reflex({ onFinish }: GameProps) {
  const t = useT();
  const [state, setState] = useState<State>({
    name: "waiting",
    line: WAITING_LINES[0],
  });
  const [times, setTimes] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finish = useLatest(onFinish);

  const wait = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState({
      name: "waiting",
      line: WAITING_LINES[Math.floor(Math.random() * WAITING_LINES.length)],
    });
    timer.current = setTimeout(() => {
      setState({ name: "go", at: performance.now() });
      sfx("go");
    }, waitMs());
  }, []);

  useEffect(() => {
    wait();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [wait]);

  const press = useCallback(() => {
    if (state.name === "waiting") {
      if (timer.current) clearTimeout(timer.current);
      setState({
        name: "early",
        line: EARLY_LINES[Math.floor(Math.random() * EARLY_LINES.length)],
      });
      sfx("cluck");
    } else if (state.name === "go") {
      const ms = Math.max(80, Math.round(performance.now() - state.at));
      const all = [...times, ms];
      setTimes(all);
      setState({ name: "result", ms });
      sfx("match");
      if (all.length === ROUNDS) timer.current = setTimeout(() => finish.current(Math.min(5000, average(all))), 1200);
    } else if (state.name === "early" || (state.name === "result" && times.length < ROUNDS)) {
      wait();
    }
  }, [state, times, wait, finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !(e.target as HTMLElement).closest("input, textarea, select, button")) {
        e.preventDefault();
        if (!e.repeat) press();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const look = {
    waiting: "from-rose-500 to-red-600",
    go: "from-emerald-400 to-green-500",
    early: "from-amber-300 to-yellow-400 text-slate-900",
    result: "from-sky-400 to-indigo-500",
  }[state.name];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>
          Round {Math.min(times.length + 1, ROUNDS)} of {ROUNDS}
        </span>
        <span className="flex gap-1.5" aria-label={t("Times so far: {list}", { list: times.join(", ") || t("none") })}>
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span
              key={i}
              className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", times[i] ? "bg-primary/15 text-primary" : "bg-surface-muted text-muted")}
            >
              {times[i] ?? "–"}
            </span>
          ))}
        </span>
      </div>

      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        className={cn(
          "flex aspect-square w-full cursor-pointer touch-manipulation flex-col items-center justify-center gap-3 rounded-2xl bg-linear-to-br p-6 text-center text-white select-none",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
          look,
          state.name === "early" && "animate-shake",
        )}
        aria-live="assertive"
      >
        {state.name === "waiting" && (
          <>
            <span className="text-7xl" aria-hidden="true">
              ✋
            </span>
            <span className="text-2xl font-extrabold">{t(state.line)}</span>
          </>
        )}
        {state.name === "go" && (
          <>
            <span className="text-7xl" aria-hidden="true">
              👆
            </span>
            <span className="text-4xl font-black">{t("TAP!")}</span>
          </>
        )}
        {state.name === "early" && (
          <>
            <span className="text-7xl" aria-hidden="true">
              🐔
            </span>
            <span className="text-2xl font-extrabold">{t(state.line)}</span>
            <span className="text-sm font-semibold opacity-80">{t("Tap to try this round again")}</span>
          </>
        )}
        {state.name === "result" && (
          <>
            <span className="text-7xl" aria-hidden="true">
              {animalFor(state.ms).emoji}
            </span>
            <span className="text-5xl font-black tabular-nums">{state.ms} ms</span>
            <span className="text-lg font-bold">{t(animalFor(state.ms).label)}</span>
            {times.length < ROUNDS ? (
              <span className="text-sm font-semibold opacity-80">{t("Tap for the next round")}</span>
            ) : (
              <span className="text-sm font-semibold opacity-80">{t("Average: {n} ms", { n: average(times) })}</span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
