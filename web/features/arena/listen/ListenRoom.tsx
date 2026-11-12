"use client";

// Stage 22: a Listen Together room. The server says "song X started at server time T (or is paused at second S)";
// this page works out where the song should be right now (with the measured clock offset) and keeps the
// <audio> element there: it jumps only when it's more than a third of a second off, so you don't hear stutters.

import { Check, Copy, Crown, Heart, Loader2, Pause, Play, Plus, Search, SkipForward, Trash2, Users, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useArena, useArenaEvent, useArenaRoom } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import { useMusic } from "@/features/music/MusicProvider";
import type { ListenRoomState } from "@/lib/api/arena";
import { getCharts, type ChartSong } from "@/lib/api/music";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";

const REACTIONS = [
  { id: "love", emoji: "💖" },
  { id: "fire", emoji: "🔥" },
  { id: "haha", emoji: "😂" },
  { id: "clap", emoji: "👏" },
  { id: "wow", emoji: "😮" },
] as const;
const DRIFT = 0.35; // seconds off before we jump

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ListenRoom({ code }: { code: string }) {
  const t = useT();
  const { user } = useMe();
  const music = useMusic();
  const { ask, serverNow } = useArena();
  const [state, setState] = useState<ListenRoomState | null>(null);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false); // the browser wants a tap before it plays sound
  const [position, setPosition] = useState(0);
  const [floating, setFloating] = useState<{ id: number; emoji: string; name: string; x: number }[]>([]);
  const [copied, setCopied] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const floatId = useRef(0);

  useArenaRoom(code, setError);
  useArenaEvent<ListenRoomState>("room:state", (s) => {
    if (s.code === code && s.kind === "listen") setState(s);
  });
  useArenaEvent<{ name: string; emoji: string }>("listen:reaction", (r) => float(r.emoji, r.name));

  const float = (id: string, name: string) => {
    const emoji = REACTIONS.find((r) => r.id === id)?.emoji ?? "✨";
    const item = { id: ++floatId.current, emoji, name, x: 10 + Math.random() * 80 };
    setFloating((f) => [...f.slice(-12), item]);
    setTimeout(() => setFloating((f) => f.filter((x) => x.id !== item.id)), 2600);
  };

  // Nook's own music player would play over the room: stop it while you're here
  const { close: closeMusic, current: musicPlaying } = music;
  useEffect(() => {
    if (musicPlaying) closeMusic();
  }, [musicPlaying, closeMusic]);

  const now = state?.listen.now;
  const wanted = useCallback(() => {
    if (!now) return 0;
    return ((now.pausedAt ?? serverNow()) - now.startedAt) / 1000;
  }, [now, serverNow]);

  // Keep the audio element in step with the room
  const sync = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    if (!now) {
      if (!el.paused) el.pause();
      return;
    }
    const src = now.song.audioUrl;
    if (!el.src.endsWith(src)) {
      el.src = src;
      el.dataset.key = String(now.key);
    }
    const target = wanted();
    if (Math.abs(el.currentTime - target) > DRIFT && el.readyState > 0) el.currentTime = Math.max(0, target);
    if (now.pausedAt !== null) {
      if (!el.paused) el.pause();
    } else if (el.paused) {
      el.play().then(
        () => setBlocked(false),
        (e: Error) => e.name === "NotAllowedError" && setBlocked(true),
      );
    }
  }, [now, wanted]);

  useEffect(() => {
    sync();
    const id = setInterval(() => {
      sync();
      setPosition(wanted());
    }, 1000);
    return () => clearInterval(id);
  }, [sync, wanted]);

  if (!user && !state) return <NeedName why={t("Pick a name so the room knows who added which song.")} />;
  if (!state) {
    return (
      <div className="flex items-center gap-2 text-muted">
        {error ? (
          <>
            <X className="h-4 w-4" aria-hidden="true" /> {error}{" "}
            <Link href="/arena/listen" className="font-semibold text-primary">
              {t("Back")}
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("Joining…")}
          </>
        )}
      </div>
    );
  }

  const L = state.listen;
  const isHost = user?.id === L.hostId;
  const canControl = isHost || L.everyoneControls;
  const send = async (event: string, payload: object = {}) => {
    const a = await ask(event, { code, ...payload });
    if (!a.ok && a.error) setError(a.error);
    else setError("");
  };
  const online = state.members.filter((m) => m.online);
  const duration = now?.song.durationSec ?? 0;
  const copy = async () => {
    await navigator.clipboard?.writeText(`${location.origin}/arena/listen/${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* hidden player: the room decides what plays */}
      <audio ref={audio} preload="auto" onEnded={() => now && send("listen:ended", { key: now.key })} onLoadedMetadata={sync} />

      <div className="flex min-w-0 flex-col gap-5">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-fuchsia-600 via-rose-500 to-orange-400 p-5 text-white shadow-card sm:p-7">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {floating.map((f) => (
              <span key={f.id} className="listen-float absolute bottom-2 flex flex-col items-center text-3xl" style={{ left: `${f.x}%` }}>
                {f.emoji}
                <span className="rounded-full bg-black/25 px-1.5 text-[10px] font-semibold">{f.name}</span>
              </span>
            ))}
          </div>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">{L.name}</p>
              <p className="font-mono text-sm font-bold tracking-[0.2em] text-white/90">{code}</p>
            </div>
            <Button variant="light" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? t("Copied") : t("Invite")}
            </Button>
          </div>

          <div className="relative mt-5 flex items-center gap-4">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/20 shadow-lg sm:h-28 sm:w-28">
              {now?.song.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={now.song.artworkUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Volume2 className={cn("h-10 w-10", now && !now.pausedAt && "animate-pulse")} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {now ? (
                <>
                  <p className="truncate text-xl font-extrabold">{now.song.title}</p>
                  <p className="truncate text-white/85">{now.song.artist}</p>
                  <p className="mt-1 text-xs text-white/75">{t("Added by {name}", { name: now.addedBy.name })}</p>
                </>
              ) : (
                <p className="text-lg font-bold">{t("Nothing playing. Add a song below!")}</p>
              )}
            </div>
          </div>

          {now && (
            <div className="relative mt-4">
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                step={1}
                value={Math.min(position, duration)}
                disabled={!canControl || !duration}
                onChange={(e) => send("listen:seek", { seconds: Number(e.target.value) })}
                aria-label={t("Position")}
                className="w-full accent-white"
              />
              <div className="flex justify-between text-xs text-white/80 tabular-nums">
                <span>{mmss(Math.min(position, duration || position))}</span>
                <span>{duration ? mmss(duration) : "–:––"}</span>
              </div>
            </div>
          )}

          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            {blocked ? (
              <Button variant="light" size="md" onClick={() => audio.current?.play().then(() => setBlocked(false), () => {})}>
                <Volume2 className="h-4 w-4" aria-hidden="true" /> {t("Tap to hear the room")}
              </Button>
            ) : (
              now &&
              canControl && (
                <Button variant="light" size="md" onClick={() => send(now.pausedAt === null ? "listen:pause" : "listen:resume")} aria-label={now.pausedAt === null ? t("Pause") : t("Play")}>
                  {now.pausedAt === null ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                </Button>
              )
            )}
            {now && (
              <Button variant="light" size="md" onClick={() => send("listen:skip")}>
                <SkipForward className="h-4 w-4" aria-hidden="true" /> {canControl ? t("Skip") : t("Vote to skip ({n})", { n: L.skipVotes })}
              </Button>
            )}
            <div className="ml-auto flex gap-1">
              {REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-label={r.id}
                  onClick={() => {
                    float(r.id, user?.name ?? "");
                    void ask("listen:react", { code, emoji: r.id });
                  }}
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/15 text-xl transition hover:scale-110 hover:bg-white/25 active:scale-95"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </div>
        </section>
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}

        <Card>
          <CardHeader title={t("Up next")} subtitle={t("Most hearts plays first")} />
          {L.queue.length === 0 ? (
            <p className="text-sm text-muted">{t("The queue is empty.")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {L.queue.map((q, i) => (
                <li key={q.key} className="flex items-center gap-3 rounded-2xl border border-border p-2.5">
                  <span className="w-5 text-center text-sm font-bold text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{q.song.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {q.song.artist} · {t("added by {name}", { name: q.addedBy.name })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => send("listen:vote", { key: q.key })}
                    aria-pressed={q.voted}
                    aria-label={t("Heart")}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold transition",
                      q.voted ? "bg-rose-500 text-white" : "bg-surface-muted text-muted hover:text-rose-500",
                    )}
                  >
                    <Heart className={cn("h-4 w-4", q.voted && "fill-current")} aria-hidden="true" /> {q.votes}
                  </button>
                  {(isHost || q.addedBy.id === user?.id) && (
                    <button type="button" onClick={() => send("listen:remove", { key: q.key })} aria-label={t("Remove")} className="cursor-pointer rounded-full p-1.5 text-muted hover:text-rose-500">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {user && <SongPicker onAdd={(songId) => send("listen:add", { songId })} />}
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title={t("In the room")} subtitle={t("{n} listening", { n: online.length })} />
          <ul className="flex flex-col gap-2">
            {online.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <Avatar name={m.name} size="sm" />
                <span className="flex-1 truncate font-semibold">{m.name}</span>
                {m.id === L.hostId && <Crown className="h-4 w-4 text-amber-500" aria-label={t("Host")} />}
              </li>
            ))}
          </ul>
          {isHost && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={L.everyoneControls} onChange={(e) => send("listen:everyone", { on: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
              {t("Everyone can pause and skip")}
            </label>
          )}
          {!isHost && !L.everyoneControls && <p className="mt-3 text-xs text-muted">{t("The host controls the music. Others vote to skip.")}</p>}
        </Card>
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {t("Songs come from Nook's Music library.")}{" "}
          <Link href="/music/add" className="font-semibold text-primary">
            {t("Add songs")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function SongPicker({ onAdd }: { onAdd: (songId: number) => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [songs, setSongs] = useState<ChartSong[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const id = setTimeout(
      () =>
        getCharts("all", "all", { q, limit: 12 })
          .then(setSongs, () => setSongs([]))
          .finally(() => setLoading(false)),
      q ? 250 : 0,
    );
    return () => clearTimeout(id);
  }, [q]);
  return (
    <Card>
      <CardHeader title={t("Add a song")} />
      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 px-3 focus-within:border-primary">
        <Search className="h-4 w-4 text-muted" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search songs or artists")} className="h-11 min-w-0 flex-1 bg-transparent focus:outline-none" />
      </label>
      {loading ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />
      ) : songs.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("No songs found.")}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {songs.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onAdd(s.id)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl p-2 text-left transition hover:bg-surface-muted">
                <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.title}</span>
                  <span className="block truncate text-xs text-muted">{s.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
