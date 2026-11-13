"use client";

// Stage 23 · Ngõ Pháo: one room. Before the match: seats, your colour and hat, ready, and (for the host) bots, map
// and Start. During the match: the game (GameView). The server sends the room ("room:state") when it changes,
// and the match ("alley:tick") 20 times a second.

import { Bot, Check, Copy, Crown, Loader2, Minus, Play, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useArena, useArenaEvent, useArenaRoom } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import type { AlleyMap, AlleyRoomState, AlleyTick } from "@/lib/api/arena";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { GameView } from "./GameView";
import { LanternHead } from "./LanternHead";
import { COLOR_LABELS, HAT_LABELS, MAP_NAMES } from "./names";

const MAPS: (AlleyMap | "random")[] = ["random", "old-town", "market", "rooftops"];

export function AlleyRoom({ code }: { code: string }) {
  const t = useT();
  const { user } = useMe();
  const { ask } = useArena();
  const [room, setRoom] = useState<AlleyRoomState | null>(null);
  const [first, setFirst] = useState<AlleyTick | null>(null); // the first update of a match (GameView takes over)
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useArenaRoom(code, setError);
  useArenaEvent<AlleyRoomState>("room:state", (s) => {
    if (s.code !== code || s.kind !== "alley") return;
    setRoom(s);
    if (!s.alley.playing) setFirst(null);
  });
  useArenaEvent<AlleyTick>("alley:tick", (v) => {
    if (v.code === code && !first) setFirst(v);
  });

  if (!user && !room) return <NeedName why={t("Pick a name to play. Without one you can only watch.")} />;
  if (!room) {
    return (
      <div className="flex items-center gap-2 text-muted">
        {error ? (
          <>
            <X className="h-4 w-4" aria-hidden="true" /> {error}{" "}
            <Link href="/arena/alley" className="font-semibold text-primary">
              {t("Back")}
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("Joining…")}
          </>
        )}
      </div>
    );
  }

  const L = room.alley;
  const isHost = user?.id === L.hostId;
  if (L.playing && first) return <GameView code={code} first={first} myId={user?.id ?? null} isHost={isHost} />;
  if (L.playing) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;

  const send = async (event: string, payload: object = {}) => {
    const a = await ask(event, { code, ...payload });
    setError(a.ok ? "" : (a.error ?? t("That didn't work")));
  };
  const mine = L.seats.find((s) => s.id === user?.id);
  const others = L.seats.filter((s) => s.id !== L.hostId);
  const allReady = others.every((s) => s.ready);
  const total = L.seats.length + L.bots;
  const copy = async () => {
    await navigator.clipboard?.writeText(`${location.origin}/arena/alley/${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className="rounded-3xl bg-linear-to-br from-red-900 via-rose-800 to-amber-700 p-5 text-white shadow-card sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-amber-200 uppercase">Ngõ Pháo · {t("Room code")}</p>
              <p className="font-mono text-3xl font-extrabold tracking-[0.25em]">{code}</p>
            </div>
            <Button variant="light" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? t("Copied") : t("Invite")}
            </Button>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => {
              const s = L.seats[i];
              const bot = !s && i - L.seats.length < L.bots;
              return (
                <li key={i} className={cn("flex flex-col items-center gap-1 rounded-2xl p-3 text-center", s || bot ? "bg-white/15" : "border-2 border-dashed border-white/25")}>
                  {s ? (
                    <>
                      <LanternHead color={s.color} hat={s.hat} size={64} />
                      <span className="flex max-w-full items-center gap-1 truncate text-sm font-bold">
                        {s.id === L.hostId && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label={t("Host")} />}
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.id === L.hostId || s.ready ? "bg-emerald-400/90 text-emerald-950" : "bg-white/20")}>
                        {s.id === L.hostId ? t("Host") : s.ready ? t("Ready") : t("Not ready")}
                      </span>
                    </>
                  ) : bot ? (
                    <>
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15">
                        <Bot className="h-8 w-8" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-bold">{t("Bot")}</span>
                    </>
                  ) : (
                    <span className="grid h-[104px] place-items-center text-sm text-white/70">{t("Free seat")}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {isHost ? (
              <Button variant="light" size="md" onClick={() => send("alley:start")} disabled={total < 2 || !allReady}>
                <Play className="h-4 w-4" aria-hidden="true" /> {t("Start the match")}
              </Button>
            ) : mine ? (
              <Button variant="light" size="md" onClick={() => send("alley:ready", { ready: !mine.ready })}>
                <Check className="h-4 w-4" aria-hidden="true" /> {mine.ready ? t("Not ready") : t("I'm ready")}
              </Button>
            ) : (
              <p className="text-sm text-white/85">{t("The room is full. You're watching.")}</p>
            )}
            {isHost && total < 2 && <p className="text-sm text-white/85">{t("Add a bot or wait for a friend")}</p>}
            {isHost && total >= 2 && !allReady && <p className="text-sm text-white/85">{t("Waiting for everyone to be ready…")}</p>}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-amber-100">
              {error}
            </p>
          )}
        </section>

        {mine && (
          <Card>
            <CardHeader title={t("Your lantern-head")} />
            <p className="mb-2 text-sm font-semibold">{t("Colour")}</p>
            <div role="radiogroup" aria-label={t("Colour")} className="flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((c) => {
                const taken = L.seats.some((s) => s.id !== mine.id && s.color === c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={mine.color === c}
                    aria-label={t(COLOR_LABELS[c])}
                    disabled={taken}
                    onClick={() => send("alley:look", { color: c, hat: mine.hat })}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 p-1 transition disabled:cursor-not-allowed disabled:opacity-30",
                      mine.color === c ? "border-primary bg-primary/10" : "border-transparent hover:border-border",
                    )}
                  >
                    <LanternHead color={c} hat={mine.hat} size={52} />
                  </button>
                );
              })}
            </div>
            <p className="mt-4 mb-2 text-sm font-semibold">{t("Hat")}</p>
            <div role="radiogroup" aria-label={t("Hat")} className="flex flex-wrap gap-2">
              {HAT_LABELS.map((label, h) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={mine.hat === h}
                  onClick={() => send("alley:look", { color: mine.color, hat: h })}
                  className={cn(
                    "flex cursor-pointer flex-col items-center rounded-2xl border-2 px-1 pt-1 pb-1.5 text-xs font-semibold transition",
                    mine.hat === h ? "border-primary bg-primary/10" : "border-transparent hover:border-border",
                  )}
                >
                  <LanternHead color={mine.color} hat={h} size={48} />
                  {t(label)}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title={t("Match settings")} subtitle={isHost ? t("You're the host.") : t("The host chooses.")} />
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t("Bots")}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" aria-label={t("Fewer bots")} disabled={!isHost || L.bots === 0} onClick={() => send("alley:settings", { bots: L.bots - 1 })}>
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="w-6 text-center font-mono text-lg font-bold">{L.bots}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={t("More bots")}
                  disabled={!isHost || L.seats.length + L.bots >= 4}
                  onClick={() => send("alley:settings", { bots: L.bots + 1 })}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <Select<AlleyMap | "random">
              label={t("Map")}
              showLabel
              value={L.map}
              disabled={!isHost}
              onChange={(map) => send("alley:settings", { map })}
              options={MAPS.map((m) => ({ value: m, label: t(MAP_NAMES[m]) }))}
            />
          </div>
        </Card>
        <Link href="/arena/alley" className="px-1 text-sm font-semibold text-primary">
          ← {t("Leave the room")}
        </Link>
      </div>
    </div>
  );
}
