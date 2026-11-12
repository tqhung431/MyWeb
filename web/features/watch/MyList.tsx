"use client";

// Your WatchList: what you want to watch, are watching, watched or dropped.
// Changes are saved straight away (status, stars, episodes, a short note).

import { useConfirm } from "@/components/ui/Dialog";
import { CloudOff, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { NameForm } from "@/features/me/NameForm";
import { useMe } from "@/features/me/MeProvider";
import { getList, removeEntry, saveEntry, STATUS_LABEL, type Entry, type Status } from "@/lib/api/watch";
import { cn } from "@/lib/cn";
import { Poster, Stars, StatusSelect } from "./bits";

type Filter = "all" | Status;
const FILTERS: Filter[] = ["all", "watching", "want", "done", "dropped"];

export function MyList() {
  const { user, setUser } = useMe();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      setEntries(await getList());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  if (!user) {
    return (
      <div className="max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">Pick a name to keep a list</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Your list is saved with your name, so others on Nook can see what you recommend.</p>
        <NameForm mode="pick" onDone={setUser} />
      </div>
    );
  }

  const count = (f: Filter) => (f === "all" ? (entries?.length ?? 0) : (entries?.filter((e) => e.status === f).length ?? 0));
  const shown = entries?.filter((e) => filter === "all" || e.status === filter) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                filter === f ? "bg-primary text-on-primary" : "bg-surface-muted text-muted hover:text-text",
              )}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]} <span className="opacity-70 tabular-nums">{count(f)}</span>
            </button>
          ))}
        </div>
        <Link href="/watchlist/search" className={buttonClasses("primary", "sm")}>
          <Search className="h-4 w-4" aria-hidden="true" /> Find something
        </Link>
      </div>

      {offline && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="h-5 w-5" aria-hidden="true" /> Can&apos;t reach the API right now.
        </p>
      )}
      {entries === null && !offline && <p className="text-sm text-muted">Loading your list…</p>}
      {entries?.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-4xl" aria-hidden="true">
            🍿
          </p>
          <p className="mt-2 font-semibold">Your list is empty</p>
          <p className="text-sm text-muted">Find a show or anime and add it.</p>
        </div>
      )}
      {entries && entries.length > 0 && shown.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((e) => (
          <li key={e.titleId}>
            <EntryCard
              entry={e}
              onChange={(n) => setEntries((list) => list?.map((x) => (x.titleId === n.titleId ? n : x)) ?? null)}
              onRemoved={() => setEntries((list) => list?.filter((x) => x.titleId !== e.titleId) ?? null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryCard({ entry: e, onChange, onRemoved }: { entry: Entry; onChange: (e: Entry) => void; onRemoved: () => void }) {
  const confirm = useConfirm();
  const [note, setNote] = useState(e.note);
  const [error, setError] = useState("");
  const saving = useRef(Promise.resolve());

  // Show the change at once, then save; saves run one after another so they can't overtake each other
  function save(changes: Partial<Pick<Entry, "status" | "stars" | "note" | "episodesSeen">>) {
    const next = { ...e, ...changes };
    onChange(next);
    setError("");
    saving.current = saving.current.then(() =>
      saveEntry(e.source, e.externalId, { status: next.status, ...changes }).then(onChange, () => setError("Not saved: can't reach Nook.")),
    );
  }

  async function changeStatus(s: Status | "remove") {
    if (s === "remove") {
      if (!(await confirm({ title: `Remove “${e.title}” from your list?`, confirmLabel: "Remove", danger: true }))) return;
      await removeEntry(e.titleId).catch(() => {});
      return onRemoved();
    }
    save({ status: s, ...(s === "watching" && e.episodesSeen === null ? { episodesSeen: 0 } : {}) });
  }

  const seen = e.episodesSeen ?? 0;
  return (
    <article className="flex gap-4 rounded-3xl border border-border bg-surface p-4 shadow-card backdrop-blur-xl">
      <Link
        href={`/watchlist/t/${e.titleId}`}
        className="w-24 shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-28"
        aria-label={e.title}
      >
        <Poster src={e.imageUrl} title={e.title} source={e.source} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <Link href={`/watchlist/t/${e.titleId}`} className="line-clamp-2 font-semibold hover:underline">
            {e.title}
          </Link>
          <p className="text-xs text-muted">{[e.year, e.kind, e.episodes ? `${e.episodes} episodes` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect value={e.status} onChange={changeStatus} allowRemove />
          <Stars value={e.stars} onChange={(stars) => save({ stars })} />
        </div>
        {e.status === "watching" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Episode</span>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={() => save({ episodesSeen: Math.max(0, seen - 1) })}
              aria-label="One episode less"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <span className="min-w-12 text-center font-semibold tabular-nums">
              {seen}
              {e.episodes ? ` / ${e.episodes}` : ""}
            </span>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={() => save(e.episodes && seen + 1 >= e.episodes ? { episodesSeen: e.episodes, status: "done" } : { episodesSeen: seen + 1 })}
              aria-label="Watched one more episode"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
        <input
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          onBlur={() => note !== e.note && save({ note })}
          maxLength={500}
          placeholder="A short note (others on Nook can see it)"
          aria-label={`Note about ${e.title}`}
          className="h-9 w-full rounded-full border border-border bg-surface-strong/70 px-3 text-sm focus:border-primary focus:outline-none"
        />
        {error && <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
    </article>
  );
}
