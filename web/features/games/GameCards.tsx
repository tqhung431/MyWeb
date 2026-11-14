"use client";

// Stage 30: one card per game, used by the Games app's pages (All games, Together, Adventures), so every game
// appears with the same look and its name in Nook's language (English "Firecracker Alley", Vietnamese "Ngõ Pháo").

import { ArrowRight, Mountain, Swords } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { LanternHead } from "@/features/arena/alley/LanternHead";
import { Piece } from "@/features/arena/chess/pieces";
import { Creature } from "@/features/arena/sprout/Creature";
import { GAMES } from "@/features/arcade/games";
import { cn } from "@/lib/cn";
import { useLang, useT } from "@/lib/i18n/I18nProvider";
import { realmName } from "./van-lo/logic/player";
import { loadLocal } from "./van-lo/logic/save";

function BigCard(props: { href: string; className: string; kicker: string; title: string; text: string; art: ReactNode; action?: string }) {
  const t = useT();
  return (
    <Link
      href={props.href}
      className={cn(
        "group relative flex min-h-48 flex-col overflow-hidden rounded-3xl p-6 text-white shadow-card transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        props.className,
      )}
    >
      <div className="pointer-events-none absolute -right-2 -bottom-3 flex items-end gap-1" aria-hidden="true">
        {props.art}
      </div>
      <p className="text-xs font-semibold tracking-wide text-amber-100/90 uppercase">{props.kicker}</p>
      <h3 className="mt-1 text-3xl font-extrabold">{props.title}</h3>
      <p className="mt-1 max-w-[14rem] text-sm text-white/90">{props.text}</p>
      <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold">
        {props.action ?? t("Play")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function AlleyCard() {
  const t = useT();
  return (
    <BigCard
      href="/arena/alley"
      className="bg-linear-to-br from-red-900 via-rose-800 to-amber-600"
      kicker={t("Party maze · 2–4 players")}
      title={t("Firecracker Alley")}
      text={t("Drop firecrackers, break crates, last one standing.")}
      art={
        <>
          <LanternHead color={0} hat={1} size={88} />
          <LanternHead color={2} hat={2} size={68} />
        </>
      }
    />
  );
}

export function VillageCard() {
  const t = useT();
  return (
    <BigCard
      href="/arena/village"
      className="bg-linear-to-br from-emerald-800 via-teal-700 to-amber-600"
      kicker={t("Tower defense · alone or with a friend")}
      title={t("Keep the Village")}
      text={t("Guard the rice from mischievous spirits.")}
      art={<span className="text-7xl">🏮🌾</span>}
    />
  );
}

export function BrawlCard() {
  const t = useT();
  return (
    <BigCard
      href="/arena/brawl"
      className="bg-linear-to-br from-indigo-950 via-fuchsia-900 to-amber-600"
      kicker={t("Co-op action · 1–4 players")}
      title={t("Night Market Brawl")}
      text={t("Pick a hero and bonk the trouble-makers out of the night market.")}
      art={<span className="text-7xl">🏮🥢</span>}
    />
  );
}

export function ChessCard() {
  const t = useT();
  return (
    <BigCard
      href="/arena/chess"
      className="bg-linear-to-br from-slate-800 via-indigo-900 to-violet-800"
      kicker={t("Live, with clocks and ratings")}
      title={t("Chess")}
      text={t("Play someone on Nook, or Nook itself at 4 levels.")}
      art={
        <>
          <Piece type="n" color="w" className="h-24 w-24" />
          <Piece type="k" color="b" className="-ml-6 h-28 w-28" />
        </>
      }
    />
  );
}

export function SproutCard() {
  const t = useT();
  return (
    <BigCard
      href="/arena/sprout"
      className="bg-linear-to-br from-emerald-600 via-teal-600 to-sky-700"
      kicker={t("Creature adventure · with saves")}
      title={t("Sproutlings")}
      text={t("Befriend sproutlings, grow together, wake the island's six shrines.")}
      art={
        <>
          <Creature species="mamTre" size={76} />
          <Creature species="thanHong" size={68} />
        </>
      }
    />
  );
}

export function QuizCard() {
  const t = useT();
  return (
    <BigCard
      href="/arcade-online"
      className="bg-linear-to-br from-rose-500 via-red-500 to-orange-400"
      kicker={t("Party · everyone on Nook")}
      title={t("Quiz Party")}
      text={t("Answer fastest, live, against everyone in the room.")}
      art={<Swords className="h-32 w-32 rotate-[-12deg] opacity-25" />}
    />
  );
}

// Cloud Path: drawn in its own ink colours, with how far your save has got
export function CloudPathCard() {
  const t = useT();
  const lang = useLang();
  const [progress, setProgress] = useState<string | null>(null);
  useEffect(() => {
    const g = loadLocal();
    if (g) setProgress(`${g.player.name} · ${realmName(g.player, lang)}`);
  }, [lang]);
  return (
    <Link
      href="/games/van-lo"
      data-palette="ink"
      className="group relative flex min-h-48 flex-col justify-end overflow-hidden rounded-3xl border border-border bg-background p-6 text-text shadow-card transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      <svg aria-hidden="true" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full text-text">
        <circle cx="320" cy="50" r="22" fill="#a8231b" opacity="0.85" />
        <path d="M0 200 L0 120 Q50 60 90 110 Q130 40 180 100 Q220 50 260 105 Q300 70 340 112 Q370 95 400 120 L400 200 Z" fill="currentColor" opacity="0.13" />
        <path d="M0 200 L0 150 Q70 110 130 148 Q190 118 250 150 Q320 124 400 152 L400 200 Z" fill="currentColor" opacity="0.22" />
      </svg>
      <div className="relative">
        <Badge tone="primary">{progress ?? t("Cultivation adventure · with saves")}</Badge>
        <h3 className="mt-2 text-3xl font-extrabold tracking-tight">{t("Cloud Path")}</h3>
        <p className="max-w-md text-sm text-muted">{t("Train in your cave abode, explore secret realms turn by turn, survive the tribulation.")}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
          <Mountain className="h-4 w-4" aria-hidden="true" /> {progress ? t("Continue") : t("Play")}
        </span>
      </div>
    </Link>
  );
}

// The six quick games, as small tiles
export function QuickGames() {
  const t = useT();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {GAMES.map((g) => (
        <li key={g.id}>
          <Link
            href={`/arcade/${g.id}`}
            className="flex h-full flex-col items-start gap-2 rounded-3xl border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-2xl", g.accent)} aria-hidden="true">
              {g.emoji}
            </span>
            <span className="font-bold">{t(g.name)}</span>
            <span className="text-xs text-muted">{t(g.tagline)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Section({ title, href, more, children }: { title: string; href?: string; more?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {href && more && (
          <Link href={href} className="text-sm font-semibold text-primary hover:underline">
            {more}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export const TwoUp = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
export const Grid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
