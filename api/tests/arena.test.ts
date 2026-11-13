// Stage 22: the game server for real over Socket.IO (chess, Listen Together, screen-share signalling),
// plus the web routes around it (admin passcode, Nook TV, chess history).

import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { alleyGameForTests, alleyTick, attachArena, resetArena, setArenaClock, tick } from "../src/arena/server.js";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { parseYouTube } from "../src/routes/arena.js";
import { closeAll, ORIGIN, resetDatabase, SITE_HOST } from "./helpers.js";

const app = createApp();
let http: HttpServer;
let io: Server;
let url: string;
const sockets: Socket[] = [];
let clock = 1_000_000;

beforeAll(async () => {
  http = createServer();
  io = attachArena(http);
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  setArenaClock(() => clock);
});
beforeEach(async () => {
  await resetDatabase();
  resetArena();
  clock = 1_000_000;
});
afterEach(() => sockets.splice(0).forEach((s) => s.disconnect()));
afterAll(async () => {
  io.close();
  await closeAll();
});

async function person(name: string) {
  const res = await request(app).post("/api/me").send({ name });
  return { id: res.body.user.id as string, cookie: ([] as string[]).concat(res.headers["set-cookie"])[0].split(";")[0] };
}

async function socketFor(cookie?: string) {
  const s = connect(url, { path: "/api/arena", addTrailingSlash: false, transports: ["websocket"], extraHeaders: cookie ? { cookie } : {}, forceNew: true });
  sockets.push(s);
  await new Promise<void>((r, j) => {
    s.once("connect", () => r());
    s.once("connect_error", j);
  });
  return s;
}

type Ack = { ok: boolean; error?: string; code?: string; [k: string]: unknown };
const ask = (s: Socket, event: string, payload: unknown = {}) => new Promise<Ack>((r) => s.emit(event, payload, r));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateWhere = (s: Socket, match: (st: any) => boolean, ms = 3000) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new Promise<any>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no matching room:state")), ms);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = (st: any) => {
      if (!match(st)) return;
      clearTimeout(t);
      s.off("room:state", h);
      resolve(st);
    };
    s.on("room:state", h);
  });

describe("chess over the game server", () => {
  it("two people play Fool's mate; the result and ratings are saved, with a line in the live feed", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    const a = await socketFor(ann.cookie);
    const b = await socketFor(bou.cookie);

    const made = await ask(a, "chess:create", { timeControl: "5+0", color: "w" });
    expect(made.ok).toBe(true);
    const code = made.code as string;
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect((await ask(a, "room:join", { code })).ok).toBe(true);
    expect((await ask(a, "arena:rooms", { kind: "chess" })).rooms).toEqual([expect.objectContaining({ code, white: "Ann", status: "waiting" })]);

    const started = stateWhere(a, (st) => st.chess !== null);
    expect((await ask(b, "room:join", { code })).ok).toBe(true);
    const st = await started;
    expect(st.seats.w.name).toBe("Ann");
    expect(st.seats.b.name).toBe("Bou");
    expect(st.chess.clock).toEqual({ w: 300_000, b: 300_000 });

    expect((await ask(b, "chess:move", { code, from: "e7", to: "e5" })).error).toBe("It's not your turn");
    for (const [s, from, to] of [
      [a, "f2", "f3"],
      [b, "e7", "e5"],
      [a, "g2", "g4"],
    ] as const) {
      clock += 1000;
      expect((await ask(s, "chess:move", { code, from, to })).ok).toBe(true);
    }
    const over = stateWhere(a, (x) => x.chess?.result);
    await ask(b, "chess:move", { code, from: "d8", to: "h4" });
    expect((await over).chess.result).toEqual({ result: "0-1", reason: "checkmate" });

    await expect.poll(async () => (await pool.query("select result, reason, mode from chess_games")).rows).toEqual([{ result: "0-1", reason: "checkmate", mode: "live" }]);
    const board = await request(app).get("/api/chess/leaderboard");
    expect(board.body.map((r: { name: string; rating: number }) => [r.name, r.rating])).toEqual([
      ["Bou", 1216],
      ["Ann", 1184],
    ]);
    const games = await request(app).get("/api/chess/games?mine=1").set("Cookie", ann.cookie);
    expect(games.body).toHaveLength(1);
    const one = await request(app).get(`/api/chess/games/${games.body[0].id}`).set("Cookie", ann.cookie);
    expect(one.body.pgn).toContain("Qh4#");
    expect(one.body.mine).toBe(true);

    // Rematch: both ask, colours swap
    const again = stateWhere(a, (x) => x.chess && !x.chess.result);
    await ask(a, "chess:rematch", { code });
    await ask(b, "chess:rematch", { code });
    expect((await again).seats.w.name).toBe("Bou");
  });

  it("flags a player whose clock runs out, and guests can only watch", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    const a = await socketFor(ann.cookie);
    const b = await socketFor(bou.cookie);
    const guest = await socketFor();
    expect((await ask(guest, "chess:create", {})).error).toBe("Pick a name first");

    const { code } = await ask(a, "chess:create", { timeControl: "5+0", color: "b" });
    await ask(a, "room:join", { code });
    await ask(b, "room:join", { code });
    await ask(guest, "room:join", { code });
    expect((await ask(guest, "chess:move", { code, from: "e2", to: "e4" })).error).toBe("Pick a name first");

    clock += 300_000; // white (Bou) never moves
    const over = stateWhere(guest, (x) => x.chess?.result);
    await tick();
    expect((await over).chess.result).toEqual({ result: "0-1", reason: "time" });
  });

  it("a player gone for two minutes loses", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    const a = await socketFor(ann.cookie);
    const b = await socketFor(bou.cookie);
    const { code } = await ask(a, "chess:create", { timeControl: "none", color: "w" });
    await ask(a, "room:join", { code });
    await ask(b, "room:join", { code });
    b.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    clock += 121_000;
    const over = stateWhere(a, (x) => x.chess?.result);
    await tick();
    expect((await over).chess.result).toEqual({ result: "1-0", reason: "abandoned" });
  });
});

describe("Listen Together over the game server", () => {
  it("adds a song, everyone sees it playing from the same moment, reactions reach the others", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    const { rows } = await pool.query(
      "insert into songs (file_name, sha256, mime_type, size_bytes, title, artist, genre, license, duration_sec) values ('x.mp3','abc','audio/mpeg',1,'Rain','Lo','lofi','Own work',200) returning id",
    );
    const songId = rows[0].id as number;
    const a = await socketFor(ann.cookie);
    const b = await socketFor(bou.cookie);

    expect((await ask(a, "time")).now).toBe(clock);
    const { code } = await ask(a, "listen:create", { name: "Friday night" });
    await ask(a, "room:join", { code });
    await ask(b, "room:join", { code });

    const playing = stateWhere(b, (x) => x.listen?.now);
    expect((await ask(a, "listen:add", { code, songId })).ok).toBe(true);
    const st = await playing;
    expect(st.listen.now).toMatchObject({ startedAt: clock, pausedAt: null, song: { title: "Rain", audioUrl: `/api/songs/${songId}/audio` } });
    expect((await ask(a, "listen:add", { code, songId: 99999 })).error).toBe("Song not found");

    const reaction = new Promise((r) => b.once("listen:reaction", r));
    a.emit("listen:react", { code, emoji: "fire" });
    expect(await reaction).toEqual({ name: "Ann", emoji: "fire" });

    // The song ends by its length: nothing left, so the room goes quiet
    clock += 201_000;
    const quiet = stateWhere(b, (x) => x.listen && x.listen.now === null);
    await tick();
    await quiet;
  });
});

describe("Nook TV", () => {
  it("only the admin (passcode) adds videos; everyone sees the shelves", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    expect((await request(app).get("/api/admin").set("Cookie", ann.cookie)).body).toEqual({ enabled: true, isAdmin: false });
    const wrong = await request(app).post("/api/admin").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send({ passcode: "nope" });
    expect(wrong.status).toBe(403);
    const add = { url: "https://youtu.be/dQw4w9WgXcQ", shelf: "Music", title: "A song" };
    expect((await request(app).post("/api/tv").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send(add)).status).toBe(403);

    const ok = await request(app).post("/api/admin").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send({ passcode: "let-me-in-please" });
    expect(ok.body.isAdmin).toBe(true);
    const created = await request(app).post("/api/tv").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send(add);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ kind: "video", youtubeId: "dQw4w9WgXcQ", shelf: "Music", position: 0 });
    const dup = await request(app).post("/api/tv").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send(add);
    expect(dup.status).toBe(409);
    const bad = await request(app).post("/api/tv").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send({ ...add, url: "https://example.com/watch?v=dQw4w9WgXcQ" });
    expect(bad.status).toBe(400);

    const shelves = await request(app).get("/api/tv").set("Cookie", bou.cookie);
    expect(shelves.body.shelves).toEqual([{ name: "Music", videos: [expect.objectContaining({ title: "A song" })] }]);
    expect((await request(app).delete(`/api/tv/${created.body.id}`).set("Cookie", bou.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST)).status).toBe(403);
    const renamed = await request(app).patch(`/api/tv/${created.body.id}`).set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send({ title: "Renamed" });
    expect(renamed.body.title).toBe("Renamed");
    expect((await request(app).delete(`/api/tv/${created.body.id}`).set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST)).status).toBe(204);

    await request(app).delete("/api/admin").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST);
    expect((await request(app).get("/api/admin").set("Cookie", ann.cookie)).body.isAdmin).toBe(false);
  });

  it("understands the usual YouTube links", () => {
    expect(parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual({ kind: "video", youtubeId: "dQw4w9WgXcQ" });
    expect(parseYouTube("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({ kind: "video", youtubeId: "dQw4w9WgXcQ" });
    expect(parseYouTube("https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG")).toEqual({ kind: "playlist", youtubeId: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" });
    expect(parseYouTube("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTube("not a link")).toBeNull();
  });

  it("only the admin can share a screen; the server passes messages between sharer and viewers only", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    const cat = await person("Cat");
    await request(app).post("/api/admin").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send({ passcode: "let-me-in-please" });
    const a = await socketFor(ann.cookie);
    const b = await socketFor(bou.cookie);
    const c = await socketFor(cat.cookie);

    expect((await ask(b, "tv:share")).error).toBe("Only the admin can share");
    expect((await ask(b, "tv:watch")).error).toBe("Nothing is being shared");
    const live = new Promise((r) => b.once("tv:live", r));
    expect((await ask(a, "tv:share")).ok).toBe(true);
    expect(await live).toEqual({ live: true, by: "Ann" });

    const viewer = new Promise<{ id: string }>((r) => a.once("tv:viewer", r));
    await ask(b, "tv:watch");
    const { id: bId } = await viewer;
    expect(bId).toBe(b.id);

    const offer = new Promise((r) => b.once("tv:signal", r));
    a.emit("tv:signal", { to: bId, data: { sdp: "offer" } });
    expect(await offer).toEqual({ from: a.id, data: { sdp: "offer" } });

    // A viewer can't message another viewer through the server
    let leaked = false;
    c.on("tv:signal", () => (leaked = true));
    b.emit("tv:signal", { to: c.id, data: { sdp: "x" } });
    await new Promise((r) => setTimeout(r, 150));
    expect(leaked).toBe(false);

    const ended = new Promise((r) => b.once("tv:live", r));
    a.disconnect();
    expect(await ended).toEqual({ live: false, by: null });
  });
});

describe("chess against Nook", () => {
  it("saves a finished game (checked), refuses one that isn't over", async () => {
    const ann = await person("Ann");
    const send = (body: object) => request(app).post("/api/chess/nook").set("Cookie", ann.cookie).set("Origin", ORIGIN).set("Host", SITE_HOST).send(body);
    expect((await send({ pgn: "1. e4 e5", level: 2, color: "w" })).status).toBe(400);
    expect((await send({ pgn: "1. e4 Ke2", level: 2, color: "w" })).status).toBe(400);
    const won = await send({ pgn: "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#", level: 1, color: "w" });
    expect(won.body).toMatchObject({ result: "1-0", reason: "checkmate" });
    const resigned = await send({ pgn: "1. e4 e5", level: 4, color: "b", resigned: true });
    expect(resigned.body).toMatchObject({ result: "1-0", reason: "resign" });
    const list = await request(app).get("/api/chess/games");
    expect(list.body.map((g: { whiteName: string; blackName: string }) => `${g.whiteName}-${g.blackName}`).sort()).toEqual(["Ann-Nook (1)", "Nook (4)-Ann"]);
    // Games against Nook don't change ratings
    expect((await request(app).get("/api/chess/leaderboard")).body).toEqual([]);
  });
});

describe("Ngõ Pháo over the game server", () => {
  it("two people and a bot play; steering moves you; the match result is saved", async () => {
    const ann = await person("Ann");
    const bou = await person("Bou");
    const a = await socketFor(ann.cookie);
    const b = await socketFor(bou.cookie);
    const { code } = await ask(a, "alley:create");
    await ask(a, "room:join", { code });
    await ask(b, "room:join", { code });
    expect((await ask(b, "alley:look", { code, color: 0, hat: 1 })).error).toBe("Someone already has that colour");
    expect((await ask(b, "alley:look", { code, color: 2, hat: 1 })).ok).toBe(true);
    expect((await ask(b, "alley:settings", { code, bots: 1 })).error).toBe("Only the host can change this");
    await ask(a, "alley:settings", { code, bots: 1, map: "market" });
    expect((await ask(a, "alley:start", { code })).error).toBe("Not everyone is ready");
    const lobby = stateWhere(a, (st) => st.alley?.seats.every((s: { ready: boolean; id: string }) => s.ready || s.id === ann.id));
    await ask(b, "alley:ready", { code, ready: true });
    expect((await lobby).alley).toMatchObject({ bots: 1, map: "market" });
    expect((await ask(a, "arena:rooms", { kind: "alley" })).rooms).toEqual([expect.objectContaining({ code, players: 2, bots: 1 })]);

    const firstTick = new Promise<any>((r) => a.once("alley:tick", r)); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect((await ask(a, "alley:start", { code })).ok).toBe(true);
    const t0 = await firstTick;
    expect(t0.players).toHaveLength(3);
    expect(t0.players.map((p: { name: string }) => p.name)).toEqual(["Ann", "Bou", "Bé Pháo"]);
    expect(t0.tiles).toHaveLength(13 * 11);

    // Countdown, then Ann walks right from the top-left corner
    clock += 3000;
    await alleyTick();
    a.emit("alley:input", { code, dir: 2 });
    await new Promise((r) => setTimeout(r, 100));
    const moved = new Promise<any>((r) => a.on("alley:tick", (v) => v.players[0].x > 0.6 && r(v))); // eslint-disable-line @typescript-eslint/no-explicit-any
    clock += 200;
    await alleyTick();
    expect((await moved).players[0].x).toBeGreaterThan(0.6);

    // Bou's browser goes away mid-match: a bot plays for Bou
    b.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    const g = alleyGameForTests(code)!;
    expect(g.players[1].bot).toBe(true);

    // Fast-forward: Ann has won two rounds and wins the third
    g.players[0].score = 2;
    for (const p of g.players.slice(1)) Object.assign(p, { alive: false, ghost: true });
    const ended = stateWhere(a, () => true);
    clock += 50;
    await alleyTick(); // round over
    clock += 4100;
    await alleyTick(); // match over
    await ended;
    expect(g.phase).toBe("matchEnd");
    await expect.poll(async () => (await request(app).get("/api/alley/leaderboard")).body.map((r: { name: string; wins: number }) => [r.name, r.wins])).toEqual([
      ["Ann", 1],
      ["Bou", 0],
    ]);
    expect((await ask(a, "alley:again", { code })).ok).toBe(true);
  });
});
