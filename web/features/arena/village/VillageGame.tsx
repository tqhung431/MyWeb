"use client";

// Stage 24 · Giữ Làng: the game on screen, the same for solo (rules running in this browser) and co-op (rules on the
// game server). PixiJS draws the map (renderer.ts, loaded only here); React draws the numbers and the build menu.
//
// Tap a free spot by the path → pick a defender. Tap a defender → upgrade (pick one of two ways first) or sell.

import { Coins, FastForward, Loader2, Pause, Play, Volume2, VolumeX, Wheat } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { isMuted, setMuted } from "@/features/arcade/sfx";
import { play } from "@/features/arena/alley/sound";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { TOWER_INFO, SPIRIT_NAMES } from "./names";
import type { Selection, VillageRenderer } from "./renderer";
import { buildSpots, stats, START_RICE, TOWER_COST, TOWER_KINDS, upgradeCost, WAVES, waveGroups, type Branch, type VillageAction, type VillageView } from "./village";

/** Views arrive here (from the local game or the server); the canvas gets every one, React only what it needs */
export class ViewFeed {
  latest: VillageView | null = null;
  private fns = new Set<(v: VillageView) => void>();
  push(v: VillageView) {
    this.latest = v;
    for (const f of this.fns) f(v);
  }
  subscribe(f: (v: VillageView) => void) {
    this.fns.add(f);
    return () => void this.fns.delete(f);
  }
}

type Props = {
  feed: ViewFeed;
  myId: string | null;
  act: (action: VillageAction) => Promise<string | null>;
  speed: 1 | 2;
  paused: boolean;
  /** Can this person change the speed and pause? (solo: yes; co-op: the host) */
  canControl: boolean;
  setSpeed: (s: 1 | 2) => void;
  setPaused: (p: boolean) => void;
  /** Shown on the "won / lost" screen */
  endActions: ReactNode;
};

export function VillageGame({ feed, myId, act, speed, paused, canControl, setSpeed, setPaused, endActions }: Props) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<VillageRenderer | null>(null);
  const [view, setView] = useState<VillageView | null>(feed.latest);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<{ tx: number; ty: number } | null>(null);
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [muted, setMute] = useState(false);
  const lastSound = useRef(0);
  const hudKey = useRef("");

  useEffect(() => setMute(isMuted()), []);

  // Start PixiJS, then hand it every view
  useEffect(() => {
    let cancelled = false;
    let r: VillageRenderer | null = null;
    void import("./renderer")
      .then(({ createVillageRenderer }) => createVillageRenderer(host.current!, { onTap: (tx, ty) => setSelected({ tx, ty }), onFps: setFps }))
      .then((made) => {
        if (cancelled) return made.destroy();
        r = made;
        renderer.current = made;
        if (feed.latest) made.push(feed.latest);
        setLoading(false);
      })
      .catch(() => setFailed(true));
    const off = feed.subscribe((v) => {
      renderer.current?.push(v);
      for (const e of v.events) {
        const now = performance.now();
        if (e.t === "wave") play("go");
        else if (e.t === "cleared") play("power");
        else if (e.t === "steal") play("out");
        else if (e.t === "pop" && now - lastSound.current > 150) {
          lastSound.current = now;
          play("tiny");
        }
      }
      // React redraws only when a number on screen changes
      const me = myId ? v.coins[myId] : 0;
      const key = [v.phase, v.wave, v.cleared, v.rice, me, Math.ceil(v.buildLeft / 1000), v.remaining, v.towers.map((x) => `${x.id}${x.level}`).join()].join("|");
      if (key !== hudKey.current) {
        hudKey.current = key;
        setView(v);
      }
    });
    return () => {
      cancelled = true;
      off();
      r?.destroy();
      renderer.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const me = view?.players.find((p) => p.id === myId) ?? null;
  const mySide = me?.side ?? null;
  useEffect(() => renderer.current?.setSide(mySide), [mySide, loading]);

  const spots = useMemo(() => (view ? buildSpots(view.map) : []), [view?.map]); // eslint-disable-line react-hooks/exhaustive-deps
  const tower = selected && view ? view.towers.find((x) => x.tx === selected.tx && x.ty === selected.ty) : undefined;
  const spot = selected ? spots.find((s) => s.tx === selected.tx && s.ty === selected.ty) : undefined;
  const mineSpot = !!spot && (mySide === null || spot.side === mySide);

  // Show the selection (and the reach of the defender) on the map
  useEffect(() => {
    let sel: Selection = null;
    if (selected && (tower || spot)) {
      const range = tower ? (((stats(tower.kind, tower.level, tower.branch) as { range?: number }).range ?? null) as number | null) : null;
      sel = { ...selected, range, mine: tower ? tower.owner === myId : mineSpot };
    }
    renderer.current?.select(sel);
  }, [selected, tower, spot, mineSpot, myId]);

  // Keyboard: Space calls the next wave, Escape closes the menu, P pauses
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Escape") setSelected(null);
      else if (e.code === "Space" && view?.phase === "build") {
        e.preventDefault();
        void doAct({ a: "next" });
      } else if (e.code === "KeyP" && canControl) setPaused(!paused);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const doAct = async (action: VillageAction) => {
    const err = await act(action);
    setError(err ? t(err) : "");
    if (!err) {
      if (action.a === "build") play("drop");
      if (action.a === "upgrade") play("power");
      if (action.a === "sell") setSelected(null);
    }
    return err;
  };

  if (!view) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;
  const coins = myId ? (view.coins[myId] ?? 0) : 0;
  const over = view.phase === "won" || view.phase === "lost";
  const nextWave = view.phase === "build" ? waveGroups(view.cleared + 1) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 sm:gap-3">
      {/* numbers */}
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className={cn("inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 shadow-sm ring-1 ring-border", view.rice <= 5 && "text-rose-600 dark:text-rose-400")}>
          <Wheat className="h-4 w-4 text-amber-500" aria-hidden="true" /> {view.rice}/{START_RICE}
        </span>
        {me && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 shadow-sm ring-1 ring-border">
            <Coins className="h-4 w-4 text-amber-500" aria-hidden="true" /> {coins}
          </span>
        )}
        <span className="rounded-full bg-surface px-3 py-1 shadow-sm ring-1 ring-border">
          {view.endless ? t("Wave {n}", { n: Math.max(1, view.wave) }) : t("Wave {n}/{total}", { n: Math.max(1, view.wave), total: WAVES })}
        </span>
        {view.phase === "wave" && <span className="text-muted">{t("{n} spirits left", { n: view.remaining })}</span>}
        {view.phase === "build" && me && (
          <Button size="sm" variant="primary" onClick={() => doAct({ a: "next" })}>
            {t("Next wave in {s} s", { s: Math.ceil(view.buildLeft / 1000) })} · +{Math.floor(view.buildLeft / 1000)} 🪙
          </Button>
        )}
        <span className="ml-auto flex items-center gap-1">
          {canControl && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setPaused(!paused)} aria-label={paused ? t("Play") : t("Pause")}>
                {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <Button size="sm" variant={speed === 2 ? "primary" : "secondary"} onClick={() => setSpeed(speed === 2 ? 1 : 2)} aria-label={t("Speed ×{n}", { n: speed === 2 ? 1 : 2 })}>
                <FastForward className="h-4 w-4" aria-hidden="true" /> ×{speed}
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setMuted(!muted);
              setMute(!muted);
            }}
            aria-label={muted ? t("Sound on") : t("Sound off")}
            className="cursor-pointer rounded-full p-1.5 text-muted hover:text-text"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        </span>
      </div>

      {/* the map */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-[#6e4a24] bg-[#2a2440] shadow-card">
        <div ref={host} className="aspect-[16/10] w-full" />
        {loading && !failed && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" aria-label={t("Loading…")} />
          </div>
        )}
        {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-white">{t("This browser can't draw the game (WebGL is off).")}</p>}
        {paused && !over && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-2xl font-black text-white drop-shadow">{t("Paused")}</p>}
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 text-center text-white">
            <div className="flex max-w-sm flex-col items-center gap-2">
              <p className="text-4xl" aria-hidden="true">
                {view.phase === "won" ? "🏮" : "🌾"}
              </p>
              <p className="text-2xl font-black sm:text-3xl">{view.phase === "won" ? t("The village is safe!") : t("The spirits took the rice")}</p>
              <p className="text-white/85">{t("{waves} waves · {rice} sacks of rice left · score {score}", { waves: view.cleared, rice: view.rice, score: view.score })}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">{endActions}</div>
            </div>
          </div>
        )}
      </div>

      {/* what you can do */}
      {me && !over && (
        <div className="min-h-32 rounded-3xl border border-border bg-surface p-3 shadow-card sm:p-4">
          {tower ? (
            <TowerPanel
              tower={tower}
              mine={tower.owner === myId}
              owner={view.players.find((p) => p.id === tower.owner)?.name ?? ""}
              coins={coins}
              onAct={doAct}
              onClose={() => setSelected(null)}
            />
          ) : spot && mineSpot ? (
            <div>
              <p className="mb-2 text-sm font-bold">{t("Build a defender here")}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {TOWER_KINDS.map((kind) => {
                  const info = TOWER_INFO[kind];
                  const cost = TOWER_COST[kind];
                  return (
                    <button
                      key={kind}
                      type="button"
                      disabled={coins < cost}
                      onClick={() => doAct({ a: "build", tx: spot.tx, ty: spot.ty, kind })}
                      className="flex cursor-pointer flex-col items-start gap-0.5 rounded-2xl border border-border p-2.5 text-left transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="flex w-full items-center gap-1.5 text-sm font-bold">
                        <span aria-hidden="true">{info.emoji}</span> {t(info.name)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Coins className="h-3 w-3" aria-hidden="true" /> {cost}
                      </span>
                      <span className="text-xs text-muted">{t(info.about)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 text-sm">
                {spot && !mineSpot ? (
                  <p className="font-semibold">{t("That's your partner's side.")}</p>
                ) : (
                  <p className="text-muted">{t("Tap a free spot beside the path to build. Tap a defender to upgrade it.")}</p>
                )}
                {nextWave && (
                  <p className="mt-1 text-xs text-muted">
                    {t("Next")}: {nextWave.map((gr) => `${gr.count}× ${t(SPIRIT_NAMES[gr.kind])}`).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>
      )}
      <p className="text-center text-xs text-muted">
        <span className="[@media(pointer:coarse)]:hidden">{t("Space: next wave · P: pause · Esc: close")}</span>
        {fps > 0 && <span className="ml-2 tabular-nums">· {fps} fps</span>}
      </p>
    </div>
  );
}

function TowerPanel({
  tower,
  mine,
  owner,
  coins,
  onAct,
  onClose,
}: {
  tower: VillageView["towers"][number];
  mine: boolean;
  owner: string;
  coins: number;
  onAct: (a: VillageAction) => Promise<string | null>;
  onClose: () => void;
}) {
  const t = useT();
  const info = TOWER_INFO[tower.kind];
  const cost = tower.level < 3 ? upgradeCost(tower.kind, tower.level) : 0;
  const upgrade = (branch?: Branch) => onAct({ a: "upgrade", id: tower.id, ...(branch && { branch }) });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {info.emoji}
        </span>
        <p className="font-bold">{t(info.name)}</p>
        <span className="text-sm text-amber-500" aria-label={t("Level {n}", { n: tower.level })}>
          {"★".repeat(tower.level)}
          <span className="text-muted/40">{"☆".repeat(3 - tower.level)}</span>
        </span>
        {tower.branch && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold">{t(info.branches[tower.branch])}</span>}
        <button type="button" onClick={onClose} className="ml-auto cursor-pointer text-sm text-muted hover:text-text">
          {t("Close")}
        </button>
      </div>
      {!mine ? (
        <p className="text-sm text-muted">{t("{name}'s defender", { name: owner })}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tower.level === 1 &&
            (["a", "b"] as Branch[]).map((b) => (
              <Button key={b} size="sm" variant="primary" disabled={coins < cost} onClick={() => upgrade(b)}>
                {t(info.branches[b])} · {cost} 🪙
              </Button>
            ))}
          {tower.level === 2 && (
            <Button size="sm" variant="primary" disabled={coins < cost} onClick={() => upgrade()}>
              {t("Upgrade")} {t(info.branches[tower.branch!])} ★★★ · {cost} 🪙
            </Button>
          )}
          {tower.level === 3 && <span className="self-center text-sm text-muted">{t("Fully upgraded")}</span>}
          <Button size="sm" variant="secondary" onClick={() => onAct({ a: "sell", id: tower.id })}>
            {t("Sell")} · +{Math.floor(tower.spent * 0.7)} 🪙
          </Button>
        </div>
      )}
    </div>
  );
}
