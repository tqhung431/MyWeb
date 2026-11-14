"use client";

// What the Companion's answer talked about: real Nook songs (play them here), tips and apps (Stage 31) to open.
import { ArrowRight, Lightbulb, Play } from "lucide-react";
import Link from "next/link";
import type { Source } from "@/lib/api/companion";
import { genreOf } from "@/features/music/genres";
import { useMusic } from "@/features/music/MusicProvider";

import { useT } from "@/lib/i18n/I18nProvider";
export function SourceCards({ sources }: { sources: Source[] }) {
  const t = useT();
  const { play } = useMusic();
  const songs = sources.filter((s) => s.kind === "song");
  if (sources.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("Suggestions from Nook")}>
      {sources.map((s) =>
        s.kind === "song" ? (
          <li key={`song-${s.id}`}>
            <button
              type="button"
              onClick={() => play(s, songs)}
              className="flex max-w-64 cursor-pointer items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 py-1.5 pr-3 pl-1.5 text-left text-sm hover:bg-surface-muted"
              aria-label={t("Play {title} by {artist}", { title: s.title, artist: s.artist })}
            >
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white ${genreOf(s.genre).accent}`}>
                <Play className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-muted">{s.artist}</span>
              </span>
            </button>
          </li>
        ) : s.kind === "guide" ? (
          <li key={`guide-${s.id}`}>
            <Link
              href={s.href}
              className="flex max-w-64 items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 py-1.5 pr-3 pl-1.5 text-sm hover:bg-surface-muted"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-400 to-indigo-500 text-white">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t(s.title)}</span>
                <span className="block truncate text-xs text-muted">{t("Open in Nook")}</span>
              </span>
            </Link>
          </li>
        ) : (
          <li key={`tip-${s.slug}`}>
            <Link
              href={`/focus/tips/${s.slug}`}
              title={s.summary}
              className="flex max-w-64 items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 py-1.5 pr-3 pl-1.5 text-sm hover:bg-surface-muted"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-muted">{t("Focus tip")}</span>
              </span>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
