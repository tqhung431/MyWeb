"use client";

// What's playing in Music, for the whole app: the queue, the current song, next / previous,
// repeat, shuffle and volume. The player itself (MusicDock) lives in the root layout,
// so it keeps playing between pages.
//
// Stage 10: repeat / shuffle / volume are remembered in this browser (localStorage).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { countPlay, type Song as FullSong } from "@/lib/api/music";
import { nextIndex, nextRepeat, previousIndex, removeAt, shuffled, type Repeat } from "./queue";

// What the player needs. Songs from the charts have more; the Companion's song cards have just this.
export type Song = Pick<FullSong, "id" | "title" | "artist" | "genre" | "audioUrl" | "artworkUrl"> & Partial<FullSong>;

type Settings = { repeat: Repeat; shuffle: boolean; volume: number; muted: boolean };
const DEFAULTS: Settings = { repeat: "off", shuffle: false, volume: 0.8, muted: false };
const STORAGE_KEY = "nook.music";

type MusicState = Settings & {
  current: Song | null;
  index: number | null;
  queue: Song[];
  /** shuffle: true turns shuffle on for this queue ("Shuffle" button) */
  play: (song: Song, queue?: Song[], options?: { shuffle?: boolean }) => void;
  /** Add to the end of the queue (or start playing, if nothing is). */
  enqueue: (song: Song) => void;
  jumpTo: (index: number) => void;
  remove: (index: number) => void;
  /** Returns false when there is nothing after this song (repeat off, last song). */
  next: (auto?: boolean) => boolean;
  previous: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  close: () => void;
};

const MusicContext = createContext<MusicState | null>(null);

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
    return {
      repeat: saved.repeat === "all" || saved.repeat === "one" ? saved.repeat : "off",
      shuffle: saved.shuffle === true,
      volume: typeof saved.volume === "number" && saved.volume >= 0 && saved.volume <= 1 ? saved.volume : DEFAULTS.volume,
      muted: saved.muted === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [original, setOriginal] = useState<Song[] | null>(null); // the order before shuffling
  const [index, setIndex] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Read the saved settings after the first render (the server can't see localStorage)
  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // private mode: just don't remember
    }
  }, [settings, loaded]);

  const start = useCallback((list: Song[], i: number) => {
    setQueue(list);
    setIndex(i);
    void countPlay(list[i].id).catch(() => {}); // for the charts; never blocks the music
  }, []);

  const play = useCallback(
    (song: Song, list?: Song[], options?: { shuffle?: boolean }) => {
      const q = list?.some((s) => s.id === song.id) ? list : [song];
      const i = q.findIndex((s) => s.id === song.id);
      if (options?.shuffle) setSettings((s) => ({ ...s, shuffle: true }));
      if (settings.shuffle || options?.shuffle) {
        setOriginal(q);
        start(shuffled(q, i), 0);
      } else {
        setOriginal(null);
        start(q, i);
      }
    },
    [start, settings.shuffle],
  );

  const enqueue = useCallback(
    (song: Song) => {
      if (index === null) return play(song);
      if (queue.some((s) => s.id === song.id)) return;
      setQueue((q) => [...q, song]);
      setOriginal((o) => (o ? [...o, song] : o));
    },
    [index, queue, play],
  );

  const jumpTo = useCallback((i: number) => queue[i] && start(queue, i), [queue, start]);

  const remove = useCallback(
    (i: number) => {
      if (index === null) return;
      const gone = queue[i];
      const r = removeAt(queue, index, i);
      setQueue(r.list);
      setOriginal((o) => o?.filter((s) => s !== gone) ?? null);
      setIndex(r.index);
      if (i === index && r.index !== null) void countPlay(r.list[r.index].id).catch(() => {});
    },
    [index, queue],
  );

  const next = useCallback(
    (auto = false) => {
      if (index === null) return false;
      const n = nextIndex(queue.length, index, settings.repeat, auto);
      if (n === null) return false;
      start(queue, n);
      return true;
    },
    [index, queue, settings.repeat, start],
  );

  const previous = useCallback(() => {
    if (index === null) return;
    const p = previousIndex(queue.length, index, settings.repeat);
    if (p !== null) start(queue, p);
  }, [index, queue, settings.repeat, start]);

  const toggleShuffle = useCallback(() => {
    const on = !settings.shuffle;
    setSettings((s) => ({ ...s, shuffle: on }));
    if (index === null) return;
    const playing = queue[index];
    if (on) {
      setOriginal(queue);
      setQueue(shuffled(queue, index));
      setIndex(0);
    } else if (original) {
      setQueue(original);
      setIndex(Math.max(0, original.indexOf(playing)));
      setOriginal(null);
    }
  }, [settings.shuffle, index, queue, original]);

  const cycleRepeat = useCallback(() => setSettings((s) => ({ ...s, repeat: nextRepeat(s.repeat) })), []);
  const setVolume = useCallback((volume: number) => setSettings((s) => ({ ...s, volume, muted: volume === 0 ? s.muted : false })), []);
  const toggleMute = useCallback(() => setSettings((s) => ({ ...s, muted: !s.muted })), []);

  const close = useCallback(() => {
    setIndex(null);
    setQueue([]);
    setOriginal(null);
  }, []);

  const current = index === null ? null : (queue[index] ?? null);
  const hasNext = index !== null && nextIndex(queue.length, index, settings.repeat, false) !== null;
  const hasPrevious = index !== null && previousIndex(queue.length, index, settings.repeat) !== null;

  const value = useMemo(
    () => ({
      ...settings,
      current,
      index,
      queue,
      play,
      enqueue,
      jumpTo,
      remove,
      next,
      previous,
      hasNext,
      hasPrevious,
      cycleRepeat,
      toggleShuffle,
      setVolume,
      toggleMute,
      close,
    }),
    [
      settings,
      current,
      index,
      queue,
      play,
      enqueue,
      jumpTo,
      remove,
      next,
      previous,
      hasNext,
      hasPrevious,
      cycleRepeat,
      toggleShuffle,
      setVolume,
      toggleMute,
      close,
    ],
  );
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic(): MusicState {
  const value = useContext(MusicContext);
  if (!value) throw new Error("useMusic must be used inside <MusicProvider>");
  return value;
}
