"use client";

// What's playing in Music, for the whole app: the queue, the current song, next / previous.
// The player itself (MusicDock) lives in the root layout, so it keeps playing between pages.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { countPlay, type Song } from "@/lib/api/music";

type MusicState = {
  current: Song | null;
  queue: Song[];
  play: (song: Song, queue?: Song[]) => void;
  next: () => void;
  previous: () => void;
  close: () => void;
};

const MusicContext = createContext<MusicState | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  const start = useCallback((list: Song[], i: number) => {
    setQueue(list);
    setIndex(i);
    void countPlay(list[i].id).catch(() => {}); // for the charts; never blocks the music
  }, []);

  const play = useCallback(
    (song: Song, list?: Song[]) => {
      const q = list?.some((s) => s.id === song.id) ? list : [song];
      start(q, q.findIndex((s) => s.id === song.id));
    },
    [start],
  );

  const next = useCallback(() => {
    if (index === null || queue.length === 0) return;
    start(queue, (index + 1) % queue.length); // after the last song, back to the first
  }, [index, queue, start]);

  const previous = useCallback(() => {
    if (index === null || queue.length === 0) return;
    start(queue, (index - 1 + queue.length) % queue.length);
  }, [index, queue, start]);

  const close = useCallback(() => {
    setIndex(null);
    setQueue([]);
  }, []);

  const current = index === null ? null : (queue[index] ?? null);
  const value = useMemo(() => ({ current, queue, play, next, previous, close }), [current, queue, play, next, previous, close]);
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic(): MusicState {
  const value = useContext(MusicContext);
  if (!value) throw new Error("useMusic must be used inside <MusicProvider>");
  return value;
}
