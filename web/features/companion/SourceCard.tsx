"use client";

// What the Companion's answer is based on: real Nook songs (play them here) and tips (open them).
import { Lightbulb, Play } from "lucide-react";
import Link from "next/link";
import type { Source } from "@/lib/api/companion";
import { genreOf } from "@/features/music/genres";
import { useMusic } from "@/features/music/MusicProvider";

export function SourceCards({ sources }: { sources: Source[] }) {
  const { play } = useMusic();
  const songs = sources.filter((s) => s.kind === "song");
  if (sources.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Suggestions from Nook">
      {sources.map((s) =>
        s.kind === "song" ? (
          <li key={`song-${s.id}`}>
            <button
              type="button"
              onClick={() => play(s, songs)}
              className="flex max-w-64 cursor-pointer items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 py-1.5 pr-3 pl-1.5 text-left text-sm hover:bg-surface-muted"
              aria-label={`Play ${s.title} by ${s.artist}`}
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
        ) : (
          <li key={`tip-${s.slug}`}>
            <Link
              href={`/chill/tips/${s.slug}`}
              title={s.summary}
              className="flex max-w-64 items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 py-1.5 pr-3 pl-1.5 text-sm hover:bg-surface-muted"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-muted">Focus tip</span>
              </span>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
