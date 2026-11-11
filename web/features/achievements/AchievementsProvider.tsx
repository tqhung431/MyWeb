"use client";

// Your badges, and the "Achievement unlocked!" pop-ups.
//
// Badges are awarded by the API's background worker, a moment AFTER a session is saved.
// Stage 6: the worker pushes each new badge over the WebSocket ("achievement" event), so it
// appears instantly. Only when the live connection is down do we fall back to asking a few
// times (checkSoon), like Stage 5.

import { Award, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getAchievements, type Achievement } from "@/lib/api/achievements";
import { BadgeIcon } from "./BadgeIcon";

type AchievementsState = {
  list: Achievement[];
  status: "loading" | "ready" | "offline";
  checkSoon: () => void; // call after something that might earn a badge
};

const AchievementsContext = createContext<AchievementsState | null>(null);
const RETRIES_MS = [700, 1500, 3000, 6000];

export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [list, setList] = useState<Achievement[]>([]);
  const [status, setStatus] = useState<AchievementsState["status"]>("loading");
  const [toasts, setToasts] = useState<Achievement[]>([]);
  const known = useRef<Set<string> | null>(null); // codes already earned when we last looked
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = useCallback(async (announce: boolean) => {
    try {
      const fresh = await getAchievements();
      const earned = fresh.filter((a) => a.earnedAt);
      if (announce && known.current) {
        const added = earned.filter((a) => !known.current!.has(a.code));
        if (added.length) setToasts((t) => [...t, ...added]);
      }
      known.current = new Set(earned.map((a) => a.code));
      setList(fresh);
      setStatus("ready");
    } catch {
      setStatus("offline");
    }
  }, []);

  const { connected } = useRealtime();

  // Live: a badge arrives the moment the worker awards it.
  useRealtimeEvent<Achievement>("achievement", (badge) => {
    if (known.current?.has(badge.code)) return; // already shown
    known.current?.add(badge.code);
    setToasts((t) => [...t, badge]);
    setList((items) => items.map((a) => (a.code === badge.code ? { ...a, earnedAt: badge.earnedAt } : a)));
  });

  // Fallback when offline: ask again a few times.
  const checkSoon = useCallback(() => {
    if (connected) return;
    timers.current.forEach(clearTimeout);
    timers.current = RETRIES_MS.map((ms) => setTimeout(() => void load(true), ms));
  }, [load, connected]);

  // First load, and again when someone signs in or out (different badges), without pop-ups.
  // After signing in, the worker re-checks badges from the merged guest + account history while
  // the WebSocket is reconnecting as the new user; one extra look a moment later catches those.
  const userId = user?.id ?? null;
  useEffect(() => {
    known.current = null;
    void load(false);
    if (!userId) return;
    const id = setTimeout(() => void load(true), 2500);
    return () => clearTimeout(id);
  }, [load, userId]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const value = useMemo(() => ({ list, status, checkSoon }), [list, status, checkSoon]);

  return (
    <AchievementsContext.Provider value={value}>
      {children}
      <Toasts items={toasts} onClose={(code) => setToasts((t) => t.filter((a) => a.code !== code))} />
    </AchievementsContext.Provider>
  );
}

export function useAchievements(): AchievementsState {
  const value = useContext(AchievementsContext);
  if (!value) throw new Error("useAchievements must be used inside <AchievementsProvider>");
  return value;
}

// --- "Achievement unlocked" pop-ups ------------------------------------------

function Toasts({ items, onClose }: { items: Achievement[]; onClose: (code: string) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:top-6 sm:items-end">
      {items.map((a) => (
        <Toast key={a.code} achievement={a} onClose={() => onClose(a.code)} />
      ))}
    </div>
  );
}

function Toast({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  // Close after 6 s. The ref keeps the timer from restarting when the parent re-renders.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-primary/30 bg-surface-strong/95 p-3 pr-2 shadow-card backdrop-blur-xl">
      <BadgeIcon name={achievement.icon} earned size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-xs font-semibold tracking-wider text-primary uppercase">
          <Award className="h-3.5 w-3.5" aria-hidden="true" /> Achievement unlocked
        </p>
        <p className="truncate font-bold">{achievement.title}</p>
        <p className="truncate text-xs text-muted">{achievement.description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-text"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
