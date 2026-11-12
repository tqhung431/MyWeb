"use client";

// The arcade's lobby: one card per game, with your best score.

import { Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyBests, type GameId } from "@/lib/api/arcade";
import { cn } from "@/lib/cn";
import { formatScore, GAMES } from "./games";

import { useT } from "@/lib/i18n/I18nProvider";
export function Lobby() {
  const t = useT();
  const [bests, setBests] = useState<Partial<Record<GameId, number>>>({});

  useEffect(() => {
    getMyBests()
      .then((r) => setBests(r.bests))
      .catch(() => {}); // no best scores shown, the games still work
  }, []);

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {GAMES.map((game) => {
        const best = bests[game.id];
        return (
          <li key={game.id}>
            <Link
              href={`/arcade/${game.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className={cn("relative flex h-32 items-center justify-center bg-linear-to-br", game.accent)}>
                <span className="text-6xl drop-shadow-lg transition group-hover:scale-110 group-hover:-rotate-6" aria-hidden="true">
                  {game.emoji}
                </span>
                <span className="absolute right-3 bottom-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg transition group-hover:scale-110">
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-1 p-5">
                <span className="font-bold">{t(game.name)}</span>
                <span className="text-sm text-muted">{t(game.tagline)}</span>
                <span className="mt-auto pt-3 text-xs font-semibold text-muted">
                  {best === undefined ? (
                    t("Not played yet")
                  ) : (
                    <>
                      {t("Your best:")} <span className="text-text tabular-nums">{formatScore(game, best)}</span>
                    </>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
