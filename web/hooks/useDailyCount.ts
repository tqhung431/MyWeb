"use client";

// Today's focus-session count, saved in localStorage.
//
// localStorage only exists in the browser. The server renders 0 first,
// then this effect reads the real value after the page loads ("hydration").

import { useCallback, useEffect, useState } from "react";

const KEY = "sessions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): number {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return saved.date === today() ? Number(saved.count) || 0 : 0;
  } catch {
    return 0;
  }
}

export function useDailyCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(read());
  }, []);

  const increment = useCallback(() => {
    const next = read() + 1;
    try {
      localStorage.setItem(KEY, JSON.stringify({ date: today(), count: next }));
    } catch {
      // storage blocked: keep the count for this visit only
    }
    setCount(next);
  }, []);

  return { count, increment };
}
