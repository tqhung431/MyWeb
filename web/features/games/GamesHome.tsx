"use client";

// /games: the bigger games, with saves. The quick ones stay in Mini Arcade and Arcade Online.

import { Gamepad2, Mountain, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { realmName } from "./van-lo/logic/player";
import { useLang } from "@/lib/i18n/I18nProvider";
import { loadLocal } from "./van-lo/logic/save";

import { useT } from "@/lib/i18n/I18nProvider";
export function GamesHome() {
  const t = useT();
  const lang = useLang();
  const [progress, setProgress] = useState<string | null>(null);
  useEffect(() => {
    const g = loadLocal();
    if (g) setProgress(`${g.player.name} · ${realmName(g.player, lang)}`);
  }, [lang]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/games/van-lo"
        data-palette="ink"
        className="group relative flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl border border-border bg-background p-6 text-text shadow-card transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:p-8"
      >
        <svg aria-hidden="true" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full text-text">
          <circle cx="320" cy="50" r="22" fill="#a8231b" opacity="0.85" />
          <path d="M0 200 L0 120 Q50 60 90 110 Q130 40 180 100 Q220 50 260 105 Q300 70 340 112 Q370 95 400 120 L400 200 Z" fill="currentColor" opacity="0.13" />
          <path d="M0 200 L0 150 Q70 110 130 148 Q190 118 250 150 Q320 124 400 152 L400 200 Z" fill="currentColor" opacity="0.22" />
          <path d="M40 170 Q140 150 230 165 Q300 176 380 160" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.35" />
        </svg>
        <div className="relative">
          <Badge tone="primary">{progress ?? t("New")}</Badge>
          <h2 className="mt-2 text-4xl font-extrabold tracking-tight">Vân Lộ</h2>
          <p className="max-w-md text-muted">
            {t("A cultivation roguelite: train in your cave abode, explore secret realms turn by turn, survive the tribulation.")}
          </p>
          <span className={buttonClasses("primary", "md", "mt-4")}>
            <Mountain className="h-4 w-4" aria-hidden="true" /> {progress ? t("Continue") : t("Play")}
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/arcade" className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5">
          <Gamepad2 className="h-8 w-8 text-primary" aria-hidden="true" />
          <span>
            <span className="block font-bold">{t("Mini Arcade")}</span>
            <span className="text-sm text-muted">{t("Six quick games with high scores")}</span>
          </span>
        </Link>
        <Link
          href="/arcade-online"
          className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5"
        >
          <Swords className="h-8 w-8 text-primary" aria-hidden="true" />
          <span>
            <span className="block font-bold">{t("Arcade Online")}</span>
            <span className="text-sm text-muted">{t("Quiz Party against everyone on Nook")}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
