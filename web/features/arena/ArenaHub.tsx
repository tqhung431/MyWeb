"use client";

// Stage 22: Nook Arena's front page. Stage 30: the Games app's "Together" tab: the live games and the game
// server's status (Listen Together moved to Music, Sproutlings to Adventures, Nook TV is its own app).

import { useIsAdmin } from "@/features/admin/useIsAdmin";
import { Bot } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useArena } from "@/features/arena/ArenaProvider";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { AlleyCard, BrawlCard, ChessCard, VillageCard } from "@/features/games/GameCards";

export function ArenaHub() {
  const t = useT();
  const { connected, problem } = useArena();
  const admin = useIsAdmin();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t("Games you play live with others on Nook, on Nook's own game server.")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AlleyCard />
        <VillageCard />
        <BrawlCard />
        <ChessCard />
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <span
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", connected ? "bg-emerald-500" : problem ? "bg-rose-500" : "bg-amber-500")}
            aria-hidden="true"
          />
          <p className="text-sm">
            {connected ? t("Connected to Nook's game server.") : problem ? t("Can't reach Nook's game server.") : t("Connecting to the game server…")}{" "}
            {!problem && <span className="text-muted">{t("It runs on the same PC as Nook; games never leave your network.")}</span>}
          </p>
          <Bot className="ml-auto hidden h-5 w-5 text-muted sm:block" aria-hidden="true" />
        </div>
        {problem && !connected && (
          // Stage 27: no server commands on the page; the admin sees what's wrong in Admin → Health
          <div className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm">
            <p>{t("Try again in a little while. If it keeps happening, tell the person who runs Nook.")}</p>
            {admin && (
              <Link href="/admin" className="mt-1 inline-block font-semibold text-primary hover:underline">
                {t("Admin → Health shows what's wrong")}
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
