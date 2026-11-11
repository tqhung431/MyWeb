"use client";

// The focus timer and session history, shared by every page.
// Lives in the root layout so a running timer survives moving between pages and apps.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { chime } from "@/features/ambient/engine";
import { useAchievements } from "@/features/achievements/AchievementsProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtime } from "@/features/realtime/RealtimeProvider";
import type { Mode, Summary } from "@/lib/api/sessions";
import { savePreferences } from "@/lib/api/auth";
import { cleanDurations, DEFAULT_DURATIONS, formatTime, type Durations } from "./logic";
import { useCountdown } from "./useCountdown";
import { useSessions, type SessionsStatus } from "./useSessions";

type FocusState = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  durations: Durations; // minutes per mode
  setDurations: (d: Partial<Durations>) => void;
  pendingDurations: boolean; // new length chosen during a session: used from the next one
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

const DURATIONS_KEY = "timerDurations";

function readLocalDurations(): Durations | null {
  try {
    const raw = localStorage.getItem(DURATIONS_KEY);
    return raw ? cleanDurations(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("focus");
  const [finished, setFinished] = useState(false);
  const { user } = useAuth();
  const { summary, status, record } = useSessions(user?.id ?? null);
  const { checkSoon } = useAchievements();

  // Stage 7: your own lengths (minutes). Saved in this browser, and in your account when signed in.
  const [durations, setDurationsState] = useState<Durations>(DEFAULT_DURATIONS);
  const ms = useCallback((m: Mode) => durations[m] * 60 * 1000, [durations]);

  const handleDone = useCallback(() => {
    chime();
    setFinished(true);
    // POST /api/sessions, then look for new badges (the worker awards them a moment later)
    void record(mode, durations[mode]).then(checkSoon);
  }, [mode, durations, record, checkSoon]);

  const timer = useCountdown(DEFAULT_DURATIONS.focus * 60 * 1000, handleDone);
  const { set, start, reset } = timer;
  const time = formatTime(timer.remaining);

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      setFinished(false);
      set(ms(m));
    },
    [set, ms],
  );

  // Use new lengths right away, unless a session is under way: then they start with the next one.
  const idle = !timer.running && timer.remaining === timer.total;
  const applyDurations = useCallback(
    (d: Durations) => {
      setDurationsState(d);
      if (idle) set(d[mode] * 60 * 1000);
    },
    [idle, mode, set],
  );

  // Load saved lengths: from your account when signed in, else from this browser.
  // (Runs when someone signs in or out, or their saved lengths change on another device.)
  const accountTimer = user?.preferences?.timer;
  const savedKey = accountTimer ? `${accountTimer.focus}/${accountTimer.short}/${accountTimer.long}` : `local:${user?.id ?? ""}`;
  const applyRef = useRef(applyDurations);
  applyRef.current = applyDurations;
  useEffect(() => {
    const saved = accountTimer ? cleanDurations(accountTimer) : readLocalDurations();
    if (saved) applyRef.current(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedKey sums up accountTimer
  }, [savedKey]);

  const setDurations = useCallback(
    (input: Partial<Durations>) => {
      const d = cleanDurations({ ...durations, ...input });
      applyDurations(d);
      try {
        localStorage.setItem(DURATIONS_KEY, JSON.stringify(d));
      } catch {
        // storage blocked: kept for this visit
      }
      if (user) void savePreferences({ timer: d }).catch(() => {}); // follows you to other devices
    },
    [durations, applyDurations, user],
  );

  useTabTitle(time, timer.running, finished);

  // Stage 6: tell the server when this tab starts or stops focusing (for "N people focusing now").
  // Sent again after a reconnect, because the server forgets a socket when it drops.
  const { socket, connected } = useRealtime();
  useEffect(() => {
    if (socket && connected) socket.emit("focus:state", { running: timer.running, mode });
  }, [socket, connected, timer.running, mode]);

  const value: FocusState = {
    mode,
    setMode,
    durations,
    setDurations,
    pendingDurations: !idle && durations[mode] * 60 * 1000 !== timer.total,
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
