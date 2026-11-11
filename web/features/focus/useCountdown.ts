"use client";

// A countdown hook. Like Stage 1's timer.js, it stores the END time, not a tick count,
// so it stays accurate even when the browser slows down a background tab.
//
// Stage 3.5 change: the length is set with set(ms) when you pick a mode,
// instead of an effect reacting to a prop. Fewer effects = fewer surprises.

import { useCallback, useEffect, useRef, useState } from "react";

export function useCountdown(initialMs: number, onDone: () => void) {
  const [total, setTotal] = useState(initialMs);
  const [remaining, setRemaining] = useState(initialMs);
  const [endAt, setEndAt] = useState<number | null>(null); // a timestamp while running

  // Always call the newest onDone, without restarting the interval.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const left = Math.max(0, endAt - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id); // stop now: don't wait for React's cleanup, or onDone could run twice
        setEndAt(null);
        onDoneRef.current();
      }
    }, 250);
    return () => clearInterval(id); // cleanup on pause or unmount
  }, [endAt]);

  const start = useCallback(() => {
    if (endAt === null && remaining > 0) setEndAt(Date.now() + remaining);
  }, [endAt, remaining]);

  const pause = useCallback(() => {
    if (endAt === null) return;
    setRemaining(Math.max(0, endAt - Date.now())); // exact, not the last tick
    setEndAt(null);
  }, [endAt]);

  const set = useCallback((ms: number) => {
    setEndAt(null);
    setTotal(ms);
    setRemaining(ms);
  }, []);

  const reset = useCallback(() => {
    setEndAt(null);
    setRemaining(total);
  }, [total]);

  return {
    total,
    remaining,
    running: endAt !== null,
    progress: total > 0 ? 1 - remaining / total : 0, // 0 → 1
    start,
    pause,
    set,
    reset,
  };
}
