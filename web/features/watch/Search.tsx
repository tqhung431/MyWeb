"use client";

// Find a TV show or anime. Searching starts a moment after you stop typing ("debounce"), so typing
// "frieren" asks the API once, not seven times.

import { CloudOff, Loader2, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMe } from "@/features/me/MeProvider";
import { ApiError } from "@/lib/api/client";
import { removeEntry, saveEntry, searchTitles, type Found, type Source, type Status } from "@/lib/api/watch";
import { Poster, StatusSelect } from "./bits";

import { useT } from "@/lib/i18n/I18nProvider";
type Kind = "all" | Source;
const SUGGESTIONS = ["Frieren", "Friends", "One Piece", "The Office", "Spy x Family", "Breaking Bad"];

export function Search() {
  const t = useT();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [results, setResults] = useState<Found[] | null>(null);
  const [unavailable, setUnavailable] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const words = q.trim();
    if (words.length < 2) {
      setResults(null);
      setError("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchTitles(words, kind);
        if (cancelled) return;
        setResults(res.results);
        setUnavailable(res.unavailable);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("Can't reach Nook right now."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, kind]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t("Search TV shows and anime")}</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search TV shows and anime…")}
            autoFocus
            className="h-12 w-full rounded-full border border-border bg-surface-strong/70 pr-12 pl-12 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
          />
          {loading && <Loader2 className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 animate-spin text-primary" aria-label={t("Searching")} />}
        </label>
        <SegmentedControl<Kind>
          label={t("What to search")}
          options={[
            { value: "all", label: t("All") },
            { value: "tv", label: "TV" },
            { value: "anime", label: t("Anime") },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>

      {results === null && !error && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {t("Try:")}
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQ(s)}
              className="cursor-pointer rounded-full bg-surface-muted px-3 py-1 font-semibold hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="h-5 w-5" aria-hidden="true" /> {error}
        </p>
      )}
      {unavailable.length > 0 && results && (
        <p className="text-sm text-muted">
          {unavailable.includes("anime")
            ? t("Anime search isn't answering right now; showing the rest.")
            : t("TV search isn't answering right now; showing the rest.")}
        </p>
      )}
      {results?.length === 0 && <p className="text-sm text-muted">{t("Nothing found for “{q}”.", { q: q.trim() })}</p>}

      {results && results.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((r) => (
            <li key={`${r.source}-${r.externalId}`}>
              <ResultCard
                title={r}
                onSaved={(mine) =>
                  setResults((list) => list?.map((x) => (x.source === r.source && x.externalId === r.externalId ? { ...x, mine } : x)) ?? null)
                }
              />
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        {t("TV shows from")}{" "}
        <a href="https://www.tvmaze.com" target="_blank" rel="noopener noreferrer" className="underline">
          TVmaze
        </a>
        , {t("anime from")}{" "}
        <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="underline">
          MyAnimeList
        </a>{" "}
        {t("via Jikan. Both free; this PC needs the internet to search.")}
      </p>
    </div>
  );
}

function ResultCard({ title: show, onSaved }: { title: Found; onSaved: (mine: Found["mine"]) => void }) {
  const t = useT();
  const { user, askName } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(s: Status | "remove") {
    if (!user) return askName();
    setBusy(true);
    setError("");
    try {
      if (s === "remove") {
        if (show.mine) await removeEntry(show.mine.titleId);
        onSaved(null);
      } else {
        const e = await saveEntry(show.source, show.externalId, { status: s });
        onSaved({ status: e.status, titleId: e.titleId });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Not saved"));
    } finally {
      setBusy(false);
    }
  }

  const poster = <Poster src={show.imageUrl} title={show.title} source={show.source} />;
  return (
    <article className="flex h-full flex-col gap-2">
      {show.mine ? (
        <Link
          href={`/watchlist/t/${show.mine.titleId}`}
          aria-label={show.title}
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {poster}
        </Link>
      ) : (
        poster
      )}
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold" title={show.originalTitle ?? undefined}>
          {show.title}
        </h3>
        <p className="text-xs text-muted">
          {[show.year, show.kind, show.episodes ? `${show.episodes} ep` : null].filter(Boolean).join(" · ")}
          {show.rating !== null && (
            <>
              {" · "}
              <Badge>★ {(show.rating / 10).toFixed(1)}</Badge>
            </>
          )}
        </p>
      </div>
      {show.summary && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer font-semibold">{t("About")}</summary>
          <p className="mt-1 whitespace-pre-line">{show.summary}</p>
        </details>
      )}
      <div className="mt-auto flex items-center gap-2">
        <StatusSelect value={show.mine?.status ?? null} onChange={change} allowRemove={!!show.mine} className="w-full" />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />}
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    </article>
  );
}
