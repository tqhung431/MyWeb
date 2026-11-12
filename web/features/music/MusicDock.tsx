"use client";

// The music player (Stage 8, improved in Stage 10): a plain <audio> element playing files from Nook itself.
// No SoundCloud / YouTube player, so nothing for a firewall to block and no app to open.
//
// Desktop: a full player in the bottom-right corner.
// Phone:   a slim bar above the tab bar; tap the arrow to open the full player.
// Full player: seek, shuffle, previous / play / next, repeat (off → all → one), volume, the queue.
// Phones also show it on the lock screen (Media Session), with play / pause / next / seek.

import {
  ChevronDown,
  ChevronUp,
  Info,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Equalizer } from "@/features/ambient/Equalizer";
import { cn } from "@/lib/cn";
import { genreOf } from "./genres";
import { useMusic, type Song } from "./MusicProvider";
import { formatTime } from "./queue";

import { useT } from "@/lib/i18n/I18nProvider";
import { tx } from "@/lib/i18n/core";
const REPEAT_LABEL = { off: tx("Repeat is off"), all: tx("Repeating the queue"), one: tx("Repeating this song") } as const;

export function MusicDock() {
  const t = useT();
  const music = useMusic();
  const { current, queue, index, repeat, shuffle, volume, muted } = music;
  const audio = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [canSetVolume, setCanSetVolume] = useState(true);

  // Desktop starts with the full player; phones with the slim bar.
  useEffect(() => {
    setExpanded(window.matchMedia("(min-width: 1024px)").matches);
  }, []);

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

  // iPhones and iPads ignore audio.volume (only the hardware buttons change it), so hide the slider there.
  const showsPlayer = current !== null;
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = 0.5;
    setCanSetVolume(el.volume === 0.5);
  }, [showsPlayer]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted, showsPlayer]);

  // Lock screen / headphone buttons
  const { next, previous, hasNext } = music;
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: "Nook",
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
    set("nexttrack", hasNext ? () => next() : null);
    set("previoustrack", () => previous());
    set("seekto", (d) => {
      if (audio.current && d.seekTime !== undefined) audio.current.currentTime = d.seekTime;
    });
    return () => (["play", "pause", "nexttrack", "previoustrack", "seekto"] as const).forEach((a) => set(a, null));
  }, [current, hasNext, next, previous]);

  if (!current) return null;
  const g = genreOf(current.genre);
  const el = () => audio.current;

  const togglePlay = () => (paused ? void el()?.play() : el()?.pause());
  // Like most players: Previous restarts the song if it's been playing for more than 3 seconds.
  const goBack = () => {
    const a = el();
    if (a && (a.currentTime > 3 || !music.hasPrevious)) a.currentTime = 0;
    else music.previous();
  };
  const onEnded = () => {
    const a = el();
    if (repeat === "one" && a) {
      a.currentTime = 0;
      void a.play();
    } else if (!music.next(true)) {
      setPaused(true);
    }
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const credits = [current.credit, current.license].filter(Boolean).join(" · ");

  const playButton = (big: boolean) => (
    <Button variant="primary" size="icon" className={big ? "h-12 w-12" : "h-10 w-10"} onClick={togglePlay} aria-label={paused ? t("Play") : t("Pause")}>
      {loading && !paused ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : paused ? (
        <Play className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Pause className="h-5 w-5" aria-hidden="true" />
      )}
    </Button>
  );

  return (
    <section
      aria-label={t("Music player")}
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-2xl border border-border bg-surface-strong/95 shadow-card backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
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
        onEnded={onEnded}
        onError={() => {
          setLoading(false);
          setError(t("This song couldn't be played."));
        }}
      />

      {expanded && showQueue && <QueueList queue={queue} index={index} paused={paused} onJump={music.jumpTo} onRemove={music.remove} />}

      <div className="p-3">
        <div className="flex items-center gap-3">
          <Artwork song={current} accent={g.accent} Icon={g.icon} size={expanded ? "h-12 w-12" : "h-10 w-10"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{current.title}</p>
            <p className={cn("truncate text-xs", error ? "text-rose-500" : "text-muted")}>{error || current.artist}</p>
          </div>
          {!expanded && (
            <>
              {playButton(false)}
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => music.next()} disabled={!music.hasNext} aria-label={t("Next song")}>
                <SkipForward className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setExpanded((x) => !x)}
            aria-expanded={expanded}
            aria-label={expanded ? t("Show less") : t("Show the full player")}
          >
            {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
          </Button>
          {expanded && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={music.close} aria-label={t("Close player")}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {expanded ? (
          <>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted tabular-nums">
              <span className="w-9 text-right">{formatTime(time)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                value={Math.floor(time)}
                onChange={(e) => {
                  const a = el();
                  if (a) a.currentTime = Number(e.target.value);
                }}
                aria-label={t("Position in the song")}
                aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
                className="h-1 flex-1 cursor-pointer"
              />
              <span className="w-9">{formatTime(duration)}</span>
            </div>

            <div className="mt-1 flex items-center justify-between px-1">
              <ToggleButton active={shuffle} onClick={music.toggleShuffle} label={shuffle ? t("Shuffle is on") : t("Shuffle is off")}>
                <Shuffle className="h-4 w-4" aria-hidden="true" />
              </ToggleButton>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={goBack} aria-label={t("Previous song")}>
                <SkipBack className="h-5 w-5" aria-hidden="true" />
              </Button>
              {playButton(true)}
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => music.next()} disabled={!music.hasNext} aria-label={t("Next song")}>
                <SkipForward className="h-5 w-5" aria-hidden="true" />
              </Button>
              <ToggleButton active={repeat !== "off"} onClick={music.cycleRepeat} label={t("{state}. Change repeat", { state: t(REPEAT_LABEL[repeat]) })}>
                {repeat === "one" ? <Repeat1 className="h-4 w-4" aria-hidden="true" /> : <Repeat className="h-4 w-4" aria-hidden="true" />}
              </ToggleButton>
            </div>

            <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={music.toggleMute}
                aria-label={muted ? t("Unmute") : t("Mute")}
                aria-pressed={muted}
              >
                <VolumeIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
              {canSetVolume ? (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={muted ? 0 : Math.round(volume * 100)}
                  onChange={(e) => music.setVolume(Number(e.target.value) / 100)}
                  aria-label={t("Volume")}
                  aria-valuetext={`${muted ? 0 : Math.round(volume * 100)}%`}
                  className="h-1 w-24 cursor-pointer"
                />
              ) : (
                <span className="text-xs text-muted">{t("Use your device's volume buttons")}</span>
              )}
              <span className="flex-1" />
              {(current.credit || current.sourceUrl) && (
                <a
                  href={current.sourceUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={credits}
                  aria-label={t("Credits: {list}", { list: credits })}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-text"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-9 px-3", showQueue && "bg-primary/10 text-primary")}
                onClick={() => setShowQueue((x) => !x)}
                aria-expanded={showQueue}
                aria-label={queue.length === 1 ? t("Queue, 1 song") : t("Queue, {n} songs", { n: queue.length })}
              >
                <ListMusic className="h-4 w-4" aria-hidden="true" />
                <span className="tabular-nums">{queue.length}</span>
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {/* The slim bar's progress line */}
      {!expanded && (
        <div className="h-1 bg-surface-muted" aria-hidden="true">
          <div className="h-full bg-linear-to-r from-primary to-primary-2 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
    </section>
  );
}

function Artwork({ song, accent, Icon, size }: { song: Song; accent: string; Icon: React.ComponentType<{ className?: string }>; size: string }) {
  return song.artworkUrl ? (
    <img src={song.artworkUrl} alt="" className={cn("shrink-0 rounded-xl object-cover", size)} />
  ) : (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white", accent, size)}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function ToggleButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "text-primary" : "text-muted hover:bg-surface-muted hover:text-text",
      )}
    >
      {children}
      {active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />}
    </button>
  );
}

type QueueProps = { queue: Song[]; index: number | null; paused: boolean; onJump: (i: number) => void; onRemove: (i: number) => void };

function QueueList({ queue, index, paused, onJump, onRemove }: QueueProps) {
  const t = useT();
  const playingRow = useRef<HTMLLIElement>(null);
  useEffect(() => {
    playingRow.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <div className="border-b border-border bg-surface-muted/50">
      <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wider text-muted uppercase">{t("Up next")}</p>
      <ol className="max-h-56 overflow-y-auto px-2 pb-2" aria-label={t("Queue")}>
        {queue.map((song, i) => {
          const playing = i === index;
          return (
            <li
              key={`${song.id}-${i}`}
              ref={playing ? playingRow : undefined}
              className={cn("group flex items-center gap-1 rounded-xl", playing && "bg-primary/10")}
            >
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={playing ? "true" : undefined}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex w-5 shrink-0 justify-center text-xs text-muted tabular-nums">
                  {playing && !paused ? (
                    <span className="text-primary">
                      <Equalizer />
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-medium", playing && "text-primary")}>{song.title}</span>
                  <span className="block truncate text-xs text-muted">{song.artist}</span>
                </span>
              </button>
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={t("Remove {title} from the queue", { title: song.title })}
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted opacity-100 hover:bg-surface-muted hover:text-text focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
