"use client";

// Stage 21: how many private messages and group posts/messages you haven't seen. Stage 28: private messages
// show on the Messages app's icon, group posts and chats on Hobby Hub's (tab bar, sidebar, apps grid).
//
// One request when the page loads (and after reconnecting), then again when the server says something
// changed: "dm:message", "dm:read", "dm:deleted" and "hobby:unread" arrive in your own room only.
// Many events close together are bundled into one request.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getUnread, type Unread } from "@/lib/api/hobby";

type UnreadState = Unread & { total: number; badge: (href: string) => number; refresh: () => void };
const NONE: Unread = { messages: 0, groups: 0 };
const UnreadContext = createContext<UnreadState>({ ...NONE, total: 0, badge: () => 0, refresh: () => {} });

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useMe();
  const { socket } = useRealtime();
  const [unread, setUnread] = useState<Unread>(NONE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!user) return setUnread(NONE);
    setUnread(await getUnread().catch(() => NONE));
  }, [user]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 250);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!socket) return;
    socket.on("connect", refresh);
    return () => void socket.off("connect", refresh);
  }, [socket, refresh]);

  useRealtimeEvent("dm:message", refresh);
  useRealtimeEvent("dm:read", refresh);
  useRealtimeEvent("dm:deleted", refresh);
  useRealtimeEvent("hobby:unread", refresh);

  // Stage 28: two badges: private messages on Messages, group posts and chats on Hobby Hub
  const value = useMemo(
    () => ({
      ...unread,
      total: unread.messages + unread.groups,
      badge: (href: string) => (href === "/messages" ? unread.messages : href === "/hobby-hub" ? unread.groups : 0),
      refresh,
    }),
    [unread, refresh],
  );
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);

// The little number on an icon: "9+" past 9
export function UnreadDot({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] leading-none font-bold text-white tabular-nums ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
