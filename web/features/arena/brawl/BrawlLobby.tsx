"use client";

// Stage 25 · Chợ Đêm Brawl's front page: start a room (alone or with up to 3 friends), join an open one, and the
// best teams on the leaderboard.

import { Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import { getBrawlBoard, type BrawlBoardRow, type OpenBrawlRoom } from "@/lib/api/arena";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { AREAS, HERO_KINDS } from "./brawl";
import { AREA_NAMES, ENEMY_NAMES, HERO_INFO } from "./names";

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function BrawlLobby() {
  const t = useT();
  const { user } = useMe();
  const { connected, ask } = useArena();
  const router = useRouter();
  const [rooms, setRooms] = useState<OpenBrawlRoom[]>([]);
  const [board, setBoard] = useState<BrawlBoardRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getBrawlBoard().then(setBoard, () => setBoard([]));
  }, []);
  const load = useCallback(() => void ask("arena:rooms", { kind: "brawl" }).then((a) => a.ok && setRooms(a.rooms as OpenBrawlRoom[])), [ask]);
  useEffect(() => {
    if (connected) load();
  }, [connected, load]);
  useArenaEvent<{ kind: string }>("arena:rooms", (e) => e.kind === "brawl" && load());

  const create = async () => {
    setError("");
    const a = await ask("brawl:create", {});
    if (a.ok && a.code) router.push(`/arena/brawl/${a.code}`);
    else setError(t(a.error ?? "That didn't work"));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-950 via-fuchsia-900 to-amber-600 p-6 text-white shadow-card sm:p-8">
          <p className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-90 sm:text-7xl" aria-hidden="true">
            🏮🥢
          </p>
          <p className="text-sm font-semibold tracking-wide text-amber-200 uppercase">{t("Co-op action · 1–4 players")}</p>
          <h2 className="mt-1 text-3xl font-extrabold">{t("Night Market Brawl")}</h2>
          <p className="mt-1 max-w-[70%] text-white/90 sm:max-w-md">
            {t("Trouble-makers have taken over the night market. Team up (1–4 friends), bonk them back home through five areas and two bosses.")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {user ? (
              <Button variant="light" onClick={create} disabled={!connected}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("Start a room")}
              </Button>
            ) : null}
          </div>
          {error && <p className="mt-2 text-sm text-amber-100">{error}</p>}
        </section>
        {!user && <NeedName why={t("Pick a name to play. Without one you can only watch.")} />}

        {rooms.length > 0 && (
          <Card>
            <CardHeader title={t("Open rooms")} />
            <ul className="flex flex-col gap-2">
              {rooms.map((r) => (
                <li key={r.code}>
                  <Link href={`/arena/brawl/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-primary/40">
                    <span className="rounded-xl bg-fuchsia-500/12 px-2.5 py-1.5 font-mono text-sm font-bold text-fuchsia-700 dark:text-fuchsia-300">{r.code}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-semibold">{r.host ?? "…"}</span>
                      <span className="text-xs text-muted">
                        {t("{n} of 4", { n: r.players })} · {r.status === "waiting" ? t("Waiting to start") : t("Playing")}
                      </span>
                    </span>
                    <Plus className="h-4 w-4 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title={t("The heroes")} subtitle={t("Each one plays differently. In a team, everyone picks a different hero.")} />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {HERO_KINDS.map((k) => (
              <li key={k} className="flex gap-3 text-sm">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-2xl", HERO_INFO[k].color)} aria-hidden="true">
                  {HERO_INFO[k].emoji}
                </span>
                <span>
                  <span className="font-bold">{t(HERO_INFO[k].name)}</span>
                  <span className="block text-muted">{t(HERO_INFO[k].role)}</span>
                  <span className="block text-xs text-muted">{t(HERO_INFO[k].special)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title={t("The way through the market")} />
          <ol className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-5">
            {AREAS.map((_, i) => (
              <li key={i} className="rounded-xl bg-surface-muted px-3 py-2">
                <span className="block text-xs text-muted">{t("Area {n}", { n: i + 1 })}</span>
                <span className="font-semibold">{t(AREA_NAMES[i])}</span>
                {i === 2 && <span className="block text-xs text-rose-600 dark:text-rose-300">{t(ENEMY_NAMES.umbrellaBoss)}</span>}
                {i === 4 && <span className="block text-xs text-rose-600 dark:text-rose-300">{t(ENEMY_NAMES.karaokeKing)}</span>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">{t("Between areas there's a snack stall: spend the coins you collected on bánh mì, chè, cà phê or bánh xèo.")}</p>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title={t("Best teams")} />
        {board.length === 0 ? (
          <p className="text-sm text-muted">{t("No runs yet. Be the first!")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {board.map((r) => (
              <li key={r.rank} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.me && "bg-primary/10")}>
                <span className="w-6 text-center text-sm font-bold text-muted">{r.rank === 1 ? <Trophy className="mx-auto h-4 w-4 text-amber-500" aria-label="1" /> : r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{r.wins > 0 && r.best ? clock(r.best) : t("area {n}", { n: r.areas })}</span>
                <span className="w-10 text-right font-mono text-sm font-bold">{r.wins > 0 ? `🏮${r.wins}` : `${r.areas}/5`}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
