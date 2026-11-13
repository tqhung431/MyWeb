"use client";

// Stage 23 · Ngõ Pháo: the match on screen. PixiJS draws the alley (renderer.ts, loaded only here); React draws
// the scoreboard, the 3-2-1, the round and match results, and the phone controls.
//
// Controls: arrows / WASD to walk, Space or Enter to drop a firecracker. On a phone: a joystick (4 directions)
// and a big firecracker button. Your direction goes to the server only when it changes.

import { Flame, Footprints, Loader2, Shield, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { isMuted, setMuted } from "@/features/arcade/sfx";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import type { AlleyEvent, AlleyTick } from "@/lib/api/arena";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Dir } from "./alley-move";
import { LanternHead } from "./LanternHead";
import { AWARD_NAMES } from "./names";
import type { AlleyRenderer } from "./renderer";
import { play } from "./sound";

const KEYS: Record<string, Dir> = { ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2, ArrowDown: 3, KeyS: 3, ArrowLeft: 4, KeyA: 4 };
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function GameView({ code, first, myId, isHost }: { code: string; first: AlleyTick; myId: string | null; isHost: boolean }) {
  const t = useT();
  const { socket, serverNow, ask } = useArena();
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<AlleyRenderer | null>(null);
  const [view, setView] = useState<AlleyTick>(first);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [fps, setFps] = useState(0);
  const [muted, setMute] = useState(false);
  const [, tickClock] = useState(0);
  const dir = useRef<Dir>(0);
  const held = useRef<Dir[]>([]); // keys held, newest last
  const joy = useRef<Dir>(0);
  const sent = useRef<Dir>(0);
  const lastPhase = useRef(first.phase);
  const hudKey = useRef("");
  const latest = useRef<AlleyTick>(first); // the newest update, even when the scoreboard didn't need redrawing

  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMute(isMuted());
    // On a phone the game starts below the app's header: bring it into view
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Start PixiJS (a big library: loaded only when a match starts)
  useEffect(() => {
    let cancelled = false;
    let r: AlleyRenderer | null = null;
    void import("./renderer")
      .then(({ createAlleyRenderer }) =>
        createAlleyRenderer(host.current!, {
          myId,
          serverNow,
          myDir: () => dir.current,
          onEvent: (e) => sound(e),
          onFps: setFps,
        }),
      )
      .then((made) => {
        if (cancelled) return made.destroy();
        r = made;
        renderer.current = made;
        made.push(first);
        setLoading(false);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      r?.destroy();
      renderer.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sound = (e: AlleyEvent) => {
    if (e.t === "pop") play(e.tiny ? "tiny" : "pop");
    else if (e.t === "crate") play("crate");
    else if (e.t === "power" && e.id === myId) play("power");
    else if (e.t === "out") play("out");
    else if (e.t === "lion") play("lion");
  };

  useArenaEvent<AlleyTick>("alley:tick", (v) => {
    if (v.code !== code) return;
    renderer.current?.push(v);
    if (v.phase !== lastPhase.current) {
      if (v.phase === "playing") play("go");
      if (v.phase === "matchEnd") play(v.matchWinner === myId ? "win" : "lose");
      lastPhase.current = v.phase;
    }
    // React redraws the scoreboard only when something on it changed (not 20 times a second)
    const me2 = v.players.find((p) => p.id === myId);
    const key = [
      v.phase,
      v.round,
      v.roundWinner,
      v.matchWinner,
      v.players.map((p) => `${p.score}${p.alive ? 1 : 0}${p.ghost ? 1 : 0}`).join(),
      me2 ? `${me2.bombs}${me2.fire}${me2.boots}${me2.kick}${me2.shield}${Math.ceil(me2.tinyIn / 1000)}` : "",
    ].join("|");
    if (key !== hudKey.current) {
      hudKey.current = key;
      setView(v);
    } else latest.current = v;
  });

  // The 3-2-1 and the round clock count down between server updates
  useEffect(() => {
    const id = setInterval(() => tickClock((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const countdown = view.phase === "countdown" ? Math.ceil((view.phaseEndsAt - serverNow()) / 1000) : 0;
  const lastCount = useRef(0);
  useEffect(() => {
    if (countdown > 0 && countdown !== lastCount.current) play("tick");
    lastCount.current = countdown;
  }, [countdown]);

  // Steering: send the direction to the server when it changes
  const me = view.players.find((p) => p.id === myId);
  const update = () => {
    const d = held.current.at(-1) ?? joy.current ?? 0;
    dir.current = d;
    if (d !== sent.current && socket) {
      sent.current = d;
      socket.emit("alley:input", { code, dir: d });
    }
  };
  const dropCracker = () => {
    if (!socket || !me) return;
    socket.emit("alley:drop", { code });
    play("drop");
  };
  useEffect(() => {
    if (!myId) return;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const d = KEYS[e.code];
      if (d) {
        e.preventDefault();
        if (!held.current.includes(d)) held.current.push(d);
        update();
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) dropCracker();
      }
    };
    const up = (e: KeyboardEvent) => {
      const d = KEYS[e.code];
      if (!d) return;
      held.current = held.current.filter((x) => x !== d);
      update();
    };
    const blur = () => {
      held.current = [];
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  });

  const playing = view.phase === "playing";
  const playTime = playing ? serverNow() - view.playStartedAt : 0;
  const lanternsIn = 90_000 - playTime;
  const winner = view.players.find((p) => p.id === view.roundWinner);
  const champ = view.players.find((p) => p.id === view.matchWinner);

  return (
    <div ref={top} className="mx-auto flex w-full max-w-3xl scroll-mt-3 flex-col gap-2 sm:gap-3">
      {/* Scoreboard */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {view.players.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex min-w-0 items-center gap-1 rounded-full border border-border bg-surface py-0.5 pr-2 pl-0.5 shadow-sm sm:gap-1.5 sm:pr-3",
              !p.alive && "opacity-60",
              p.id === myId && "ring-2 ring-primary",
            )}
          >
            <LanternHead color={p.color} hat={p.hat} size={26} ghost={p.ghost} />
            <span className="max-w-16 truncate text-xs font-semibold sm:max-w-24 sm:text-sm">{p.name}</span>
            <span className="text-xs tracking-tight text-amber-500 sm:text-sm" aria-label={t("{n} rounds won", { n: p.score })}>
              {"★".repeat(p.score)}
              <span className="text-muted/50">{"☆".repeat(Math.max(0, 3 - p.score))}</span>
            </span>
          </div>
        ))}
        <span className="ml-auto flex items-center gap-2 text-sm font-semibold tabular-nums">
          <span className="text-muted">{t("Round {n}", { n: view.round })}</span>
          {playing && <span className={cn(lanternsIn < 10_000 && lanternsIn > 0 && "text-rose-600 dark:text-rose-400")}>{clock(playTime)}</span>}
          <button
            type="button"
            onClick={() => {
              setMuted(!muted);
              setMute(!muted);
            }}
            aria-label={muted ? t("Sound on") : t("Sound off")}
            className="cursor-pointer rounded-full p-1 text-muted hover:text-text"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        </span>
      </div>

      {/* The alley */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-[#5a2a1e] bg-[#2a1a22] shadow-card">
        <div ref={host} className="aspect-[13/11] w-full" />
        {loading && !failed && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" aria-label={t("Loading…")} />
          </div>
        )}
        {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-white">{t("This browser can't draw the game (WebGL is off).")}</p>}
        {countdown > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span key={countdown} className="animate-pop text-8xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.4)]">
              {countdown}
            </span>
          </div>
        )}
        {playing && lanternsIn > 0 && lanternsIn < 5000 && (
          <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-lg font-extrabold text-amber-200 drop-shadow">{t("The lanterns are coming!")}</p>
        )}
        {view.phase === "roundEnd" && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 p-4 text-center text-white">
            <div>
              {winner ? <LanternHead color={winner.color} hat={winner.hat} size={88} /> : null}
              <p className="mt-2 text-3xl font-black">{winner ? t("{name} wins the round!", { name: winner.name }) : t("A draw!")}</p>
            </div>
          </div>
        )}
        {view.phase === "matchEnd" && (
          <div className="absolute inset-0 overflow-y-auto bg-black/60 p-4 text-center text-white">
            <div className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-2">
              {champ && <LanternHead color={champ.color} hat={champ.hat} size={96} />}
              <p className="text-3xl font-black">{champ ? t("{name} wins the match!", { name: champ.name }) : t("Match over")}</p>
              <ul className="mt-2 flex w-full flex-col gap-1.5 text-left text-sm">
                {view.awards.map((a) => {
                  const who = view.players.find((p) => p.id === a.id);
                  return (
                    <li key={a.award} className="flex items-center gap-2 rounded-xl bg-white/12 px-3 py-1.5">
                      <span className="font-bold text-amber-200">{t(AWARD_NAMES[a.award] ?? a.award)}</span>
                      <span className="ml-auto truncate">{who?.name}</span>
                      <span className="font-mono">{a.value}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {isHost && (
                  <Button variant="light" size="md" onClick={() => ask("alley:again", { code })}>
                    {t("Play again")}
                  </Button>
                )}
                <Link href="/arena/alley" className={buttonClasses("secondary", "md")}>
                  {t("Leave")}
                </Link>
              </div>
              {!isHost && <p className="text-xs text-white/70">{t("The host can start another match.")}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Your power-ups, and the phone controls */}
      {me && (
        <div className="flex items-center gap-3">
          <Joystick
            onDir={(d) => {
              joy.current = d;
              update();
            }}
            label={t("Walk")}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5 text-sm font-semibold">
            {me.ghost ? (
              <span className="rounded-full bg-surface-muted px-3 py-1">
                👻 {me.tinyIn > 0 ? t("Tiny cracker in {s} s", { s: Math.ceil(me.tinyIn / 1000) }) : t("Tiny cracker ready!")}
              </span>
            ) : (
              <>
                <span className="rounded-full bg-surface-muted px-2.5 py-1" title={t("Firecrackers at once")}>
                  🧨 {me.bombs}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1" title={t("Spark length")}>
                  <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" /> {me.fire}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1" title={t("Speed")}>
                  <Footprints className="h-4 w-4 text-sky-500" aria-hidden="true" /> {me.boots}
                </span>
                {me.kick && <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-violet-700 dark:text-violet-300">{t("Kick")}</span>}
                {me.shield && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                    <Shield className="h-4 w-4" aria-hidden="true" /> {t("Shield")}
                  </span>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              dropCracker();
            }}
            aria-label={t("Drop a firecracker")}
            className="grid h-20 w-20 shrink-0 cursor-pointer touch-none place-items-center rounded-full bg-linear-to-br from-red-500 to-red-700 text-4xl shadow-lg ring-4 ring-amber-300/60 select-none active:scale-95 [@media(pointer:fine)]:h-14 [@media(pointer:fine)]:w-14 [@media(pointer:fine)]:text-2xl"
          >
            🧨
          </button>
        </div>
      )}
      <p className="text-center text-xs text-muted">
        {myId && me ? t("Arrows or WASD to walk · Space to drop a firecracker") : t("You're watching this match.")}
        {fps > 0 && <span className="ml-2 tabular-nums">· {fps} fps</span>}
      </p>
    </div>
  );
}

/** A 4-direction joystick for touch screens (the strongest push wins: up, right, down or left) */
function Joystick({ onDir, label }: { onDir: (d: Dir) => void; label: string }) {
  const [touch, setTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setTouch(mq.matches);
  }, []);
  if (!touch) return <span className="w-20 shrink-0" />;
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    const box = base.current!.getBoundingClientRect();
    let dx = e.clientX - (box.left + box.width / 2);
    let dy = e.clientY - (box.top + box.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 34) {
      dx = (dx / len) * 34;
      dy = (dy / len) * 34;
    }
    setKnob({ x: dx, y: dy });
    onDir(len < 12 ? 0 : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : dy > 0 ? 3 : 1);
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    onDir(0);
  };
  return (
    <div
      ref={base}
      role="application"
      aria-label={label}
      className="relative h-24 w-24 shrink-0 touch-none rounded-full bg-surface-muted ring-1 ring-border select-none"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        base.current!.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="absolute top-1/2 left-1/2 h-11 w-11 rounded-full bg-primary shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}
