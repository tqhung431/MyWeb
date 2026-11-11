// The WebSocket server (Socket.IO), sharing the API's port at /api/realtime.
//
// HTTP is "ask, then answer". A WebSocket stays open, so the SERVER can speak first:
// "a badge was unlocked", "3 people are focusing now". No more asking every few seconds.
//
// Events
//   browser → server   "focus:state"  { running, mode }      I started / stopped my timer
//   server → browser   "presence"     { online, focusing }   counted across all servers
//                      "activity:recent" [ … ]               the last 20 events, right after connecting
//                      "activity"     { icon, text, at }     shown in everyone's live feed
//                      "achievement"  { code, title, … }     only to the person who earned it

import type { Server as HttpServer, IncomingMessage } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { COOKIE_NAME, userFromToken } from "../auth/sessions.js";
import { config } from "../config.js";
import { isAllowedOrigin } from "../middleware/security.js";
import { waitForValkey } from "../valkey/client.js";
import { CHANNEL_KEY, ownerRoom, recentActivity, setRealtimeServer, type Owner } from "./emit.js";

export type Presence = { online: number; focusing: number };

type SocketData = Owner & { name: string | null; focusing: boolean };

const focusState = z.object({ running: z.boolean(), mode: z.enum(["focus", "short", "long"]) });

export async function attachRealtime(http: HttpServer): Promise<Server> {
  const io = new Server(http, {
    path: "/api/realtime",
    addTrailingSlash: false, // "/api/realtime", not "/api/realtime/": Next.js would redirect the slash away
    serveClient: false,
    // Only pages from our own site may connect (same check as POST requests: stops other
    // websites from opening a socket with your cookie).
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      const ok = !origin || isAllowedOrigin(origin, header(req, "x-forwarded-host") ?? header(req, "host"));
      callback(null, ok);
    },
  });

  // With Valkey, every API server shares events and can count everyone's sockets.
  // Without it, real-time still works for the browsers on this one server.
  if (await waitForValkey(1500)) {
    const pub = new Redis(config.VALKEY_URL);
    const sub = pub.duplicate();
    pub.on("error", () => {});
    sub.on("error", () => {});
    io.adapter(createAdapter(pub, sub, { key: CHANNEL_KEY, requestsTimeout: 2000 }));
  } else {
    console.warn("Real-time: Valkey unavailable, running on this server only.");
  }

  // Who is this? Same answer as for HTTP requests: the login cookie, or the guest id.
  io.use(async (socket, next) => {
    try {
      const token = parseCookies(socket.request.headers.cookie)[COOKIE_NAME];
      const user = await userFromToken(token);
      const clientId = z.uuid().safeParse(socket.handshake.auth?.clientId);
      if (!user && !clientId.success) return next(new Error("Send a clientId or sign in"));
      const data: SocketData = {
        userId: user?.id ?? null,
        clientId: user ? null : clientId.data!,
        name: user?.name ?? null,
        focusing: false,
      };
      socket.data = data;
      next();
    } catch {
      next(new Error("Sign-in check failed"));
    }
  });

  const schedulePresence = presenceBroadcaster(io);

  io.on("connection", async (socket: Socket) => {
    const data = socket.data as SocketData;
    await socket.join(ownerRoom(data)); // all of this person's tabs and PCs
    socket.emit("activity:recent", await recentActivity()); // catch up on what happened before
    schedulePresence();

    socket.on("focus:state", (raw: unknown) => {
      const parsed = focusState.safeParse(raw); // never trust what a browser sends
      if (!parsed.success) return;
      data.focusing = parsed.data.running && parsed.data.mode === "focus";
      schedulePresence();
    });

    socket.on("disconnect", () => schedulePresence());
  });

  setRealtimeServer(io);
  return io;
}

// Count people (not tabs) online and focusing, across ALL servers, then tell everyone.
// Many changes in a short time are bundled into one update (every 300 ms at most).
function presenceBroadcaster(io: Server) {
  let timer: NodeJS.Timeout | null = null;
  return () => {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      try {
        const sockets = await io.fetchSockets(); // asks the other servers too, through Valkey
        const online = new Set<string>();
        const focusing = new Set<string>();
        for (const s of sockets) {
          const data = s.data as SocketData;
          const who = ownerRoom(data);
          online.add(who);
          if (data.focusing) focusing.add(who);
        }
        const presence: Presence = { online: online.size, focusing: focusing.size };
        io.emit("presence", presence);
      } catch {
        // another server didn't answer in time: the next change will try again
      }
    }, 300);
  };
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
