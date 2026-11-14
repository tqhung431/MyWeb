"use client";

// Stage 25 · Chợ Đêm Brawl: a room for 1–4 friends. Everyone picks a different hero and says they're ready; the
// host starts the run. The rules run on the game server; this page draws what it sends.

import { Check, Copy, Crown, Loader2, Play, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useArena, useArenaEvent, useArenaRoom } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import type { BrawlRoomState } from "@/lib/api/arena";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { HERO_KINDS, HEROES, type HeroKind } from "./brawl";
import { BrawlGame } from "./BrawlGame";
import { HERO_INFO } from "./names";
import type { BrawlTick } from "./renderer";

export function BrawlRoom({ code }: { code: string }) {
  const t = useT();
  const { user } = useMe();
  const { ask } = useArena();
  const [room, setRoom] = useState<BrawlRoomState | null>(null);
  const [first, setFirst] = useState<BrawlTick | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useArenaRoom(code, setError);
  useArenaEvent<BrawlRoomState>("room:state", (s) => {
    if (s.code !== code || s.kind !== "brawl") return;
    setRoom(s);
    if (!s.brawl.playing) setFirst(null);
  });
  useArenaEvent<BrawlTick>("brawl:tick", (v) => {
    if (v.code === code && !first) setFirst(v);
  });

  if (!user && !room) return <NeedName why={t("Pick a name to play. Without one you can only watch.")} />;
  if (!room) {
    return (
      <div className="flex items-center gap-2 text-muted">
        {error ? (
          <>
            <X className="h-4 w-4" aria-hidden="true" /> {error}{" "}
            <Link href="/arena/brawl" className="font-semibold text-primary">
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

  const B = room.brawl;
  const isHost = user?.id === B.hostId;
  const mine = B.seats.find((s) => s.id === user?.id);
  const send = async (event: string, payload: object = {}) => {
    const a = await ask(event, { code, ...payload });
    setError(a.ok ? "" : t(a.error ?? "That didn't work"));
  };

  if (B.playing && first) {
    return (
      <BrawlGame
        code={code}
        first={first}
        myId={mine ? user!.id : null}
        endActions={
          <>
            {isHost && (
              <Button variant="light" onClick={() => send("brawl:again")}>
                {t("Back to the room")}
              </Button>
            )}
            <Link href="/arena/brawl" className={buttonClasses("secondary", "md")}>
              {t("Leave")}
            </Link>
          </>
        }
      />
    );
  }
  if (B.playing) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;

  const copy = async () => {
    await navigator.clipboard?.writeText(`${location.origin}/arena/brawl/${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const allReady = B.seats.every((s) => s.hero && (s.id === B.hostId || s.ready));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-3xl bg-linear-to-br from-indigo-950 via-fuchsia-900 to-amber-600 p-5 text-white shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-amber-200 uppercase">{t("Night Market Brawl")} · {t("Room code")}</p>
            <p className="font-mono text-3xl font-extrabold tracking-[0.25em]">{code}</p>
          </div>
          <Button variant="light" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? t("Copied") : t("Invite")}
          </Button>
        </div>

        <h3 className="mt-5 mb-2 text-sm font-bold text-white/90">{t("Pick your hero")}</h3>
        <div role="radiogroup" aria-label={t("Hero")} className="grid grid-cols-2 gap-2 sm:gap-3">
          {HERO_KINDS.map((k) => {
            const by = B.seats.find((s) => s.hero === k);
            const taken = !!by && by.id !== user?.id;
            const info = HERO_INFO[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={mine?.hero === k}
                disabled={!mine || taken}
                onClick={() => send("brawl:hero", { hero: k })}
                className={cn(
                  "relative flex cursor-pointer flex-col items-start rounded-2xl bg-linear-to-br p-3 text-left shadow-sm ring-offset-2 ring-offset-transparent transition disabled:cursor-not-allowed",
                  info.color,
                  mine?.hero === k ? "ring-4 ring-white" : taken ? "opacity-50" : "opacity-85 hover:opacity-100",
                )}
              >
                <span className="text-3xl" aria-hidden="true">
                  {info.emoji}
                </span>
                <span className="mt-1 text-base font-extrabold">{t(info.name)}</span>
                <span className="text-xs text-white/90">{t(info.role)}</span>
                <span className="mt-1 text-[11px] text-white/80">
                  ❤ {HEROES[k as HeroKind].hp} · {t(info.attack)}
                </span>
                {by && <span className="absolute top-2 right-2 max-w-[50%] truncate rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold">{by.name}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {isHost ? (
            <Button variant="light" onClick={() => send("brawl:start")} disabled={!allReady}>
              <Play className="h-4 w-4" aria-hidden="true" /> {B.seats.length > 1 ? t("Start the run") : t("Start alone")}
            </Button>
          ) : mine ? (
            <Button variant="light" onClick={() => send("brawl:ready", { ready: !mine.ready })} disabled={!mine.hero}>
              {mine.ready ? t("Not ready") : t("I'm ready")}
            </Button>
          ) : (
            <p className="text-sm text-white/85">{t("The room is full. You can watch.")}</p>
          )}
          {isHost && !allReady && <p className="text-sm text-white/80">{t("Waiting for everyone to be ready…")}</p>}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-amber-100">
            {error}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title={t("Team")} subtitle={t("{n} of 4", { n: B.seats.length })} />
          <ul className="flex flex-col gap-2">
            {B.seats.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="text-xl" aria-hidden="true">
                  {s.hero ? HERO_INFO[s.hero].emoji : "❔"}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1 truncate font-semibold">
                  {s.id === B.hostId && <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-label={t("Host")} />} {s.name}
                </span>
                <span className={cn("text-xs", s.ready || s.id === B.hostId ? "text-emerald-600 dark:text-emerald-400" : "text-muted")}>
                  {s.id === B.hostId ? t("Host") : s.ready ? t("Ready") : t("Choosing…")}
                </span>
              </li>
            ))}
          </ul>
          {mine?.hero && <p className="mt-3 text-xs text-muted">{t(HERO_INFO[mine.hero].special)}</p>}
        </Card>
        <Link href="/arena/brawl" className="px-1 text-sm font-semibold text-primary">
          ← {t("Leave the room")}
        </Link>
      </div>
    </div>
  );
}
