"use client";

// The focus timer and session history, shared by every page.
// Lives in the root layout so a running timer survives moving between pages and apps.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { chime } from "@/features/ambient/engine";
import { useAchievements } from "@/features/achievements/AchievementsProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Mode, Summary } from "@/lib/api/sessions";
import { formatTime, MODES } from "./logic";
import { useCountdown } from "./useCountdown";
import { useSessions, type SessionsStatus } from "./useSessions";

type FocusState = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  time: string; // "24:13"
  remaining: number;
  total: number;
  progress: number; // 0 → 1
  running: boolean;
  active: boolean; // running, or paused part-way
  finished: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
  summary: Summary | null;
  status: SessionsStatus;
};

const FocusContext = createContext<FocusState | null>(null);

const ms = (mode: Mode) => MODES[mode].minutes * 60 * 1000;

export function FocusProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("focus");
  const [finished, setFinished] = useState(false);
  const { user } = useAuth();
  const { summary, status, record } = useSessions(user?.id ?? null);
  const { checkSoon } = useAchievements();

  const handleDone = useCallback(() => {
    chime();
    setFinished(true);
    // POST /api/sessions, then look for new badges (the worker awards them a moment later)
    void record(mode, MODES[mode].minutes).then(checkSoon);
  }, [mode, record, checkSoon]);

  const timer = useCountdown(ms("focus"), handleDone);
  const { set, start, reset } = timer;
  const time = formatTime(timer.remaining);

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      setFinished(false);
      set(ms(m));
    },
    [set],
  );

  useTabTitle(time, timer.running, finished);

  const value: FocusState = {
    mode,
    setMode,
    time,
    remaining: timer.remaining,
    total: timer.total,
    progress: timer.progress,
    running: timer.running,
    active: timer.running || (timer.remaining > 0 && timer.remaining < timer.total),
    finished,
    start: () => {
      setFinished(false);
      start();
    },
    pause: timer.pause,
    reset: () => {
      setFinished(false);
      reset();
    },
    summary,
    status,
  };

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): FocusState {
  const value = useContext(FocusContext);
  if (!value) throw new Error("useFocus must be used inside <FocusProvider>");
  return value;
}

// Countdown in the browser tab. When idle, put back the page's own title.
function useTabTitle(time: string, running: boolean, finished: boolean) {
  const saved = useRef<string | null>(null);
  useEffect(() => {
    if (!running && !finished) {
      if (saved.current !== null) document.title = saved.current;
      saved.current = null;
      return;
    }
    saved.current ??= document.title;
    document.title = running ? `${time} · Focus` : "Time's up! · MyWeb";
  }, [time, running, finished]);
}
