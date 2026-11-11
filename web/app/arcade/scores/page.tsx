// /arcade/scores: every game's leaderboard on one page.

import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { GAMES } from "@/features/arcade/games";
import { Leaderboard } from "@/features/arcade/Leaderboard";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Arcade leaderboards" };

export default function ScoresPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Everyone on this Nook, each person&apos;s best score. They update live as people play.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GAMES.map((game) => (
          <Card key={game.id} className="flex flex-col gap-4">
            <Link href={`/arcade/${game.id}`} className="flex items-center gap-3 rounded-2xl hover:opacity-80">
              <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-2xl", game.accent)} aria-hidden="true">
                {game.emoji}
              </span>
              <span>
                <span className="block font-bold">{game.name}</span>
                <span className="block text-xs text-muted">{game.better === "lower" ? "Lower is better" : "Higher is better"}</span>
              </span>
            </Link>
            <Leaderboard game={game} limit={5} />
          </Card>
        ))}
      </div>
    </div>
  );
}
