"use client";

// What people on this Nook watch: the most popular titles this month, and the latest updates (live).

import { CloudOff, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getPopular, type Popular } from "@/lib/api/watch";
import { timeAgo } from "@/lib/time";
import { Poster, Stars } from "./bits";

const VERB = { want: "wants to watch", watching: "is watching", done: "watched", dropped: "dropped" } as const;

export function OnNook() {
  const [data, setData] = useState<Popular | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getPopular());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent("watch:changed", () => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      void load();
    }, 500);
  });

  if (offline)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <CloudOff className="h-5 w-5" aria-hidden="true" /> Can&apos;t reach the API right now.
      </p>
    );
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  if (data.popular.length === 0)
    return (
      <div className="rounded-3xl border border-dashed border-border p-10 text-center">
        <p className="text-4xl" aria-hidden="true">
          📺
        </p>
        <p className="mt-2 font-semibold">Nobody has added anything yet</p>
        <p className="text-sm text-muted">Be the first: find a show and add it to your list.</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="popular-title">
        <h2 id="popular-title" className="mb-3 text-sm font-semibold tracking-wider text-muted uppercase">
          Popular on Nook this month
        </h2>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {data.popular.map((t, i) => (
            <li key={t.titleId}>
              <Link
                href={`/watchlist/t/${t.titleId}`}
                className="group flex flex-col gap-2 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="relative">
                  <Poster src={t.imageUrl} title={t.title} className="transition group-hover:-translate-y-1" />
                  <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">#{i + 1}</span>
                </span>
                <span className="line-clamp-2 text-sm leading-snug font-semibold">{t.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t.people} {t.people === 1 ? "person" : "people"}
                  {t.avgStars !== null && <Stars value={Math.round(t.avgStars)} size="sm" />}
                </span>
                <span className="truncate text-xs text-muted">{t.names.join(", ")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="latest-title">
        <h2 id="latest-title" className="mb-3 text-sm font-semibold tracking-wider text-muted uppercase">
          Latest
        </h2>
        <ul className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-3 shadow-card backdrop-blur-xl">
          {data.latest.map((l) => (
            <li key={`${l.name}-${l.titleId}`}>
              <Link href={`/watchlist/t/${l.titleId}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-surface-muted">
                <Poster src={l.imageUrl} title={l.title} className="w-10 shrink-0 rounded-lg" />
                <span className="min-w-0 text-sm">
                  <strong>{l.name}</strong> {VERB[l.status]} <strong>{l.title}</strong>
                  {l.stars && l.status === "done" && <span className="text-amber-500"> {"★".repeat(l.stars)}</span>}
                  <span className="block text-xs text-muted">{timeAgo(l.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
