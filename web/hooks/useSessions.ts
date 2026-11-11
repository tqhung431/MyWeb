"use client";

// Focus sessions, now saved in PostgreSQL through the API (Stage 2 used localStorage).

import { useCallback, useEffect, useState } from "react";
import { getSummary, saveSession, type Mode, type Summary } from "@/lib/api";

export type SessionsStatus = "loading" | "ready" | "offline";

export function useSessions() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<SessionsStatus>("loading");

  const refresh = useCallback(async () => {
    try {
      setSummary(await getSummary());
      setStatus("ready");
    } catch {
      setStatus("offline"); // API not running or not reachable
    }
  }, []);

  // Load once when the app starts in the browser.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const record = useCallback(
    async (mode: Mode, minutes: number) => {
      try {
        await saveSession(mode, minutes);
        await refresh(); // read back what the database now says
      } catch {
        setStatus("offline");
      }
    },
    [refresh],
  );

  return { summary, status, record };
}
