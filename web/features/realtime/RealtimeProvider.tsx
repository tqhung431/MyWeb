"use client";

// One WebSocket per tab, shared by every component (Stage 6).
//
// The browser connects to /api/realtime on the SAME address as the page; Next.js forwards it to the
// API like any /api/* request. The login cookie goes along automatically; guests send their id.
//
// Transport: Next.js's /api forwarding passes normal HTTP requests but not WebSocket "upgrades".
// So socket.io uses HTTP long-polling here: the browser keeps one request open, and the server answers
// it the instant something happens. Same events, same code. Stage 7 (Caddy in front) switches on
// real WebSockets by allowing the "websocket" transport.
//
// What comes in: who's online and focusing ("presence"), the live activity feed, and your badges.
// If the connection drops, socket.io reconnects by itself, and the rest of Nook keeps working.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useMe } from "@/features/me/MeProvider";
import { clientId } from "@/lib/api/clientId";

export type Presence = { online: number; focusing: number };
// Stage 21: text is an English template ("{name} posted in {group}"), filled in and translated where shown
export type Activity = { id: string; icon: string; text: string; params?: Record<string, string | number>; at: string };

type RealtimeState = {
  connected: boolean;
  presence: Presence | null;
  activity: Activity[]; // newest first
  socket: Socket | null;
};

const RealtimeContext = createContext<RealtimeState | null>(null);
const MAX_ACTIVITY = 20;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useMe();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  // (Re)connect when you pick or change your name: the server reads who we are when we connect.
  const userId = user ? `${user.id}:${user.name}` : null;
  useEffect(() => {
    const s = io({
      path: "/api/realtime",
      addTrailingSlash: false,
      auth: { clientId: clientId() },
      // Stage 7: behind Caddy (docker compose), real WebSockets work: NEXT_PUBLIC_REALTIME_WEBSOCKET=1
      // is set when the image is built. Without Caddy, long-polling through the Next.js proxy.
      transports: process.env.NEXT_PUBLIC_REALTIME_WEBSOCKET === "1" ? ["websocket", "polling"] : ["polling"],
      tryAllTransports: true, // if WebSocket is blocked somewhere, fall back to polling
    });
    setSocket(s);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("presence", (p: Presence) => setPresence(p));
    s.on("activity:recent", (list: Activity[]) => setActivity(list.slice(0, MAX_ACTIVITY)));
    s.on("activity", (a: Activity) => setActivity((list) => [a, ...list.filter((x) => x.id !== a.id)].slice(0, MAX_ACTIVITY)));
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [userId]);

  const value = useMemo(() => ({ connected, presence, activity, socket }), [connected, presence, activity, socket]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return value;
}

// Listen to one server event while the component is on screen.
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useRealtime();
  const latest = useRef(handler); // always call the newest handler, without re-subscribing
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => latest.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
