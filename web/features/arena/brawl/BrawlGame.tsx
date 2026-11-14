"use client";

// Stage 25 · Chợ Đêm Brawl: the run on screen. PixiJS draws the market (renderer.ts, loaded only here); React draws
// the heroes' health and specials, the wave banner, the shop between areas and the end screen.
//
// Controls: WASD / arrows to walk, J (or Space) to attack, K (or Shift) to dodge, L (or E) for the special.
// A gamepad works too (left stick, A attack, B dodge, X/Y special). On a phone: a stick on the left, three buttons
// on the right. The stick goes to the server about 15 times a second, only when it changed.

import { Loader2, Shield, Sparkles, Swords, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { isMuted, setMuted } from "@/features/arcade/sfx";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { AREAS, SHOP, SPECIAL_FULL, WAVES_PER_AREA, type BrawlAction, type BrawlEvent, type Buff } from "./brawl";
import { AREA_NAMES, BUFF_INFO, ENEMY_NAMES, HERO_INFO } from "./names";
import type { BrawlRenderer, BrawlTick } from "./renderer";
import { play } from "./sound";

const KEYS: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Stick({ onMove, label }: { onMove: (x: number, y: number) => void; label: string }) {
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 44;
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    const box = base.current!.getBoundingClientRect();
    let dx = e.clientX - (box.left + box.width / 2);
    let dy = e.clientY - (box.top + box.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > R) [dx, dy] = [(dx / l) * R, (dy / l) * R];
    setKnob({ x: dx, y: dy });
    const m = Math.hypot(dx, dy) < 8 ? [0, 0] : [dx / R, dy / R];
    onMove(m[0], m[1]);
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      ref={base}
      role="application"
      aria-label={label}
      className="relative h-36 w-36 shrink-0 touch-none rounded-full border-2 border-border bg-surface-muted select-none"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full bg-primary/80 shadow-lg" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

export function BrawlGame({ code, first, myId, endActions }: { code: string; first: BrawlTick; myId: string | null; endActions: ReactNode }) {
  const t = useT();
  const { socket, serverNow, ask } = useArena();
  const host = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const renderer = useRef<BrawlRenderer | null>(null);
  const [view, setView] = useState<BrawlTick>(first);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [muted, setMute] = useState(false);
  const [touch, setTouch] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [, tickClock] = useState(0);
  const [error, setError] = useState("");
  const stick = useRef<[number, number]>([0, 0]);
  const held = useRef(new Set<string>());
  const touchStick = useRef<[number, number]>([0, 0]);
  const padStick = useRef<[number, number]>([0, 0]);
  const sent = useRef<[number, number]>([0, 0]);
  const hudKey = useRef("");
  const lastPhase = useRef(first.phase);

  useEffect(() => {
    setMute(isMuted());
    setTouch(window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // PixiJS: a big library, loaded only when a run starts
  useEffect(() => {
    let cancelled = false;
    let r: BrawlRenderer | null = null;
    void import("./renderer")
      .then(({ createBrawlRenderer }) => createBrawlRenderer(host.current!, { myId, serverNow, myStick: () => stick.current, onEvent: sound }))
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

  const showBanner = (text: string) => {
    setBanner(text);
    setTimeout(() => setBanner((b) => (b === text ? null : b)), 2200);
  };
  const sound = (e: BrawlEvent) => {
    if (e.t === "swing" && e.id === myId) play("swing");
    else if (e.t === "bonk") play("bonk");
    else if (e.t === "away") play("away");
    else if (e.t === "hurt" && e.id === myId) play("hurt");
    else if (e.t === "down") play("down");
    else if (e.t === "up") play("up");
    else if (e.t === "special") play("special");
    else if (e.t === "heal" && e.id === myId) play("heal");
    else if (e.t === "dodge" && e.id === myId) play("dodge");
    else if (e.t === "pop") play("pop");
    else if (e.t === "wave") {
      play("wave");
      showBanner(e.wave === 0 ? t(AREA_NAMES[e.area]) : t("Wave {n}", { n: e.wave + 1 }));
    } else if (e.t === "boss") {
      play("boss");
      showBanner(t("{name} is here!", { name: t(ENEMY_NAMES[e.kind]) }));
    }
  };

  useArenaEvent<BrawlTick>("brawl:tick", (v) => {
    if (v.code !== code) return;
    renderer.current?.push(v);
    if (v.phase !== lastPhase.current) {
      if (v.phase === "won") play("win");
      if (v.phase === "lost") play("lose");
      lastPhase.current = v.phase;
    }
    // React redraws the panel only when something on it changed (not 20 times a second)
    const key = [v.phase, v.area, v.wave, v.enemies.length, v.heroes.map((h) => `${h.hp}/${h.maxHp}${h.down ? 1 : 0}${Math.floor(h.special / 5)}${h.coins}${h.ready ? 1 : 0}${h.bonks}`).join(), Math.ceil((v.phaseUntil - v.t) / 1000)].join("|");
    if (key !== hudKey.current) {
      hudKey.current = key;
      setView(v);
    }
  });
  useEffect(() => {
    const id = setInterval(() => tickClock((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const me = view.heroes.find((h) => h.id === myId);
  const playing = !!me && (view.phase === "fight" || view.phase === "pause");

  // The stick: keys, phone stick or gamepad, whichever is pushed
  const updateStick = () => {
    let kx = 0;
    let ky = 0;
    for (const code2 of held.current) {
      const d = KEYS[code2];
      if (d) [kx, ky] = [kx + d[0], ky + d[1]];
    }
    let [x, y] = kx || ky ? [kx, ky] : touchStick.current[0] || touchStick.current[1] ? touchStick.current : padStick.current;
    const l = Math.hypot(x, y);
    if (l > 1) [x, y] = [x / l, y / l];
    stick.current = [x, y];
  };
  const doAct = (action: BrawlAction) => {
    if (!socket || !me) return;
    socket.emit("brawl:act", { code, action }, (a: { ok: boolean; error?: string }) => {
      if (!a?.ok && action.a !== "attack" && action.a !== "dodge" && action.a !== "special") setError(t(a?.error ?? "That didn't work"));
    });
  };
  // Send the stick ~15 times a second, only when it changed
  useEffect(() => {
    if (!myId) return;
    const id = setInterval(() => {
      const [x, y] = stick.current;
      const [sx, sy] = sent.current;
      if (Math.abs(x - sx) > 0.05 || Math.abs(y - sy) > 0.05 || ((x === 0) !== (sx === 0) || (y === 0) !== (sy === 0))) {
        sent.current = [x, y];
        socket?.emit("brawl:stick", { code, mx: Math.round(x * 100) / 100, my: Math.round(y * 100) / 100 });
      }
    }, 66);
    return () => clearInterval(id);
  }, [socket, code, myId]);

  // Keyboard
  useEffect(() => {
    if (!myId) return;
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (KEYS[e.code]) {
        e.preventDefault();
        held.current.add(e.code);
        updateStick();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyJ" || e.code === "Space") (e.preventDefault(), doAct({ a: "attack" }));
      else if (e.code === "KeyK" || e.code === "ShiftLeft" || e.code === "ShiftRight") (e.preventDefault(), doAct({ a: "dodge" }));
      else if (e.code === "KeyL" || e.code === "KeyE") (e.preventDefault(), doAct({ a: "special" }));
    };
    const up = (e: KeyboardEvent) => {
      if (held.current.delete(e.code)) updateStick();
    };
    const blur = () => {
      held.current.clear();
      updateStick();
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

  // Gamepad (checked every frame while one is connected)
  const actRef = useRef(doAct);
  actRef.current = doAct;
  useEffect(() => {
    if (!myId) return;
    let raf = 0;
    const was: boolean[] = [];
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((p) => p);
      if (!pad) return;
      const [ax = 0, ay = 0] = pad.axes;
      padStick.current = Math.hypot(ax, ay) < 0.2 ? [0, 0] : [ax, ay];
      if (pad.buttons[12]?.pressed || pad.buttons[13]?.pressed || pad.buttons[14]?.pressed || pad.buttons[15]?.pressed)
        padStick.current = [(pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0), (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0)];
      updateStick();
      const press = (i: number, action: BrawlAction) => {
        const now = !!pad.buttons[i]?.pressed;
        if (now && !was[i]) actRef.current(action);
        was[i] = now;
      };
      press(0, { a: "attack" });
      press(1, { a: "dodge" });
      press(2, { a: "special" });
      press(3, { a: "special" });
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (buff: Buff) => {
    setError("");
    const a = await ask("brawl:act", { code, action: { a: "buy", buff } });
    if (a.ok) play("coin");
    else setError(t(a.error ?? "That didn't work"));
  };
  const ready = () => void ask("brawl:act", { code, action: { a: "ready" } });

  const now = serverNow();
  const elapsed = (view.result?.timeMs ?? view.t - view.startedAt) + (view.result ? 0 : Math.max(0, now - view.t));
  const boss = view.enemies.find((e) => e.kind === "umbrellaBoss" || e.kind === "karaokeKing");
  const over = view.phase === "won" || view.phase === "lost";

  return (
    <div ref={top} className="mx-auto flex w-full max-w-4xl scroll-mt-3 flex-col gap-2 sm:gap-3">
      {/* Heroes: health, special, coins */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {view.heroes.map((h) => (
          <div key={h.id} className={cn("flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-surface p-1.5 shadow-sm sm:p-2", h.id === myId && "ring-2 ring-primary", h.down && "opacity-70")}>
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-linear-to-br text-lg", HERO_INFO[h.hero].color)} aria-hidden="true">
              {h.down ? "💫" : HERO_INFO[h.hero].emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold sm:text-sm">{h.name}</p>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="meter" aria-label={t("Health")} aria-valuenow={h.hp} aria-valuemin={0} aria-valuemax={h.maxHp}>
                <div className={cn("h-full rounded-full transition-all", h.hp / h.maxHp < 0.3 ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${(100 * h.hp) / h.maxHp}%` }} />
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="meter" aria-label={t("Special")} aria-valuenow={h.special} aria-valuemin={0} aria-valuemax={SPECIAL_FULL}>
                <div className={cn("h-full rounded-full", h.special >= SPECIAL_FULL ? "animate-pulse bg-amber-400" : "bg-sky-500")} style={{ width: `${h.special}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
        <span className="truncate">
          {t(AREA_NAMES[view.area] ?? "")} <span className="text-muted">· {t("Area {n} of {total}", { n: Math.min(view.area + 1, AREAS.length), total: AREAS.length })} · {t("Wave {n}", { n: Math.min(view.wave + 1, WAVES_PER_AREA) })}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {me && <span aria-label={t("Coins")}>🪙 {me.coins}</span>}
          <span className="text-muted">{clock(elapsed)}</span>
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

      {/* The market */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-[#3a2440] bg-[#1a1428] shadow-card">
        <div ref={host} className="aspect-[5/3] w-full" />
        {loading && !failed && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" aria-label={t("Loading…")} />
          </div>
        )}
        {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-white">{t("This browser can't draw the game (WebGL is off).")}</p>}
        {boss && (
          <div className="pointer-events-none absolute inset-x-6 top-2 sm:inset-x-16">
            <p className="text-center text-xs font-extrabold text-white drop-shadow sm:text-sm">{t(ENEMY_NAMES[boss.kind])}</p>
            <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-black/50 sm:h-2.5">
              <div className="h-full bg-linear-to-r from-rose-500 to-fuchsia-500 transition-all" style={{ width: `${(100 * boss.hp) / boss.maxHp}%` }} />
            </div>
          </div>
        )}
        {banner && !over && view.phase !== "shop" && (
          <p key={banner} className="pointer-events-none absolute inset-x-0 top-1/3 animate-pop text-center text-3xl font-black text-amber-200 drop-shadow-[0_3px_0_rgba(0,0,0,0.5)] sm:text-5xl">
            {banner}
          </p>
        )}
        {me?.down && view.phase === "fight" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-bold text-white drop-shadow sm:text-base">{t("You're down! A friend can help you up by standing next to you.")}</p>
        )}

        {/* The shop between areas */}
        {view.phase === "shop" && (
          <div className="bg-[#1a1428] p-3 text-white sm:absolute sm:inset-0 sm:overflow-y-auto sm:bg-[#1a1428]/85 sm:p-6">
            <p className="text-center text-xs font-semibold tracking-wide text-amber-200 uppercase">{t("Area cleared!")}</p>
            <h3 className="text-center text-xl font-black sm:text-2xl">{t("Snack stall")}</h3>
            <p className="text-center text-sm text-white/80">{t("Spend your coins, then press Ready. Next: {area}", { area: t(AREA_NAMES[view.area + 1] ?? "") })}</p>
            <div className="mx-auto mt-3 grid max-w-xl grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {(Object.keys(SHOP) as Buff[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  disabled={!me || me.coins < SHOP[b].cost || me.ready}
                  onClick={() => buy(b)}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white/10 p-2 text-left transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45 sm:p-3"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {BUFF_INFO[b].emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">
                      {BUFF_INFO[b].name} · 🪙 {SHOP[b].cost}
                    </span>
                    <span className="block text-xs text-white/75">{t(BUFF_INFO[b].what)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {me && (
                <Button variant="light" onClick={ready} disabled={me.ready}>
                  {me.ready ? t("Waiting for the others…") : t("Ready")}
                </Button>
              )}
              <span className="text-xs text-white/70">
                {t("{n} of {total} ready", { n: view.heroes.filter((h) => h.ready).length, total: view.heroes.length })}
              </span>
            </div>
            {error && <p className="mt-2 text-center text-sm text-amber-200">{error}</p>}
          </div>
        )}

        {/* The end */}
        {over && view.result && (
          <div className="bg-[#1a1428] p-4 text-center text-white sm:absolute sm:inset-0 sm:overflow-y-auto sm:bg-black/65">
            <p className="text-5xl" aria-hidden="true">
              {view.phase === "won" ? "🏮🎉" : "💫"}
            </p>
            <h3 className="mt-1 text-2xl font-black sm:text-3xl">{view.phase === "won" ? t("The night market is safe!") : t("The trouble-makers won this time")}</h3>
            <p className="mt-1 text-sm text-white/85">
              {t("Areas cleared: {n} of {total}", { n: view.result.areas, total: AREAS.length })} · {clock(view.result.timeMs)} · {t("{n} bonks", { n: view.result.bonks })}
            </p>
            <ul className="mx-auto mt-3 flex max-w-sm flex-col gap-1 text-sm">
              {[...view.heroes]
                .sort((x, y) => y.bonks - x.bonks)
                .map((h) => (
                  <li key={h.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5">
                    <span aria-hidden="true">{HERO_INFO[h.hero].emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-left font-semibold">{h.name}</span>
                    <span className="text-white/80">{t("{n} bonks", { n: h.bonks })}</span>
                  </li>
                ))}
            </ul>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{endActions}</div>
          </div>
        )}

      </div>
      {/* Phone controls, under the market (so they don't cover it) */}
      {touch && playing && (
        <div className="flex items-center justify-between gap-3 px-1 pt-1 pb-6">
          <Stick
            label={t("Walk")}
            onMove={(x, y) => {
              touchStick.current = [x, y];
              updateStick();
            }}
          />
          <div className="grid grid-cols-[auto_auto] items-end gap-2">
            <button type="button" onPointerDown={() => doAct({ a: "special" })} disabled={!me || me.special < SPECIAL_FULL} aria-label={t("Special")} className="col-span-2 ml-auto grid h-14 w-14 touch-none place-items-center rounded-full bg-amber-400 text-amber-950 shadow-lg select-none disabled:opacity-40">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </button>
            <button type="button" onPointerDown={() => doAct({ a: "dodge" })} aria-label={t("Dodge")} className="grid h-16 w-16 touch-none place-items-center rounded-full bg-sky-500 text-white shadow-lg select-none">
              <Shield className="h-7 w-7" aria-hidden="true" />
            </button>
            <button type="button" onPointerDown={() => doAct({ a: "attack" })} aria-label={t("Attack")} className="grid h-20 w-20 touch-none place-items-center rounded-full bg-rose-500 text-white shadow-lg select-none">
              <Swords className="h-8 w-8" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {!touch && me && <p className="text-center text-xs text-muted">{t("WASD or arrows: walk · J or Space: attack · K or Shift: dodge · L or E: special · a gamepad works too")}</p>}
      {!me && <p className="text-center text-sm text-muted">{t("You're watching.")}</p>}
    </div>
  );
}
