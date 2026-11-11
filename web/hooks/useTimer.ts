"use client";

// The Stage 1 timer.js, rewritten as a React hook.
// Instead of changing the page ourselves, we keep the time in React state,
// and React re-renders whatever shows it.

import { useCallback, useEffect, useRef, useState } from "react";

export function useTimer(minutes: number, onDone: () => void) {
  const total = minutes * 60 * 1000;
  const [remaining, setRemaining] = useState(total); // ms left
  const [endAt, setEndAt] = useState<number | null>(null); // timestamp while running

  // Keep the latest onDone without restarting the interval when it changes.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // A new length (mode change) resets the timer.
  useEffect(() => {
    setEndAt(null);
    setRemaining(total);
  }, [total]);

  // While running, check the clock 4 times a second.
  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - Date.now());
      setRemaining(left);
      if (left === 0) {
        setEndAt(null);
        onDoneRef.current();
      }
    }, 250);
    return () => clearInterval(id); // cleanup: runs on pause or unmount
  }, [endAt]);

  const start = useCallback(() => {
    if (remaining > 0) setEndAt(Date.now() + remaining);
  }, [remaining]);

  const pause = useCallback(() => setEndAt(null), []);

  const reset = useCallback(() => {
    setEndAt(null);
    setRemaining(total);
  }, [total]);

  return { remaining, running: endAt !== null, start, pause, reset };
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}
