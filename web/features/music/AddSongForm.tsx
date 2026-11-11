"use client";

import { CheckCircle2, Link2, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { addSong, type Genre, type Song } from "@/lib/api/music";
import { cn } from "@/lib/cn";
import { GENRES } from "./genres";
import { useMusic } from "./MusicProvider";

export function AddSongForm() {
  const [url, setUrl] = useState("");
  const [genre, setGenre] = useState<Genre>("drill");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Song | null>(null);
  const { play } = useMusic();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setAdded(null);
    try {
      setAdded(await addSong(url, genre));
      setUrl("");
    } catch (err) {
      // The API explains: not SoundCloud/YouTube, not found, embedding not allowed, already added...
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Can't reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Input
            label="Song link"
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://soundcloud.com/artist/song  or  https://youtu.be/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            hint="One song from SoundCloud or YouTube (the Share → Copy link button)."
          />

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Genre</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={genre === g.id}
                  onClick={() => setGenre(g.id)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-2 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    genre === g.id ? "border-primary/50 bg-primary/10" : "border-border bg-surface-strong/50 hover:border-primary/30",
                  )}
                >
                  <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br text-white", g.accent)}>
                    <g.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{g.label}</span>
                    <span className="block text-xs text-muted">{g.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={pending || !url}>
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Link2 className="h-5 w-5" aria-hidden="true" />}
            {pending ? "Checking with the music site…" : "Add song"}
          </Button>
        </form>

        {added && (
          <div role="status" className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{added.title}</p>
              <p className="truncate text-sm text-muted">{added.artist} · added to the charts</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => play(added)}>
              <Play className="h-4 w-4" aria-hidden="true" /> Play
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Finding good songs</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            On SoundCloud, search e.g. <em>vietnamese drill</em>, <em>vinahouse remix</em>, <em>v-pop</em> or <em>lofi chill</em>, open a song, then
            Share → Copy link.
          </li>
          <li>
            On YouTube, open the official music video and copy the address. Artists&apos; own channels are best.
          </li>
          <li>
            Prefer <strong className="text-text">official uploads</strong> by the artist or label. Re-uploads by strangers may be removed.
          </li>
          <li>Songs only play here if their owner allows embedding; MyWeb checks this when you add one.</li>
        </ul>
        <Link href="/music" className={buttonClasses("ghost", "sm", "mt-4 -ml-3")}>
          ← Back to the charts
        </Link>
      </Card>
    </div>
  );
}
