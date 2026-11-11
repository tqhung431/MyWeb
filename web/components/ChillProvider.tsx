"use client";

// Shared state for the whole app: which sound is playing, and the focus timer.
//
// It lives in the root layout, which stays mounted when you move between pages.
// So a running timer keeps counting while you read the Tips page.
// Any client component can read it with useChill().

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as Ambient from "@/lib/ambient";
import type { TrackName } from "@/lib/ambient";
import { formatTime, useTimer } from "@/hooks/useTimer";
import { useSessions } from "@/hooks/useSessions";

export const MODES = {
  focus: { label: "Focus 25", minutes: 25 },
  short: { label: "Break 5", minutes: 5 },
  long: { label: "Long 15", minutes: 15 },
} as const;

export type Mode = keyof typeof MODES; // "focus" | "short" | "long"

function useChillState() {
  // --- sound ---
  const [playing, setPlaying] = useState<TrackName | null>(null);
  const [volume, setVolumeState] = useState(60);

  const toggleTrack = useCallback(
    (name: TrackName) => {
      if (playing === name) {
        Ambient.stop();
        setPlaying(null);
      } else {
        Ambient.play(name);
        setPlaying(name);
      }
    },
    [playing],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    Ambient.setVolume(v / 100);
  }, []);

  // --- timer ---
  const [mode, setModeState] = useState<Mode>("focus");
  const [finished, setFinished] = useState(false);
  const { summary, status: sessionsStatus, record } = useSessions(); // saved in PostgreSQL via the API

  const handleDone = useCallback(() => {
    Ambient.chime();
    setFinished(true);
    void record(mode, MODES[mode].minutes); // POST /api/sessions
  }, [mode, record]);

  const timer = useTimer(MODES[mode].minutes, handleDone);
  const time = formatTime(timer.remaining);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setFinished(false);
  }, []);

  // Countdown in the browser tab, on every page.
  // When the timer is idle we put back the page's own title (set by Next.js metadata).
  const savedTitle = useRef<string | null>(null);
  useEffect(() => {
    if (!timer.running && !finished) {
      if (savedTitle.current !== null) document.title = savedTitle.current;
      savedTitle.current = null;
      return;
    }
    if (savedTitle.current === null) savedTitle.current = document.title;
    document.title = timer.running ? `${time} · Chill Corner` : "Time's up! · Chill Corner";
  }, [time, timer.running, finished]);

  return {
    playing,
    volume,
    toggleTrack,
    setVolume,
    mode,
    setMode,
    time,
    remaining: timer.remaining,
    total: MODES[mode].minutes * 60 * 1000,
    running: timer.running,
    start: () => {
      setFinished(false);
      timer.start();
    },
    pause: timer.pause,
    reset: () => {
      setFinished(false);
      timer.reset();
    },
    sessions: summary,
    sessionsStatus,
  };
}

type ChillState = ReturnType<typeof useChillState>;

const ChillContext = createContext<ChillState | null>(null);

export function ChillProvider({ children }: { children: ReactNode }) {
  const value = useChillState();
  return <ChillContext.Provider value={value}>{children}</ChillContext.Provider>;
}

export function useChill(): ChillState {
  const value = useContext(ChillContext);
  if (!value) throw new Error("useChill must be used inside <ChillProvider>");
  return value;
}
