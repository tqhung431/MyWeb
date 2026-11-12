"use client";

// Stage 22: the connection to Nook's game server (Socket.IO on /api/arena). Only pages that need it
// (Nook Arena, Nook TV) open it, so the rest of Nook doesn't keep a second connection.
//
// Listen Together needs to know the server's time to the millisecond: `offset` is "server clock − this
// device's clock", measured with a few pings (half the round trip is the travel time one way).

import { io, type Socket } from "socket.io-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMe } from "@/features/me/MeProvider";
import { tNow } from "@/lib/i18n/core";

export type Ack = { ok: boolean; error?: string; code?: string; [k: string]: unknown };

type ArenaState = {
  socket: Socket | null;
  connected: boolean;
  /** Send an event and wait for the server's answer */
  ask: (event: string, payload?: unknown) => Promise<Ack>;
  /** Server time now, in ms (this device's clock corrected by the measured offset) */
  serverNow: () => number;
};

const ArenaContext = createContext<ArenaState | null>(null);

export function ArenaProvider({ children }: { children: ReactNode }) {
  const { user } = useMe();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const offset = useRef(0);

  // The server reads who you are (cookie) when you connect: reconnect when you pick or change your name
  const who = user ? `${user.id}:${user.name}` : null;
  useEffect(() => {
    const s = io({
      path: "/api/arena",
      addTrailingSlash: false,
      transports: process.env.NEXT_PUBLIC_REALTIME_WEBSOCKET === "1" ? ["websocket", "polling"] : ["polling"],
      tryAllTransports: true,
    });
    setSocket(s);
    const measure = async () => {
      let best = Infinity;
      for (let i = 0; i < 4; i++) {
        const sent = Date.now();
        const ack = await new Promise<Ack>((r) => s.timeout(3000).emit("time", {}, (err: unknown, a: Ack) => r(err ? { ok: false } : a)));
        const back = Date.now();
        if (!ack.ok || typeof ack.now !== "number") continue;
        const trip = back - sent;
        if (trip < best) {
          best = trip;
          offset.current = (ack.now as number) + trip / 2 - back;
        }
      }
    };
    s.on("connect", () => {
      setConnected(true);
      void measure();
    });
    s.on("disconnect", () => setConnected(false));
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [who]);

  const ask = useCallback(
    (event: string, payload: unknown = {}) =>
      new Promise<Ack>((resolve) => {
        if (!socket?.connected) return resolve({ ok: false, error: tNow("Not connected") });
        socket.timeout(8000).emit(event, payload, (err: unknown, ack: Ack) => resolve(err ? { ok: false, error: tNow("The game server didn't answer") } : ack));
      }),
    [socket],
  );
  const serverNow = useCallback(() => Date.now() + offset.current, []);

  const value = useMemo(() => ({ socket, connected, ask, serverNow }), [socket, connected, ask, serverNow]);
  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArena(): ArenaState {
  const value = useContext(ArenaContext);
  if (!value) throw new Error("useArena must be used inside <ArenaProvider>");
  return value;
}

export function useArenaEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useArena();
  const latest = useRef(handler);
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

/** Join a room while the page is open (and again after a reconnect); leave when the page closes. */
export function useArenaRoom(code: string, onError: (message: string) => void) {
  const { socket, ask } = useArena();
  const { user } = useMe();
  const err = useRef(onError);
  useEffect(() => {
    err.current = onError;
  });
  useEffect(() => {
    if (!socket) return;
    const join = () => void ask("room:join", { code }).then((a) => !a.ok && err.current(a.error ?? tNow("Can't join this room")));
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      if (socket.connected) socket.emit("room:leave", { code }, () => {});
    };
  }, [socket, ask, code, user?.id]);
}
