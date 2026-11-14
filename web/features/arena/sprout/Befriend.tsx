"use client";

// Stage 26 · Mầm Thú: winning a wild sproutling's trust with a short game that fits its element.
//   Water: follow the ripples (tap each before it fades) · Wood: grow the shoot to the sunlight (hold, release)
//   Fire: keep the ember kitten cosy (hold to warm, let go to cool) · Earth: stack the clay pots (tap to drop)
//   Metal: ring with the bell's rhythm (tap as the ring closes)
// Each gives a score from 0 to 1; Space works as the tap on a keyboard.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { Creature } from "./Creature";
import { ELEMENT_INFO, SPECIES_NAMES } from "./names";
import { SPECIES, type Element, type SpeciesId } from "./sprout";
import { play } from "./sound";

type Game = { onDone: (score: number) => void };
const W = 320;
const H = 200;

/** Calls `tick(elapsedMs)` every frame until it returns false */
function useFrames(tick: (ms: number) => boolean | void, running: boolean) {
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      if (fn.current(now - start) === false) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}
/** Space bar: down and up */
function useSpace(down: () => void, up?: () => void) {
  const d = useRef(down);
  const u = useRef(up);
  d.current = down;
  u.current = up;
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      e.preventDefault();
      if (!e.repeat) d.current();
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") u.current?.();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);
}

function Ripples({ onDone }: Game) {
  const t = useT();
  const N = 8;
  const spots = useRef(Array.from({ length: N }, () => [30 + Math.random() * (W - 60), 30 + Math.random() * (H - 60)]));
  const [now, setNow] = useState(0);
  const [hits, setHits] = useState<boolean[]>([]);
  const done = useRef(false);
  const EACH = 1150;
  useFrames((ms) => {
    setNow(ms);
    if (ms > N * EACH + 200 && !done.current) {
      done.current = true;
      onDone(hits.filter(Boolean).length / N);
      return false;
    }
  }, true);
  const current = Math.floor(now / EACH);
  const tap = (i: number) => {
    if (i !== current || hits[i]) return;
    setHits((h) => {
      const n = [...h];
      n[i] = true;
      return n;
    });
    play("ripple");
  };
  useSpace(() => tap(current));
  return (
    <>
      <p className="text-sm">{t("Tap each ripple before it fades.")}</p>
      <div className="relative mx-auto mt-2 overflow-hidden rounded-2xl bg-sky-400/30" style={{ width: W, height: H }}>
        {spots.current.map(([x, y], i) => {
          if (i !== current) return null;
          const k = (now % EACH) / EACH;
          return (
            <button
              key={i}
              type="button"
              aria-label={t("Ripple")}
              onPointerDown={() => tap(i)}
              className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4", hits[i] ? "border-emerald-300" : "border-white")}
              style={{ left: x, top: y, width: 24 + k * 50, height: 24 + k * 50, opacity: 1 - k * 0.8 }}
            />
          );
        })}
      </div>
      <p className="mt-1 text-center text-xs text-muted">{t("{n} of {total}", { n: hits.filter(Boolean).length, total: N })}</p>
    </>
  );
}

function Shoot({ onDone }: Game) {
  const t = useT();
  const ROUNDS = 3;
  const [round, setRound] = useState(0);
  const [height, setHeight] = useState(0);
  const holding = useRef(false);
  const scores = useRef<number[]>([]);
  const target = useRef(0.55 + Math.random() * 0.3);
  const last = useRef(0);
  useFrames((ms) => {
    const dt = ms - last.current;
    last.current = ms;
    if (holding.current) setHeight((h) => Math.min(1.05, h + dt / 1100));
  }, round < ROUNDS);
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    const s = Math.max(0, 1 - Math.abs(height - target.current) / 0.2);
    scores.current.push(s);
    play(s > 0.6 ? "good" : "meh");
    setTimeout(() => {
      if (scores.current.length >= ROUNDS) return onDone(scores.current.reduce((a, b) => a + b, 0) / ROUNDS);
      setRound((r) => r + 1);
      setHeight(0);
      target.current = 0.45 + Math.random() * 0.4;
    }, 450);
  };
  useSpace(
    () => (holding.current = true),
    () => release(),
  );
  return (
    <>
      <p className="text-sm">{t("Hold to grow the shoot. Let go when it reaches the sunlight.")}</p>
      <div
        className="relative mx-auto mt-2 touch-none overflow-hidden rounded-2xl bg-linear-to-b from-amber-100 to-emerald-100 select-none dark:from-amber-900/40 dark:to-emerald-900/40"
        style={{ width: W, height: H }}
        onPointerDown={() => (holding.current = true)}
        onPointerUp={release}
        onPointerLeave={release}
      >
        <div className="absolute inset-x-0 bg-amber-300/60" style={{ bottom: `${(target.current - 0.08) * 100}%`, height: "16%" }} />
        <span className="absolute right-3 text-2xl" style={{ bottom: `${target.current * 100 - 6}%` }} aria-hidden="true">
          ☀️
        </span>
        <div className="absolute bottom-0 left-1/2 w-3 -translate-x-1/2 rounded-t-full bg-emerald-600" style={{ height: `${height * 100}%` }} />
        <div className="absolute left-1/2 h-4 w-6 -translate-x-1/2 rounded-full bg-emerald-400" style={{ bottom: `${height * 100 - 2}%` }} />
        <p className="absolute top-2 left-3 text-xs font-bold text-emerald-900 dark:text-emerald-100">{t("Round {n} of {total}", { n: round + 1, total: ROUNDS })}</p>
      </div>
    </>
  );
}

function Warmth({ onDone }: Game) {
  const t = useT();
  const LEN = 10_000;
  const [heat, setHeat] = useState(0.4);
  const [ms, setMs] = useState(0);
  const holding = useRef(false);
  const inBand = useRef(0);
  const last = useRef(0);
  const done = useRef(false);
  useFrames((now) => {
    const dt = now - last.current;
    last.current = now;
    setMs(now);
    setHeat((h) => {
      const wobble = Math.sin(now / 300) * 0.0004 * dt;
      const next = Math.max(0, Math.min(1, h + (holding.current ? 0.00045 : -0.00035) * dt + wobble));
      if (next > 0.55 && next < 0.78) inBand.current += dt;
      return next;
    });
    if (now >= LEN && !done.current) {
      done.current = true;
      onDone(Math.min(1, inBand.current / (LEN * 0.8)));
      return false;
    }
  }, true);
  useSpace(
    () => (holding.current = true),
    () => (holding.current = false),
  );
  const cosy = heat > 0.55 && heat < 0.78;
  return (
    <>
      <p className="text-sm">{t("Hold to warm it, let go to cool. Keep it in the cosy zone.")}</p>
      <div
        className="relative mx-auto mt-2 flex touch-none items-end gap-4 rounded-2xl bg-orange-100 p-4 select-none dark:bg-orange-900/30"
        style={{ width: W, height: H }}
        onPointerDown={() => (holding.current = true)}
        onPointerUp={() => (holding.current = false)}
        onPointerLeave={() => (holding.current = false)}
      >
        <div className="relative h-full w-8 overflow-hidden rounded-full bg-white/70">
          <div className="absolute inset-x-0 bg-emerald-300/70" style={{ bottom: "55%", height: "23%" }} />
          <div className="absolute inset-x-1 bottom-1 rounded-full bg-linear-to-t from-orange-500 to-rose-500" style={{ height: `${heat * 96}%` }} />
        </div>
        <div className="flex-1 text-center">
          <span className={cn("inline-block text-5xl transition", cosy ? "scale-110" : heat > 0.78 ? "-rotate-12" : "opacity-60")} aria-hidden="true">
            {cosy ? "😊" : heat > 0.78 ? "🥵" : "🥶"}
          </span>
          <p className="mt-2 text-xs font-bold">{cosy ? t("Cosy!") : heat > 0.78 ? t("Too hot!") : t("Too cold")}</p>
          <div className="mx-auto mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/60">
            <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, (ms / LEN) * 100)}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}

function Pots({ onDone }: Game) {
  const t = useT();
  const N = 5;
  const PW = 70;
  const [stack, setStack] = useState<number[]>([]); // x of each placed pot
  const [x, setX] = useState(0);
  const speed = useRef(0.17);
  const done = useRef(false);
  useFrames((ms) => {
    const span = W - PW;
    const p = (ms * speed.current) % (span * 2);
    setX(p < span ? p : span * 2 - p);
  }, stack.length < N);
  const drop = () => {
    if (stack.length >= N || done.current) return;
    const next = [...stack, x];
    setStack(next);
    speed.current += 0.04;
    play("pot");
    if (next.length === N) {
      done.current = true;
      const base = next[0];
      const score = next.slice(1).reduce((s, px) => s + Math.max(0, 1 - Math.abs(px - base) / (PW * 0.8)), 0) / (N - 1);
      setTimeout(() => onDone(score), 500);
    }
  };
  useSpace(drop);
  return (
    <>
      <p className="text-sm">{t("Tap to drop each pot. Stack them straight.")}</p>
      <div className="relative mx-auto mt-2 touch-none overflow-hidden rounded-2xl bg-amber-100 select-none dark:bg-amber-900/30" style={{ width: W, height: H }} onPointerDown={drop}>
        {stack.length < N && <div className="absolute top-2 h-6 rounded-b-xl rounded-t-md bg-[#c06a3a]" style={{ left: x, width: PW }} />}
        {stack.map((px, i) => (
          <div key={i} className="absolute h-6 rounded-b-xl rounded-t-md border-t-4 border-[#8a4a2a] bg-[#c06a3a]" style={{ left: px, width: PW, bottom: 4 + i * 26 }} />
        ))}
      </div>
    </>
  );
}

function Rhythm({ onDone }: Game) {
  const t = useT();
  const N = 8;
  const BEAT = 700;
  const LEAD = 1000;
  const [now, setNow] = useState(0);
  const scores = useRef<number[]>([]);
  const [last, setLast] = useState<string>("");
  const done = useRef(false);
  useFrames((ms) => {
    setNow(ms);
    if (ms > LEAD + N * BEAT + 400 && !done.current) {
      done.current = true;
      const all = [...scores.current, ...Array(Math.max(0, N - scores.current.length)).fill(0)];
      onDone(all.slice(0, N).reduce((a, b) => a + b, 0) / N);
      return false;
    }
  }, true);
  const tap = () => {
    const i = Math.round((now - LEAD) / BEAT);
    if (i < 0 || i >= N || scores.current[i] !== undefined) return;
    const off = Math.abs(now - (LEAD + i * BEAT));
    const s = off < 90 ? 1 : off < 200 ? 0.6 : off < 300 ? 0.25 : 0;
    scores.current[i] = s;
    setLast(s === 1 ? t("Perfect!") : s > 0.5 ? t("Good") : s > 0 ? t("Close") : t("Missed"));
    play(s > 0.5 ? "bell" : "meh");
  };
  useSpace(tap);
  const k = (((now - LEAD) % BEAT) + BEAT) % BEAT / BEAT; // 0 = on the beat
  return (
    <>
      <p className="text-sm">{t("Tap when the ring meets the bell.")}</p>
      <div className="relative mx-auto mt-2 grid touch-none place-items-center overflow-hidden rounded-2xl bg-yellow-100 select-none dark:bg-yellow-900/30" style={{ width: W, height: H }} onPointerDown={tap}>
        <span className="text-5xl" aria-hidden="true">
          🔔
        </span>
        {now > LEAD - BEAT && now < LEAD + N * BEAT && (
          <span className="pointer-events-none absolute rounded-full border-4 border-amber-500" style={{ width: 60 + (1 - k) * 120, height: 60 + (1 - k) * 120, opacity: 0.4 + k * 0.6 }} />
        )}
        <p className="absolute bottom-2 text-sm font-bold">{last}</p>
      </div>
    </>
  );
}

const GAMES: Record<Element, (p: Game) => React.ReactNode> = { water: Ripples, wood: Shoot, fire: Warmth, earth: Pots, metal: Rhythm };

export function Befriend({ species, bonus, onDone }: { species: SpeciesId; bonus: number; onDone: (score: number) => void }) {
  const t = useT();
  const [started, setStarted] = useState(false);
  const el = SPECIES[species].element;
  const G = GAMES[el];
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <Creature species={species} size={72} />
        <div>
          <p className="text-xs font-semibold text-muted uppercase">
            {ELEMENT_INFO[el].emoji} {t(ELEMENT_INFO[el].name)}
          </p>
          <h3 className="text-lg font-extrabold">{t("Win {name}'s trust", { name: t(SPECIES_NAMES[species]) })}</h3>
          {bonus > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("It already trusts you a little (+{n}%)", { n: Math.round(bonus * 100) })}</p>}
        </div>
      </div>
      <div className="mt-3">
        {started ? (
          <G onDone={onDone} />
        ) : (
          <div className="text-center">
            <Button onClick={() => setStarted(true)} autoFocus>
              {t("Ready")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
