"use client";

// Reading: the books you're reading (with quick "+10 pages" buttons), the ones you want to read,
// the ones you finished, and how many pages you read each day.

import { Select } from "@/components/ui/Select";
import { useConfirm } from "@/components/ui/Dialog";
import { BookOpen, CloudOff, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { NameForm } from "@/features/me/NameForm";
import { useMe } from "@/features/me/MeProvider";
import { ApiError } from "@/lib/api/client";
import {
  createBook,
  deleteBook,
  getBooks,
  getReadingStats,
  logPages,
  todayHere,
  updateBook,
  type Book,
  type BookStatus,
  type ReadingStats,
} from "@/lib/api/habits";
import { cn } from "@/lib/cn";

export function Reading() {
  const { user, setUser } = useMe();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [adding, setAdding] = useState(false);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([getBooks(), getReadingStats(30)]);
      setBooks(b);
      setStats(s);
      setOffline(false);
    } catch {
      setOffline(true);
      setBooks((b) => b ?? []);
    }
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [load, user]);

  if (!user) {
    return (
      <div className="max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">Pick a name to track your reading</h2>
        <NameForm mode="pick" onDone={setUser} />
      </div>
    );
  }

  async function addPages(book: Book, pages: number) {
    const optimistic = { ...book, currentPage: book.totalPages ? Math.min(book.totalPages, book.currentPage + pages) : book.currentPage + pages };
    setBooks((list) => list?.map((b) => (b.id === book.id ? optimistic : b)) ?? null);
    const r = await logPages(book.id, pages, todayHere()).catch(() => null);
    if (r?.sent) {
      setBooks((list) => list?.map((b) => (b.id === book.id ? r.value : b)) ?? null);
      getReadingStats(30).then(setStats, () => {});
    } else setOffline(true);
  }

  const reading = books?.filter((b) => b.status === "reading") ?? [];
  const want = books?.filter((b) => b.status === "want") ?? [];
  const finished = books?.filter((b) => b.status === "finished") ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">Reading now</h2>
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a book
          </Button>
        </div>
        {offline && (
          <p className="flex items-center gap-2 rounded-2xl bg-amber-500/12 p-3 text-sm text-amber-800 dark:text-amber-200">
            <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" /> Offline: pages you add are kept on this device and sent later.
          </p>
        )}
        {adding && (
          <NewBook
            onDone={() => {
              setAdding(false);
              void load();
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {books === null && <p className="text-sm text-muted">Loading…</p>}
        {books && reading.length === 0 && !adding && (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center">
            <p className="text-4xl" aria-hidden="true">
              📖
            </p>
            <p className="mt-2 font-semibold">Not reading anything right now</p>
            <p className="text-sm text-muted">Add the book on your nightstand.</p>
          </div>
        )}
        {reading.map((b) => (
          <BookCard key={b.id} book={b} onPages={(n) => addPages(b, n)} onChanged={load} />
        ))}

        {want.length > 0 && <Shelf title="Want to read" books={want} onChanged={load} />}
        {finished.length > 0 && <Shelf title="Finished" books={finished} onChanged={load} />}
      </div>

      <aside className="flex flex-col gap-4">{stats && <StatsCard stats={stats} />}</aside>
    </div>
  );
}

function BookCard({ book: b, onPages, onChanged }: { book: Book; onPages: (n: number) => void; onChanged: () => void }) {
  const [custom, setCustom] = useState("");
  const pct = b.totalPages ? Math.round((b.currentPage / b.totalPages) * 100) : null;
  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-card backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-lime-400 to-emerald-500 text-white shadow"
          aria-hidden="true"
        >
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{b.title}</h3>
          {b.author && <p className="text-sm text-muted">{b.author}</p>}
          <p className="mt-0.5 text-xs text-muted tabular-nums">
            Page {b.currentPage}
            {b.totalPages ? ` of ${b.totalPages} · ${pct}%` : ""}
          </p>
        </div>
        <BookMenu book={b} onChanged={onChanged} />
      </div>
      {b.totalPages && (
        <div
          className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={pct ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${b.title} progress`}
        >
          <div className="h-full rounded-full bg-linear-to-r from-lime-400 to-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Read today:</span>
        {[5, 10, 20, 50].map((n) => (
          <Button key={n} variant="secondary" size="sm" className="h-8 px-3" onClick={() => onPages(n)}>
            +{n}
          </Button>
        ))}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(custom);
            if (n > 0) onPages(Math.min(2000, Math.round(n)));
            setCustom("");
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="pages"
            aria-label="Pages read today"
            className="h-8 w-16 rounded-full border border-border bg-surface-strong/70 px-2 text-center text-sm focus:border-primary focus:outline-none"
          />
          <Button type="submit" variant="ghost" size="sm" className="h-8 px-2" disabled={!custom}>
            Add
          </Button>
        </form>
      </div>
    </article>
  );
}

function BookMenu({ book: b, onChanged }: { book: Book; onChanged: () => void }) {
  const confirm = useConfirm();
  return (
    <div className="flex items-center gap-1">
      <Select<BookStatus>
        label={`Status of ${b.title}`}
        variant="pill"
        value={b.status}
        onChange={async (status) => {
          await updateBook(b.id, { status }).catch(() => {});
          onChanged();
        }}
        options={[
          { value: "want", label: "Want to read" },
          { value: "reading", label: "Reading" },
          { value: "finished", label: "Finished" },
        ]}
        size="xs"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Delete ${b.title}`}
        onClick={async () => {
          if (!(await confirm({ title: `Delete “${b.title}” and its reading log?`, confirmLabel: "Delete", danger: true }))) return;
          await deleteBook(b.id).catch(() => {});
          onChanged();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function Shelf({ title, books, onChanged }: { title: string; books: Book[]; onChanged: () => void }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wider text-muted uppercase">{title}</h2>
      <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface px-4 shadow-card backdrop-blur-xl">
        {books.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.title}</p>
              <p className="truncate text-xs text-muted">
                {b.author}
                {b.finishedOn &&
                  ` · finished ${new Date(`${b.finishedOn}T12:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}`}
              </p>
            </div>
            <BookMenu book={b} onChanged={onChanged} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewBook({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const [status, setStatus] = useState<BookStatus>("reading");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await createBook({ title, author, totalPages: pages ? Number(pages) : null, status });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Not saved: can't reach Nook.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5 shadow-card">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus error={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_10rem]">
        <Input label="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
        <Input label="Pages" value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="e.g. 320" />
        <Select<BookStatus>
          label="Shelf"
          showLabel
          value={status}
          onChange={setStatus}
          options={[
            { value: "reading", label: "Reading now" },
            { value: "want", label: "Want to read" },
            { value: "finished", label: "Finished" },
          ]}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!title.trim() || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Add book
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Pages per day for 30 days: plain bars, the tallest day is full height
function StatsCard({ stats }: { stats: ReadingStats }) {
  const max = Math.max(1, ...stats.series.map((d) => d.pages));
  return (
    <Card>
      <CardHeader title="Pages read" subtitle="Last 30 days" />
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`Pages per day, last 30 days. ${stats.month} pages in total.`}>
        {stats.series.map((d) => (
          <span
            key={d.day}
            title={`${d.day}: ${d.pages} pages`}
            className={cn("flex-1 rounded-t-sm", d.pages ? "bg-linear-to-t from-lime-400 to-emerald-500" : "bg-surface-muted")}
            style={{ height: `${Math.max(4, (d.pages / max) * 100)}%` }}
          />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
        {[
          ["This week", stats.week],
          ["30 days", stats.month],
          ["This year", stats.year],
          ["Books finished", stats.finishedThisYear],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl bg-surface-muted p-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">
        <Badge>Tip</Badge> 20 pages a day is about a book a fortnight.
      </p>
    </Card>
  );
}
