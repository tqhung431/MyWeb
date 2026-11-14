"use client";

// Stage 22: Nook Arena's front page: what you can play now, and what's coming in the next stages.

import { ArrowRight, Bot, Headphones, Swords, Tv } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useArena } from "@/features/arena/ArenaProvider";
import { cn } from "@/lib/cn";
import { tx } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanternHead } from "./alley/LanternHead";
import { Piece } from "./chess/pieces";

const NEXT = [
  { name: "Chợ Đêm Brawl", en: tx("Night Market Brawl"), what: tx("Co-op action through a night market, up to 4 friends"), stage: 25, emoji: "🥢" },
  { name: "Mầm Thú", en: tx("Sproutlings"), what: tx("Befriend, raise and battle original creatures"), stage: 26, emoji: "🌱" },
];

export function ArenaHub() {
  const t = useT();
  const { connected, problem } = useArena();
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Link
        href="/arena/alley"
        className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-red-900 via-rose-800 to-amber-600 p-6 text-white shadow-card transition hover:-translate-y-0.5 "
      >
        <div className="pointer-events-none absolute -right-2 -bottom-3 flex items-end gap-1" aria-hidden="true">
          <LanternHead color={0} hat={1} size={96} />
          <LanternHead color={2} hat={2} size={72} />
          <LanternHead color={1} hat={4} size={84} />
        </div>
        <p className="text-sm font-semibold tracking-wide text-amber-200 uppercase">{t("Firecracker Alley")}</p>
        <h2 className="mt-1 text-3xl font-extrabold">Ngõ Pháo</h2>
        <p className="mt-1 max-w-[13rem] text-sm text-white/90">{t("Party maze for 2–4: drop firecrackers, break crates, last one standing.")}</p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold">
          {t("Play")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
      <Link
        href="/arena/village"
        className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-800 via-teal-700 to-amber-600 p-6 text-white shadow-card transition hover:-translate-y-0.5"
      >
        <p className="pointer-events-none absolute -right-1 -bottom-3 text-7xl" aria-hidden="true">
          🏮🌾
        </p>
        <p className="text-sm font-semibold tracking-wide text-amber-200 uppercase">{t("New")} · {t("Keep the Village")}</p>
        <h2 className="mt-1 text-3xl font-extrabold">Giữ Làng</h2>
        <p className="mt-1 max-w-[13rem] text-sm text-white/90">{t("Tower defense: guard the rice from mischievous spirits, alone or with a friend.")}</p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold">
          {t("Play")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/arena/chess" className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-800 via-indigo-900 to-violet-800 p-6 text-white shadow-card transition hover:-translate-y-0.5">
          <div className="pointer-events-none absolute -right-3 -bottom-4 flex gap-0 opacity-90" aria-hidden="true">
            <Piece type="n" color="w" className="h-24 w-24" />
            <Piece type="k" color="b" className="-ml-6 h-28 w-28" />
          </div>
          <Swords className="h-6 w-6 text-white/80" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-extrabold">{t("Chess")}</h2>
          <p className="mt-1 max-w-[14rem] text-sm text-white/85">{t("Live games with clocks and ratings, or play Nook at 4 levels.")}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold">
            {t("Play")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
        <Link href="/arena/listen" className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-fuchsia-500 via-rose-500 to-orange-400 p-6 text-white shadow-card transition hover:-translate-y-0.5">
          <Headphones className="pointer-events-none absolute -right-4 -bottom-6 h-36 w-36 rotate-[-12deg] opacity-20" aria-hidden="true" />
          <Headphones className="h-6 w-6 text-white/80" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-extrabold">{t("Listen Together")}</h2>
          <p className="mt-1 max-w-[15rem] text-sm text-white/90">{t("The same song, at the same second, for everyone in the room.")}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold">
            {t("Open a room")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
        <Link href="/tv" className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-red-600 to-rose-900 p-6 text-white shadow-card transition hover:-translate-y-0.5">
          <Tv className="pointer-events-none absolute -right-4 -bottom-6 h-36 w-36 opacity-15" aria-hidden="true" />
          <Tv className="h-6 w-6 text-white/80" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-extrabold">{t("Nook TV")}</h2>
          <p className="mt-1 max-w-[15rem] text-sm text-white/90">{t("Videos the admin picked, and live screen shares.")}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold">
            {t("Watch")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", connected ? "bg-emerald-500" : problem ? "bg-rose-500" : "bg-amber-500")} aria-hidden="true" />
          <p className="text-sm">
            {connected ? t("Connected to Nook's game server.") : problem ? t("Can't reach Nook's game server.") : t("Connecting to the game server…")}{" "}
            {!problem && <span className="text-muted">{t("It runs on the same PC as Nook; games never leave your network.")}</span>}
          </p>
          <Bot className="ml-auto hidden h-5 w-5 text-muted sm:block" aria-hidden="true" />
        </div>
        {problem === "old-caddy" && !connected && (
          <div className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm">
            <p className="font-semibold">{t("Nook's front door (Caddy) is still using its settings from before the game server existed.")}</p>
            <p className="mt-1 text-muted">{t("On the computer that runs Nook, in the Nook folder, run:")}</p>
            <p className="mt-1">
              <code className="rounded bg-black/10 px-1.5 py-0.5 dark:bg-white/10">docker compose up -d --force-recreate caddy</code>
            </p>
            <p className="mt-1 text-xs text-muted">{t("Then reload this page.")}</p>
          </div>
        )}
        {problem && problem !== "old-caddy" && !connected && (
          <div className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm">
            <p className="font-semibold">{t("If you run Nook yourself, check on that computer:")}</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              <li>
                <code>docker compose ps arena</code> {t("should say \"running (healthy)\". If it's missing: git pull, then docker compose up -d --build, then docker compose up -d --force-recreate caddy")}
              </li>
              <li>
                <code>docker compose logs arena</code> {t("shows why it stopped")}
              </li>
              <li>{t("Behind Cloudflare or nginx: /api/arena must reach Caddy like the rest of /api (see docs/stage-22.md)")}</li>
            </ul>
            <p className="mt-1 text-xs text-muted">
              {t("Details")}: {problem}
            </p>
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-3 px-1 text-lg font-bold">{t("Coming to the Arena")}</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NEXT.map((g) => (
            <li key={g.name} className="rounded-3xl border border-dashed border-border bg-surface/60 p-4">
              <p className="text-3xl" aria-hidden="true">
                {g.emoji}
              </p>
              <p className="mt-2 font-bold">{g.name}</p>
              <p className="text-xs font-semibold text-muted">
                {t(g.en)} · {t("Stage {n}", { n: g.stage })}
              </p>
              <p className="mt-1 text-sm text-muted">{t(g.what)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
