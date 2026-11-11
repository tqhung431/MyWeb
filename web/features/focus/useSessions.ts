"use client";

// Focus sessions, saved in PostgreSQL through the API.

import { useCallback, useEffect, useState } from "react";
import { getSummary, saveSession, type Mode, type Summary } from "@/lib/api/sessions";

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
