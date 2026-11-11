"use client";

// The music player (Stage 8): a plain <audio> element playing files from MyWeb itself.
// No SoundCloud / YouTube player, so nothing for a firewall to block and no app to open.
// Desktop: bottom-right corner. Phone: a bar above the tab bar.
// Phones also show it on the lock screen (Media Session), with play / pause / next.

import { Info, Loader2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { genreOf } from "./genres";
import { useMusic } from "./MusicProvider";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MusicDock() {
  const { current, queue, next, previous, close } = useMusic();
  const audio = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // A new song: load it and start playing (you just pressed play, so the browser allows it).
  useEffect(() => {
    const el = audio.current;
    if (!el || !current) return;
    setError("");
    setTime(0);
    setDuration(current.durationSec ?? 0);
    el.src = current.audioUrl;
    el.play().catch(() => setPaused(true));
  }, [current]);

  // Lock screen / headphone buttons
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: "MyWeb",
      artwork: current.artworkUrl ? [{ src: current.artworkUrl }] : [],
    });
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // not supported by this browser
      }
    };
    set("play", () => void audio.current?.play());
    set("pause", () => audio.current?.pause());
    set("nexttrack", queue.length > 1 ? next : null);
    set("previoustrack", queue.length > 1 ? previous : null);
    return () => (["play", "pause", "nexttrack", "previoustrack"] as const).forEach((a) => set(a, null));
  }, [current, queue.length, next, previous]);

  if (!current) return null;
  const g = genreOf(current.genre);

  return (
    <section
      aria-label="Music player"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 rounded-2xl border border-border bg-surface-strong/95 p-3 shadow-card backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
    >
      <audio
        ref={audio}
        preload="auto"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => (queue.length > 1 ? next() : setPaused(true))}
        onError={() => {
          setLoading(false);
          setError("This song couldn't be played.");
        }}
      />

      <div className="flex items-center gap-3">
        {current.artworkUrl ? (
          <img src={current.artworkUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white ${g.accent}`}>
            <g.icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{current.title}</p>
          <p className="truncate text-xs text-muted">{error || current.artist}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={close} aria-label="Close player">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted tabular-nums">
        <span className="w-9 text-right">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={Math.floor(time)}
          onChange={(e) => {
            if (audio.current) audio.current.currentTime = Number(e.target.value);
          }}
          aria-label="Position in the song"
          className="h-1 flex-1 cursor-pointer"
        />
        <span className="w-9">{fmt(duration)}</span>
      </div>

      <div className="mt-1 flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={previous} disabled={queue.length < 2} aria-label="Previous song">
          <SkipBack className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="primary"
          size="icon"
          className="h-11 w-11"
          onClick={() => (paused ? void audio.current?.play() : audio.current?.pause())}
          aria-label={paused ? "Play" : "Pause"}
        >
          {loading && !paused ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : paused ? (
            <Play className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Pause className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={next} disabled={queue.length < 2} aria-label="Next song">
          <SkipForward className="h-4 w-4" aria-hidden="true" />
        </Button>
        {(current.credit || current.sourceUrl) && (
          <a
            href={current.sourceUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title={[current.credit, current.license].filter(Boolean).join(" · ")}
            aria-label={`Credits: ${[current.credit, current.license].filter(Boolean).join(", ")}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-text"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
