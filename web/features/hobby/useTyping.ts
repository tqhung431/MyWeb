"use client";

// "Linh is typing…": names shown for a few seconds after their last keystroke (never stored anywhere).

import { useCallback, useEffect, useState } from "react";

const TYPING_MS = 3500;

export function useTyping(myName: string | undefined) {
  const [typing, setTyping] = useState<Record<string, number>>({}); // name → shown until

  const started = useCallback(
    (name: string) => {
      if (name !== myName) setTyping((t) => ({ ...t, [name]: Date.now() + TYPING_MS }));
    },
    [myName],
  );
  const stopped = useCallback((name: string) => setTyping(({ [name]: _, ...rest }) => rest), []);

  // Forget "typing…" after a few quiet seconds
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const id = setInterval(() => setTyping((t) => Object.fromEntries(Object.entries(t).filter(([, until]) => until > Date.now()))), 1000);
    return () => clearInterval(id);
  }, [typing]);

  return { names: Object.keys(typing), started, stopped };
}
