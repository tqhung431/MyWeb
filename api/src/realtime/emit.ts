// Sending live events to browsers, from anywhere: the API process or the worker.
//
//   API process  → has the Socket.IO server itself (io): emit directly
//   Worker       → has no WebSocket server; it publishes through Valkey with the Socket.IO
//                  "emitter", and every API server's adapter forwards it to its browsers
//
//   worker ──publish──► Valkey ──► API server 1 ──► browsers connected to server 1
//                              └─► API server 2 ──► browsers connected to server 2

import { randomUUID } from "node:crypto";
import { Emitter } from "@socket.io/redis-emitter";
import { Redis } from "ioredis";
import type { Server } from "socket.io";
import { config } from "../config.js";
import { valkey, valkeyReady } from "../valkey/client.js";

export type Activity = { id: string; icon: string; text: string; at: string };
export type Owner = { userId: string | null; clientId: string | null };

const RECENT_KEY = "activity:recent";
const RECENT_MAX = 20;

let io: Server | null = null;
let emitter: Emitter | null = null;

// Called by the API process once its Socket.IO server exists.
// Valkey's publish/subscribe channels are shared by ALL its numbered databases, so two MyWeb setups
// on one Valkey (e.g. your dev server and the tests) would hear each other. A per-setup channel
// name keeps them apart: "myweb-socket.io" in dev, "myweb-test-socket.io" in tests.
export const CHANNEL_KEY = `${config.QUEUE_NAME}-socket.io`;

export function setRealtimeServer(server: Server | null) {
  io = server;
}

// The small part both Socket.IO's server and its emitter share: "send to everyone / to a room".
type Sender = { emit(event: string, payload: unknown): unknown; to(room: string): { emit(event: string, payload: unknown): unknown } };

function target(): Sender | null {
  if (io) return io;
  if (!valkeyReady()) return null; // worker without Valkey: nobody to tell
  if (!emitter) {
    const connection = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: 1, commandTimeout: 1500 });
    connection.on("error", () => {});
    emitter = new Emitter(connection, { key: CHANNEL_KEY });
  }
  return emitter;
}

export function closeEmitter(): void {
  (emitter as unknown as { redisClient?: Redis } | null)?.redisClient?.disconnect();
  emitter = null;
}

// Each person's browsers (tabs, PCs) join one "room", so we can talk to just them.
export function ownerRoom({ userId, clientId }: Owner): string {
  return userId ? `user:${userId}` : `client:${clientId}`;
}

export function notifyOwner(owner: Owner, event: string, payload: unknown): void {
  target()?.to(ownerRoom(owner)).emit(event, payload);
}

// Something happened that everyone may see ("Linh finished a focus session").
// Kept in a short list in Valkey too, so a page opened later can show recent activity.
export async function publishActivity(icon: string, text: string): Promise<void> {
  const activity: Activity = { id: randomUUID(), icon, text, at: new Date().toISOString() };
  if (valkeyReady()) {
    await valkey
      .multi()
      .lpush(RECENT_KEY, JSON.stringify(activity))
      .ltrim(RECENT_KEY, 0, RECENT_MAX - 1) // keep only the newest 20
      .exec()
      .catch(() => {});
  }
  target()?.emit("activity", activity);
}

export async function recentActivity(): Promise<Activity[]> {
  if (!valkeyReady()) return [];
  const items = await valkey.lrange(RECENT_KEY, 0, RECENT_MAX - 1).catch(() => [] as string[]);
  return items.map((i) => JSON.parse(i) as Activity);
}

// How people appear in the public activity feed: first name only, or "A guest".
export function displayName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : "A guest";
}
