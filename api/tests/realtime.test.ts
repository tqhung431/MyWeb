// Stage 6: WebSockets. Real servers on random ports, real socket.io clients, real Valkey.

import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Emitter } from "@socket.io/redis-emitter";
import { Redis } from "ioredis";
import request from "supertest";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { processJob } from "../src/jobs/handlers.js";
import { CHANNEL_KEY, setRealtimeServer } from "../src/realtime/emit.js";
import { attachRealtime } from "../src/realtime/server.js";
import { closeAll, resetDatabase } from "./helpers.js";

// Stage 21: activity is a template with params; fill it in like the website does (in English)
type Activity = { text: string; params?: Record<string, string | number> };
const filled = (a: Activity) => a.text.replace(/\{(\w+)\}/g, (m, k: string) => String(a.params?.[k] ?? m));

const app = createApp();
let http: HttpServer;
let io: Server;
let url: string;
const sockets: Socket[] = [];

async function startServer() {
  const server = createServer(app);
  const realtime = await attachRealtime(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, realtime, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

beforeAll(async () => {
  ({ server: http, realtime: io, url } = await startServer());
});
beforeEach(resetDatabase);
afterEach(() => {
  sockets.splice(0).forEach((s) => s.disconnect());
});
afterAll(async () => {
  io.close();
  await closeAll();
});

// A browser tab: connects like the website does (guest id, or a login cookie).
function tab(opts: { clientId?: string; cookie?: string; origin?: string; to?: string; polling?: boolean } = {}): Socket {
  const socket = connect(opts.to ?? url, {
    path: "/api/realtime",
    addTrailingSlash: false,
    transports: [opts.polling ? "polling" : "websocket"],
    auth: { clientId: opts.clientId ?? randomUUID() },
    extraHeaders: { ...(opts.cookie && { cookie: opts.cookie }), ...(opts.origin && { origin: opts.origin }) },
    forceNew: true,
  });
  sockets.push(socket);
  return socket;
}

// Wait for the next event with this name (and, optionally, a matching payload).
function next<T>(socket: Socket, event: string, match: (p: T) => boolean = () => true, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no "${event}" within ${ms} ms`)), ms);
    const handler = (payload: T) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

type Presence = { online: number; focusing: number };

describe("presence", () => {
  it("counts people online and focusing, live, across tabs", async () => {
    const alice = randomUUID();
    const a1 = tab({ clientId: alice });
    expect(await next<Presence>(a1, "presence", (p) => p.online === 1)).toEqual({ online: 1, focusing: 0 });

    const a2 = tab({ clientId: alice }); // a second tab of the same person
    const bob = tab();
    await next<Presence>(a1, "presence", (p) => p.online === 2); // 2 people, 3 tabs

    bob.emit("focus:state", { running: true, mode: "focus" });
    expect(await next<Presence>(a1, "presence", (p) => p.focusing === 1)).toEqual({ online: 2, focusing: 1 });

    bob.disconnect();
    expect(await next<Presence>(a2, "presence", (p) => p.online === 1)).toEqual({ online: 1, focusing: 0 });
  });

  it("works over HTTP long-polling too (what the browser uses behind the Next.js proxy)", async () => {
    const a = tab({ polling: true });
    const b = tab({ polling: true });
    b.emit("focus:state", { running: true, mode: "focus" });
    expect(await next<Presence>(a, "presence", (p) => p.online === 2 && p.focusing === 1)).toEqual({ online: 2, focusing: 1 });
  });

  it("ignores junk sent by a browser", async () => {
    const a = tab();
    await next<Presence>(a, "presence");
    a.emit("focus:state", { running: "yes please", mode: "party" });
    const b = tab();
    expect(await next<Presence>(b, "presence", (p) => p.online === 2)).toEqual({ online: 2, focusing: 0 });
  });
});

describe("security", () => {
  it("refuses connections from other websites", async () => {
    const s = tab({ origin: "https://evil.example" });
    await expect(next(s, "connect_error")).resolves.toBeTruthy();
  });

  it("refuses a connection with neither a sign-in nor a guest id", async () => {
    const s = connect(url, { path: "/api/realtime", addTrailingSlash: false, transports: ["websocket"], forceNew: true });
    sockets.push(s);
    const err = await next<Error>(s, "connect_error");
    expect(err.message).toMatch(/clientId/);
  });
});

describe("live events", () => {
  it("pushes a new badge to its owner only; the feed stays quiet (Stage 28: badges are private unless shared)", async () => {
    const guest = randomUUID();
    const owner = tab({ clientId: guest });
    const stranger = tab();
    // Listen on both at once: one broadcast can reach both tabs together (waiting for one first could miss the other)
    await Promise.all([next(owner, "presence"), next(stranger, "presence")]);

    let strangerGotBadge = false;
    const strangerHeard: Activity[] = [];
    stranger.on("achievement", () => (strangerGotBadge = true));
    stranger.on("activity", (a: Activity) => strangerHeard.push(a));

    await request(app).post("/api/sessions").set("X-Client-Id", guest).send({ mode: "focus", minutes: 25 });
    const badge = next<{ code: string }>(owner, "achievement", (a) => a.code === "first-focus");
    await processJob("achievements", { userId: null, clientId: guest, timeZone: "UTC" }); // what the worker does

    expect((await badge).code).toBe("first-focus");
    await new Promise((r) => setTimeout(r, 150));
    expect(strangerGotBadge).toBe(false);
    expect(strangerHeard).toEqual([]); // no "finished a focus session", no "unlocked"
  });

  it("knows people by their cookie and shows the name they picked", async () => {
    const browser = request.agent(app);
    const reg = await browser.post("/api/me").send({ name: "Linh Pham" });
    const cookie = ([] as string[]).concat(reg.headers["set-cookie"])[0].split(";")[0];

    const phone = tab({ cookie });
    const other = tab();
    await next(phone, "presence");
    const feed = next<Activity>(other, "activity", (a) => filled(a).startsWith("Linh"));
    await browser.post("/api/hobby/groups").send({ name: "Night owls", emoji: "🦉" });
    expect(filled(await feed)).toBe("Linh Pham started the group 🦉 Night owls");
  });

  it("sends the recent feed to a page that connects later", async () => {
    await request(app).post("/api/me").send({ name: "Early Bird" });
    const late = tab();
    const recent = await next<Activity[]>(late, "activity:recent");
    expect(filled(recent[0])).toBe("Early Bird joined Nook");
  });
});

describe("many servers, one Valkey", () => {
  it("delivers events and counts presence across API servers", async () => {
    const second = await startServer(); // like running the API twice behind a load balancer
    setRealtimeServer(io); // events from this test process go out through server 1
    try {
      const onFirst = tab();
      const onSecond = tab({ to: second.url });
      // Presence counted on server 2 includes the browser on server 1
      onSecond.emit("focus:state", { running: true, mode: "focus" });
      expect(await next<Presence>(onFirst, "presence", (p) => p.online === 2 && p.focusing === 1)).toEqual({ online: 2, focusing: 1 });

      // An event published on server 1 reaches the browser on server 2
      const heard = next<Activity>(onSecond, "activity", (a) => filled(a).includes("Far Away"));
      await request(app).post("/api/me").send({ name: "Far Away" });
      expect(filled(await heard)).toBe("Far Away joined Nook");
    } finally {
      second.realtime.close();
      setRealtimeServer(io);
    }
  });

  it("lets the worker (no WebSocket server of its own) reach browsers through Valkey", async () => {
    const guest = randomUUID();
    const owner = tab({ clientId: guest });
    await next(owner, "presence");
    const emitter = new Emitter(new Redis(config.VALKEY_URL), { key: CHANNEL_KEY }); // exactly what the worker uses
    const got = next<{ hello: string }>(owner, "achievement");
    emitter.to(`client:${guest}`).emit("achievement", { hello: "from the worker" });
    expect(await got).toEqual({ hello: "from the worker" });
    emitter.redisClient.disconnect();
  });
});

describe("Hobby Hub rooms (Stage 11)", () => {
  async function personWithCookie(name: string) {
    const agent = request.agent(app);
    const res = await agent.post("/api/me").send({ name });
    return { agent, cookie: ([] as string[]).concat(res.headers["set-cookie"])[0].split(";")[0] };
  }

  it("delivers a chat message to everyone with the group open, and only them", async () => {
    const linh = await personWithCookie("Linh");
    const reader = tab(); // a guest reading the group
    const elsewhere = tab(); // someone on another page
    await Promise.all([next(reader, "presence"), next(elsewhere, "presence")]);
    reader.emit("hobby:join", { slug: "gaming" });
    await new Promise((r) => setTimeout(r, 100));

    let leaked = false;
    elsewhere.on("hobby:message", () => (leaked = true));
    const got = next<{ slug: string; message: { body: string; author: { name: string } } }>(reader, "hobby:message");
    await linh.agent.put("/api/hobby/groups/gaming/membership");
    await linh.agent.post("/api/hobby/groups/gaming/messages").send({ body: "gg!" });
    expect((await got).message).toMatchObject({ body: "gg!", author: { name: "Linh" } });
    await new Promise((r) => setTimeout(r, 200));
    expect(leaked).toBe(false);
  });

  it("passes on 'typing…' from people with a name, never from guests or outside the room", async () => {
    const mai = await personWithCookie("Mai");
    const maiTab = tab({ cookie: mai.cookie });
    const guestTab = tab();
    const reader = tab();
    await Promise.all([next(maiTab, "presence"), next(guestTab, "presence"), next(reader, "presence")]);
    for (const t of [maiTab, guestTab, reader]) t.emit("hobby:join", { slug: "books" });
    await new Promise((r) => setTimeout(r, 100));

    const names: string[] = [];
    reader.on("hobby:typing", (e: { name: string }) => names.push(e.name));
    guestTab.emit("hobby:typing", { slug: "books" }); // no name: ignored
    maiTab.emit("hobby:typing", { slug: "cooking" }); // not in that room: ignored
    maiTab.emit("hobby:typing", { slug: "books" });
    maiTab.emit("hobby:join", { slug: "../../etc" }); // junk: ignored
    await new Promise((r) => setTimeout(r, 300));
    expect(names).toEqual(["Mai"]);
  });

  it("Stage 21: private messages and 'typing…' reach only the other person (all their tabs)", async () => {
    const linh = await personWithCookie("Linh");
    const mai = await personWithCookie("Mai");
    const an = await personWithCookie("An");
    const maiId = (await mai.agent.get("/api/me")).body.user.id as string;
    const maiPhone = tab({ cookie: mai.cookie });
    const maiLaptop = tab({ cookie: mai.cookie });
    const anTab = tab({ cookie: an.cookie });
    const linhTab = tab({ cookie: linh.cookie });
    await Promise.all([maiPhone, maiLaptop, anTab, linhTab].map((t) => next(t, "presence")));

    let leaked = false;
    anTab.on("dm:message", () => (leaked = true));
    anTab.on("dm:typing", () => (leaked = true));
    const typing = next<{ name: string }>(maiPhone, "dm:typing");
    linhTab.emit("dm:typing", { to: maiId });
    expect((await typing).name).toBe("Linh");

    const [onPhone, onLaptop] = [next<{ message: { body: string; mine: boolean } }>(maiPhone, "dm:message"), next(maiLaptop, "dm:message")];
    await linh.agent.post(`/api/hobby/dms/${maiId}`).send({ body: "psst" });
    expect((await onPhone).message).toMatchObject({ body: "psst", mine: false });
    await onLaptop;
    await new Promise((r) => setTimeout(r, 200));
    expect(leaked).toBe(false);
  });
});
