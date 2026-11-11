"use client";

// The charts: songs ranked by MyWeb listeners (plays + 3 × likes) this week, this month or all time.
// They update live: when anyone plays or adds a song, everyone's chart refreshes.

import { CloudOff, Heart, ListMusic, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getCharts, setLike, type Genre, type Period, type Song } from "@/lib/api/music";
import { cn } from "@/lib/cn";
import { genreOf, GENRES } from "./genres";
import { useMusic } from "./MusicProvider";

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function Charts() {
  const [period, setPeriod] = useState<Period>("week");
  const [genre, setGenre] = useState<Genre | "all">("all");
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [offline, setOffline] = useState(false);
  const { play, current } = useMusic();

  const load = useCallback(async () => {
    try {
      setSongs(await getCharts(period, genre));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [period, genre]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: anyone played, liked or added a song → reload and re-sort (at most every 0.8 s)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent("music:changed", () => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      void load();
    }, 800);
  });

  async function toggleLike(song: Song) {
    // Show it at once ("optimistic"), then take the server's numbers
    setSongs((list) => list?.map((s) => (s.id === song.id ? { ...s, liked: !s.liked, likes: s.likes + (s.liked ? -1 : 1) } : s)) ?? null);
    try {
      const r = await setLike(song.id, !song.liked);
      setSongs((list) => list?.map((s) => (s.id === song.id ? { ...s, liked: r.liked, likes: r.likes } : s)) ?? null);
    } catch {
      void load(); // undo by reloading
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl label="Chart period" options={PERIODS} value={period} onChange={setPeriod} />
        <div className="flex gap-2">
          {songs && songs.length > 0 && (
            <Button variant="primary" size="sm" onClick={() => play(songs[0], songs)}>
              <Play className="h-4 w-4" aria-hidden="true" /> Play all
            </Button>
          )}
          <Link href="/music/add" className={buttonClasses("secondary", "sm")}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a song
          </Link>
        </div>
      </div>

      <SegmentedControl
        label="Genre"
        options={[{ value: "all" as const, label: "All" }, ...GENRES.map((g) => ({ value: g.id, label: g.label }))]}
        value={genre}
        onChange={setGenre}
      />

      <Card className="p-2 sm:p-3">
        {offline && (
          <p className="flex items-center gap-2 p-4 text-sm text-muted">
            <CloudOff className="h-5 w-5" aria-hidden="true" /> Can&apos;t reach the API right now.
          </p>
        )}
        {!offline && songs === null && <p className="p-4 text-sm text-muted">Loading the charts…</p>}
        {!offline && songs?.length === 0 && <Empty genre={genre} />}
        {songs && songs.length > 0 && (
          <ol className="flex flex-col">
            {songs.map((song, i) => (
              <Row
                key={song.id}
                rank={i + 1}
                song={song}
                period={period}
                playing={current?.id === song.id}
                onPlay={() => play(song, songs)}
                onLike={() => toggleLike(song)}
              />
            ))}
          </ol>
        )}
      </Card>

      <p className="text-xs text-muted">
        Ranked by MyWeb listeners: plays + 3 × likes {period === "all" ? "of all time" : period === "week" ? "in the last 7 days" : "in the last 30 days"}.
        Songs stream from SoundCloud or YouTube: the artists keep their rights and get the plays.
      </p>
    </div>
  );
}

function Row({ rank, song, period, playing, onPlay, onLike }: { rank: number; song: Song; period: Period; playing: boolean; onPlay: () => void; onLike: () => void }) {
  const g = genreOf(song.genre);
  return (
    <li className={cn("group flex items-center gap-3 rounded-2xl p-2 transition sm:gap-4", playing ? "bg-primary/10" : "hover:bg-surface-muted")}>
      <span
        className={cn(
          "w-7 shrink-0 text-center text-lg font-bold tabular-nums",
          rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-orange-600" : "text-muted",
        )}
      >
        {rank}
      </span>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Play ${song.title} by ${song.artist}`}
        className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {song.artworkUrl ? (
          <img src={song.artworkUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={cn("flex h-full w-full items-center justify-center bg-linear-to-br text-white", g.accent)}>
            <g.icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          <Play className="h-5 w-5" aria-hidden="true" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-semibold", playing && "text-primary")}>{song.title}</p>
        <p className="truncate text-sm text-muted">
          {song.artist} · {song.provider === "youtube" ? "YouTube" : "SoundCloud"}
        </p>
      </div>
      <span className="hidden sm:block">
        <Badge>{g.label}</Badge>
      </span>
      <span className="hidden w-24 text-right text-xs text-muted tabular-nums md:block" title={`plays ${period === "all" ? "in total" : `this ${period}`}`}>
        {song.plays} {song.plays === 1 ? "play" : "plays"}
      </span>
      <button
        type="button"
        onClick={onLike}
        aria-pressed={song.liked}
        aria-label={song.liked ? `Unlike ${song.title}` : `Like ${song.title}`}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          song.liked ? "bg-rose-500/12 text-rose-600 dark:text-rose-300" : "text-muted hover:bg-surface-muted hover:text-text",
        )}
      >
        <Heart className={cn("h-4 w-4", song.liked && "fill-current")} aria-hidden="true" />
        {song.likes}
      </button>
    </li>
  );
}

function Empty({ genre }: { genre: Genre | "all" }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <ListMusic className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="font-semibold">No {genre === "all" ? "" : `${genreOf(genre).label} `}songs yet</p>
      <p className="max-w-sm text-sm text-muted">
        Add a song from SoundCloud or YouTube. Everyone on MyWeb can play it, and the charts fill up as people listen and like.
      </p>
      <Link href="/music/add" className={buttonClasses("primary", "md")}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Add the first song
      </Link>
    </div>
  );
}
