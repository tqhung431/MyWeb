// Stage 22: the game server ("Nook Arena"). Its own program (src/arena.ts), separate from the API, so a busy game
// never slows down the rest of Nook. Browsers connect with Socket.IO on /api/arena (Caddy and the Next.js proxy
// send that path here). The rules live in chess-game.ts and listen.ts; this file connects them to the network.
//
//   browser → server (each with an answer, "ack")
//     time                                      → the server's clock (for Listen Together's sync)
//     arena:rooms {kind}                        → open rooms of that kind
//     chess:create {timeControl, color}         → {code}      room:join {code} → {ok, kind}    room:leave {code}
//     chess:move {code, from, to, promotion?}   chess:resign · chess:draw · chess:decline · chess:rematch {code}
//     listen:create {name}                      → {code}
//     listen:add {code, songId} · listen:vote · listen:remove {code, key} · listen:skip {code}
//     listen:pause · listen:resume · listen:seek {code, seconds} · listen:ended {code, key}
//     listen:react {code, emoji} · listen:everyone {code, on}
//     tv:share · tv:stop (admin only) · tv:watch · tv:signal {to, data}
//   server → browser
//     room:state {code, kind, ...}   arena:rooms {kind}   listen:reaction {name, emoji}
//     tv:live {live, by}   tv:viewer {id}   tv:signal {from, data}   tv:viewer-left {id}
//
// Rooms live in memory. Only results are saved (chess_games, arena_ratings).

import type { Server as HttpServer, IncomingMessage } from "node:http";
import { and, eq, sql } from "drizzle-orm";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { COOKIE_NAME, isAdminToken, userFromToken } from "../auth/sessions.js";
import { db } from "../db/client.js";
import { arenaRatings, brawlRuns, chessGames, songs, villageScores } from "../db/schema.js";
import { isAllowedOrigin } from "../middleware/security.js";
import { publishActivity } from "../realtime/emit.js";
import * as C from "./chess-game.js";
import * as L from "./listen.js";
import * as A from "./alley.js";
import * as AR from "./alley-room.js";
import * as V from "./village.js";
import * as BR from "./brawl.js";

type Person = { id: string; name: string };
type Member = { person: Person; sockets: Set<string> };
type Base = { code: string; createdAt: number; members: Map<string, Member>; emptySince: number | null };
type ChessRoom = Base & {
  kind: "chess";
  timeControl: C.TimeControl;
  hostColor: "w" | "b" | "random";
  seats: { w: Person | null; b: Person | null };
  game: C.ChessGame | null;
  saved: boolean;
  rematch: Set<string>;
  gone: Map<string, number>; // seated player → when they disconnected
};
type ListenRoomState = Base & { kind: "listen"; listen: L.ListenRoom };
type AlleyRoom = Base & { kind: "alley" } & AR.AlleyLobby;
// Stage 24: Giữ Làng co-op (1–2 people on one map; each builds on their own side)
type VillageRoom = Base & {
  kind: "village";
  hostId: string | null;
  map: V.MapId;
  endless: boolean;
  seats: Person[];
  game: V.VillageGame | null;
  speed: 1 | 2;
  paused: boolean;
  saved: boolean;
  lastStep: number;
};
// Stage 25: Chợ Đêm Brawl (1–4 heroes, each a different one)
type BrawlSeat = Person & { hero: BR.HeroKind | null; ready: boolean };
type BrawlRoom = Base & { kind: "brawl"; hostId: string | null; seats: BrawlSeat[]; game: BR.BrawlGame | null; saved: boolean; lastStep: number };
type Room = ChessRoom | ListenRoomState | AlleyRoom | VillageRoom | BrawlRoom;

const rooms = new Map<string, Room>();
let io: Server | null = null;
let now = () => Date.now();
const ABANDON_MS = 120_000; // a seated player gone for 2 minutes loses
const EMPTY_MS = 5 * 60_000; // an empty room is closed after 5 minutes

// Tests: a fake clock, and a clean slate
export function setArenaClock(fn: () => number) {
  now = fn;
}
export function resetArena() {
  rooms.clear();
  tv.sharer = null;
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O: easy to read out loud
function newCode(): string {
  for (;;) {
    const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
    if (!rooms.has(code)) return code;
  }
}
const roomName = (code: string) => `arena:${code}`;

// Who is this socket? Same cookie as the website. People with a name play; guests can watch.
type SocketData = { person: Person | null; isAdmin: boolean };
const who = (s: Socket) => (s.data as SocketData).person;

const codeIn = z.object({ code: z.string().regex(/^[A-Z]{4}$/) });
const createChessIn = z.object({ timeControl: z.enum(C.TIME_CONTROLS as [C.TimeControl, ...C.TimeControl[]]).default("10+0"), color: z.enum(["w", "b", "random"]).default("random") });
const moveIn = codeIn.extend({ from: z.string().regex(/^[a-h][1-8]$/), to: z.string().regex(/^[a-h][1-8]$/), promotion: z.enum(["q", "r", "b", "n"]).optional() });
const keyIn = codeIn.extend({ key: z.number().int().positive() });
const REACTIONS = ["love", "fire", "haha", "clap", "wow"] as const;

type Ack = (r: { ok: boolean; error?: string; [k: string]: unknown }) => void;
const safeAck = (ack: unknown): Ack => (typeof ack === "function" ? (ack as Ack) : () => {});

// --- room lists and state ------------------------------------------------------------------

function roomSummary(r: Room) {
  const people = [...r.members.values()].filter((m) => m.sockets.size > 0).length;
  if (r.kind === "chess") {
    return {
      code: r.code,
      kind: r.kind,
      timeControl: r.timeControl,
      white: r.seats.w?.name ?? null,
      black: r.seats.b?.name ?? null,
      status: r.game?.result ? "over" : r.game ? "playing" : "waiting",
      people,
    };
  }
  if (r.kind === "brawl") {
    const host = r.seats.find((s) => s.id === r.hostId)?.name ?? null;
    return { code: r.code, kind: r.kind, host, players: r.seats.length, status: r.game ? "playing" : "waiting", people };
  }
  if (r.kind === "village") {
    const host = r.seats.find((s) => s.id === r.hostId)?.name ?? null;
    return { code: r.code, kind: r.kind, host, players: r.seats.length, map: r.map, status: r.game ? "playing" : "waiting", people };
  }
  if (r.kind === "alley") {
    const host = r.seats.find((s) => s.id === r.hostId)?.name ?? null;
    return { code: r.code, kind: r.kind, host, players: r.seats.length, bots: r.bots, map: r.map, status: r.game ? "playing" : "waiting", people };
  }
  return { code: r.code, kind: r.kind, name: r.listen.name, people, playing: r.listen.now?.song.title ?? null };
}

export function openRooms(kind: Room["kind"]) {
  return [...rooms.values()].filter((r) => r.kind === kind && !(r.kind === "chess" && r.game?.result)).map(roomSummary);
}

function announceRooms(kind: Room["kind"]) {
  io?.emit("arena:rooms", { kind });
}

function membersOf(r: Room) {
  return [...r.members.values()].map((m) => ({ ...m.person, online: m.sockets.size > 0 }));
}

async function sendState(r: Room) {
  if (!io) return;
  const base = { code: r.code, kind: r.kind, members: membersOf(r) };
  if (r.kind === "chess") {
    io.to(roomName(r.code)).emit("room:state", {
      ...base,
      timeControl: r.timeControl,
      seats: r.seats,
      chess: r.game ? C.chessView(r.game, now()) : null,
      rematch: [...r.rematch],
    });
    return;
  }
  if (r.kind === "alley") {
    io.to(roomName(r.code)).emit("room:state", { ...base, alley: AR.lobbyView(r) });
    return;
  }
  if (r.kind === "brawl") {
    io.to(roomName(r.code)).emit("room:state", { ...base, brawl: { hostId: r.hostId, seats: r.seats, playing: !!r.game } });
    return;
  }
  if (r.kind === "village") {
    const village = { hostId: r.hostId, map: r.map, endless: r.endless, seats: r.seats, playing: !!r.game, speed: r.speed, paused: r.paused };
    io.to(roomName(r.code)).emit("room:state", { ...base, village });
    return;
  }
  // Listen Together: each person sees their own votes
  for (const s of await io.in(roomName(r.code)).fetchSockets()) {
    s.emit("room:state", { ...base, listen: L.listenView(r.listen, (s.data as SocketData).person?.id ?? null, now()) });
  }
}

function join(r: Room, socket: Socket) {
  const p = who(socket);
  void socket.join(roomName(r.code));
  if (p) {
    const m = r.members.get(p.id) ?? { person: p, sockets: new Set<string>() };
    m.sockets.add(socket.id);
    r.members.set(p.id, m);
    if (r.kind === "chess") r.gone.delete(p.id);
    if (r.kind === "alley" && r.away.has(p.id)) AR.setAway(r, p.id, false);
  }
  r.emptySince = null;
}

function leave(r: Room, socket: Socket) {
  void socket.leave(roomName(r.code));
  const p = who(socket);
  const m = p && r.members.get(p.id);
  if (!m) return;
  m.sockets.delete(socket.id);
  if (m.sockets.size === 0) {
    if (r.kind === "brawl") {
      // Before the run: your seat is freed. During it: your hero stands still until you're back.
      if (!r.game) {
        r.seats = r.seats.filter((s) => s.id !== p!.id);
        if (r.hostId === p!.id) r.hostId = r.seats[0]?.id ?? null;
        r.members.delete(p!.id);
      } else BR.setStick(r.game, p!.id, 0, 0);
      if ([...r.members.values()].every((x) => x.sockets.size === 0)) r.emptySince = now();
      return;
    }
    if (r.kind === "village") {
      // A tower-defense game carries on without you; before it starts, your seat is freed
      if (!r.game) {
        r.seats = r.seats.filter((s) => s.id !== p!.id);
        if (r.hostId === p!.id) r.hostId = r.seats[0]?.id ?? null;
        r.members.delete(p!.id);
      }
      if ([...r.members.values()].every((x) => x.sockets.size === 0)) r.emptySince = now();
      return;
    }
    if (r.kind === "alley") {
      const seated = r.seats.some((s) => s.id === p!.id);
      if (seated && r.game) AR.setAway(r, p!.id, true); // a bot plays for you until you're back
      else {
        if (seated) AR.standUp(r, p!.id);
        r.members.delete(p!.id);
      }
      if ([...r.members.values()].every((x) => x.sockets.size === 0)) r.emptySince = now();
      return;
    }
    const seated = r.kind === "chess" && (r.seats.w?.id === p!.id || r.seats.b?.id === p!.id);
    if (r.kind === "chess" && seated && r.game && !r.game.result) r.gone.set(p!.id, now());
    else if (r.kind === "chess" && seated && !r.game) {
      // Left before the game started: free the seat
      if (r.seats.w?.id === p!.id) r.seats.w = null;
      if (r.seats.b?.id === p!.id) r.seats.b = null;
      r.members.delete(p!.id);
    } else if (!seated) r.members.delete(p!.id);
  }
  if ([...r.members.values()].every((x) => x.sockets.size === 0)) r.emptySince = now();
}

// --- chess -----------------------------------------------------------------------------------

function seat(r: ChessRoom, p: Person) {
  if (r.seats.w?.id === p.id || r.seats.b?.id === p.id || r.game) return;
  if (!r.seats.w && !r.seats.b) {
    const color = r.hostColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : r.hostColor;
    r.seats[color] = p;
  } else if (!r.seats.w) r.seats.w = p;
  else if (!r.seats.b) r.seats.b = p;
  if (r.seats.w && r.seats.b) startChess(r);
}

function startChess(r: ChessRoom) {
  r.game = C.newChessGame(r.seats.w!, r.seats.b!, r.timeControl, now());
  r.saved = false;
  r.rematch.clear();
  announceRooms("chess");
}

async function afterChessChange(r: ChessRoom) {
  if (r.game?.result && !r.saved) {
    r.saved = true;
    await saveChess(r).catch((e) => console.error("arena: saving chess failed", e));
    announceRooms("chess");
  }
  await sendState(r);
}

async function rating(userId: string, game: string) {
  const [row] = await db.select().from(arenaRatings).where(and(eq(arenaRatings.userId, userId), eq(arenaRatings.game, game)));
  return row?.rating ?? 1200;
}

async function addResult(userId: string, game: string, change: number, score: 0 | 0.5 | 1) {
  await db
    .insert(arenaRatings)
    .values({ userId, game, rating: 1200 + change, games: 1, wins: score === 1 ? 1 : 0, draws: score === 0.5 ? 1 : 0, losses: score === 0 ? 1 : 0 })
    .onConflictDoUpdate({
      target: [arenaRatings.userId, arenaRatings.game],
      set: {
        rating: sql`${arenaRatings.rating} + ${change}`,
        games: sql`${arenaRatings.games} + 1`,
        wins: sql`${arenaRatings.wins} + ${score === 1 ? 1 : 0}`,
        draws: sql`${arenaRatings.draws} + ${score === 0.5 ? 1 : 0}`,
        losses: sql`${arenaRatings.losses} + ${score === 0 ? 1 : 0}`,
        updatedAt: new Date(),
      },
    });
}

async function saveChess(r: ChessRoom) {
  const g = r.game!;
  const { result, reason } = g.result!;
  await db.insert(chessGames).values({
    whiteId: g.white.id,
    blackId: g.black.id,
    whiteName: g.white.name,
    blackName: g.black.name,
    mode: "live",
    timeControl: g.timeControl,
    pgn: g.chess.pgn(),
    result,
    reason,
  });
  if (g.chess.history().length < 2 && reason !== "time") return; // a game that never really started doesn't count
  const scoreW: 0 | 0.5 | 1 = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
  const [rw, rb] = await Promise.all([rating(g.white.id, "chess"), rating(g.black.id, "chess")]);
  const change = C.eloChange(rw, rb, scoreW);
  await addResult(g.white.id, "chess", change, scoreW);
  await addResult(g.black.id, "chess", -change, (1 - scoreW) as 0 | 0.5 | 1);
  if (result !== "1/2-1/2") {
    const [winner, loser] = result === "1-0" ? [g.white, g.black] : [g.black, g.white];
    await publishActivity("Swords", "{name} won a chess game against {other}", { name: winner.name, other: loser.name });
  }
}

// --- Listen Together -----------------------------------------------------------------------

async function songById(id: number): Promise<L.Song | null> {
  const [s] = await db.select().from(songs).where(eq(songs.id, id));
  if (!s) return null;
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    durationSec: s.durationSec,
    audioUrl: `/api/songs/${s.id}/audio`,
    artworkUrl: s.artworkFile ? `/api/songs/${s.id}/artwork` : null,
  };
}

const listeners = (r: Room) => [...r.members.values()].filter((m) => m.sockets.size > 0).length;

// --- TV screen share (WebRTC signalling only: the video goes browser to browser) ------------

const tv: { sharer: { socketId: string; name: string } | null } = { sharer: null };

// --- the server ----------------------------------------------------------------------------

function header(req: IncomingMessage, name: string) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
function cookieValue(raw: string | undefined, name: string) {
  for (const part of (raw ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function attachArena(http: HttpServer): Server {
  const server = new Server(http, {
    path: "/api/arena",
    addTrailingSlash: false,
    serveClient: false,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || isAllowedOrigin(origin, header(req, "x-forwarded-host") ?? header(req, "host")));
    },
  });
  io = server;

  server.use(async (socket, next) => {
    try {
      const token = cookieValue(socket.request.headers.cookie, COOKIE_NAME);
      const user = await userFromToken(token);
      const data: SocketData = { person: user ? { id: user.id, name: user.name } : null, isAdmin: user ? await isAdminToken(token) : false };
      socket.data = data;
      next();
    } catch {
      next(new Error("Sign-in check failed"));
    }
  });

  server.on("connection", (socket) => {
    const data = socket.data as SocketData;
    const mine = new Set<string>(); // rooms this socket is in
    const need = (ack: Ack) => {
      if (!data.person) ack({ ok: false, error: "Pick a name first" });
      return data.person;
    };
    const roomFor = (raw: unknown, ack: Ack, kind?: Room["kind"]) => {
      const parsed = codeIn.safeParse(raw);
      const r = parsed.success ? rooms.get(parsed.data.code) : undefined;
      if (!r || (kind && r.kind !== kind)) {
        ack({ ok: false, error: "Room not found" });
        return null;
      }
      return r;
    };

    socket.on("time", (_raw: unknown, ack: unknown) => safeAck(ack)({ ok: true, now: now() }));

    socket.on("arena:rooms", (raw: unknown, ack: unknown) => {
      const kind = z.object({ kind: z.enum(["chess", "listen", "alley", "village", "brawl"]) }).safeParse(raw);
      safeAck(ack)({ ok: kind.success, rooms: kind.success ? openRooms(kind.data.kind) : [] });
    });

    socket.on("room:join", async (raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      const r = roomFor(raw, ack);
      if (!r) return;
      join(r, socket);
      mine.add(r.code);
      if (r.kind === "chess" && data.person) seat(r, data.person);
      if (r.kind === "alley" && data.person) AR.sit(r, data.person);
      if (r.kind === "brawl" && data.person && !r.game && r.seats.length < 4 && !r.seats.some((s) => s.id === data.person!.id)) {
        const free = BR.HERO_KINDS.find((k) => !r.seats.some((s) => s.hero === k)) ?? null;
        r.seats.push({ ...data.person, hero: free, ready: false });
        r.hostId ??= data.person.id;
      }
      if (r.kind === "village" && data.person && !r.game && r.seats.length < 2 && !r.seats.some((s) => s.id === data.person!.id)) {
        r.seats.push(data.person);
        r.hostId ??= data.person.id;
      }
      ack({ ok: true, kind: r.kind });
      if (r.kind === "chess") await afterChessChange(r);
      else await sendState(r);
      if (r.kind === "brawl" && r.game) {
        // The picture as it is now (ticks stop when a run ends, so a late or reloaded page still gets one)
        const events = r.game.events;
        socket.emit("brawl:tick", { code: r.code, ...BR.brawlView(r.game), events: [] });
        r.game.events = events;
      }
      announceRooms(r.kind);
    });

    socket.on("room:leave", async (raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      const r = roomFor(raw, ack);
      if (!r) return;
      leave(r, socket);
      mine.delete(r.code);
      ack({ ok: true });
      await sendState(r);
      announceRooms(r.kind);
    });

    // Chess
    socket.on("chess:create", (raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      if (!need(ack)) return;
      const input = createChessIn.safeParse(raw ?? {});
      if (!input.success) return ack({ ok: false, error: "Invalid request" });
      const code = newCode();
      rooms.set(code, {
        kind: "chess",
        code,
        createdAt: now(),
        members: new Map(),
        emptySince: now(),
        timeControl: input.data.timeControl,
        hostColor: input.data.color,
        seats: { w: null, b: null },
        game: null,
        saved: false,
        rematch: new Set(),
        gone: new Map(),
      });
      ack({ ok: true, code });
      announceRooms("chess");
    });

    const chessAction = (event: string, fn: (r: ChessRoom, p: Person, raw: unknown) => string | null | void) =>
      socket.on(event, async (raw: unknown, a: unknown) => {
        const ack = safeAck(a);
        const p = need(ack);
        if (!p) return;
        const r = roomFor(raw, ack, "chess") as ChessRoom | null;
        if (!r) return;
        if (!r.game) return ack({ ok: false, error: "Waiting for a second player" });
        const error = fn(r, p, raw);
        ack(error ? { ok: false, error } : { ok: true });
        await afterChessChange(r);
      });

    chessAction("chess:move", (r, p, raw) => {
      const m = moveIn.safeParse(raw);
      if (!m.success) return "Invalid move";
      return C.playMove(r.game!, p.id, m.data, now());
    });
    chessAction("chess:resign", (r, p) => C.resign(r.game!, p.id));
    chessAction("chess:draw", (r, p) => {
      const out = C.offerDraw(r.game!, p.id);
      return out === "offered" || out === "agreed" ? null : out;
    });
    chessAction("chess:decline", (r, p) => void C.declineDraw(r.game!, p.id));
    chessAction("chess:rematch", (r, p) => {
      if (!r.game?.result) return "The game isn't over";
      if (!C.sideOf(r.game, p.id)) return "Only the players can ask for a rematch";
      r.rematch.add(p.id);
      if (r.rematch.size === 2) {
        // Swap colours for the rematch
        r.seats = { w: r.game.black, b: r.game.white };
        startChess(r);
      }
    });

    // Listen Together
    socket.on("listen:create", (raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      const p = need(ack);
      if (!p) return;
      const name = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(raw);
      if (!name.success) return ack({ ok: false, error: "Give the room a name" });
      const code = newCode();
      rooms.set(code, { kind: "listen", code, createdAt: now(), members: new Map(), emptySince: now(), listen: L.newListenRoom(name.data.name, p) });
      ack({ ok: true, code });
      announceRooms("listen");
    });

    const listenAction = (event: string, schema: z.ZodType, fn: (r: ListenRoomState, p: Person, input: any) => Promise<string | null | void> | string | null | void) =>
      socket.on(event, async (raw: unknown, a: unknown) => {
        const ack = safeAck(a);
        const p = need(ack);
        if (!p) return;
        const r = roomFor(raw, ack, "listen") as ListenRoomState | null;
        if (!r) return;
        const input = schema.safeParse(raw);
        if (!input.success) return ack({ ok: false, error: "Invalid request" });
        const error = await fn(r, p, input.data);
        ack(error ? { ok: false, error } : { ok: true });
        await sendState(r);
        if (event === "listen:add" || event === "listen:skip" || event === "listen:ended") announceRooms("listen");
      });

    listenAction("listen:add", codeIn.extend({ songId: z.number().int().positive() }), async (r, p, input) => {
      const song = await songById(input.songId);
      if (!song) return "Song not found";
      return L.addSong(r.listen, p, song, now());
    });
    listenAction("listen:vote", keyIn, (r, p, input) => void L.toggleVote(r.listen, p, input.key));
    listenAction("listen:remove", keyIn, (r, p, input) => L.removeFromQueue(r.listen, p, input.key));
    listenAction("listen:skip", codeIn, (r, p) => void L.voteSkip(r.listen, p, listeners(r), now()));
    listenAction("listen:pause", codeIn, (r, p) => (L.canControl(r.listen, p) ? void L.pause(r.listen, now()) : "Only the host can pause"));
    listenAction("listen:resume", codeIn, (r, p) => (L.canControl(r.listen, p) ? void L.resume(r.listen, now()) : "Only the host can play"));
    listenAction("listen:seek", codeIn.extend({ seconds: z.number().min(0).max(36_000) }), (r, p, input) =>
      L.canControl(r.listen, p) ? void L.seek(r.listen, input.seconds, now()) : "Only the host can jump",
    );
    listenAction("listen:ended", keyIn, (r, _p, input) => void L.songEnded(r.listen, input.key, now()));
    listenAction("listen:everyone", codeIn.extend({ on: z.boolean() }), (r, p, input) => {
      if (p.id !== r.listen.hostId) return "Only the host can change this";
      r.listen.everyoneControls = input.on;
    });
    socket.on("listen:react", (raw: unknown) => {
      const input = codeIn.extend({ emoji: z.enum(REACTIONS) }).safeParse(raw);
      if (!input.success || !data.person || !mine.has(input.data.code)) return;
      socket.to(roomName(input.data.code)).emit("listen:reaction", { name: data.person.name, emoji: input.data.emoji });
    });

    // Ngõ Pháo (Stage 23)
    socket.on("alley:create", (raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      const p = need(ack);
      if (!p) return;
      const code = newCode();
      rooms.set(code, { kind: "alley", code, createdAt: now(), members: new Map(), emptySince: now(), ...AR.newLobby(p) });
      ack({ ok: true, code });
      announceRooms("alley");
    });
    const alleyAction = (event: string, schema: z.ZodType, fn: (r: AlleyRoom, p: Person, input: any) => string | null | void) =>
      socket.on(event, async (raw: unknown, a: unknown) => {
        const ack = safeAck(a);
        const p = need(ack);
        if (!p) return;
        const r = roomFor(raw, ack, "alley") as AlleyRoom | null;
        if (!r) return;
        const input = schema.safeParse(raw);
        if (!input.success) return ack({ ok: false, error: "Invalid request" });
        const error = fn(r, p, input.data);
        ack(error ? { ok: false, error } : { ok: true });
        await sendState(r);
        if (r.game && event !== "alley:look") emitAlley(r, false);
        announceRooms("alley");
      });
    alleyAction("alley:look", codeIn.extend({ color: z.number().int().min(0).max(AR.COLORS - 1), hat: z.number().int().min(0).max(AR.HATS - 1) }), (r, p, i) =>
      AR.look(r, p.id, i.color, i.hat),
    );
    alleyAction("alley:ready", codeIn.extend({ ready: z.boolean() }), (r, p, i) => AR.setReady(r, p.id, i.ready));
    alleyAction("alley:settings", codeIn.extend({ bots: z.number().int().min(0).max(3).optional(), map: z.enum(["random", ...A.MAP_IDS] as [string, ...string[]]).optional() }), (r, p, i) =>
      AR.settings(r, p.id, i),
    );
    alleyAction("alley:start", codeIn, (r, p) => {
      const error = AR.canStart(r, p.id);
      if (error) return error;
      AR.start(r, now(), Math.floor(Math.random() * 2 ** 31));
    });
    alleyAction("alley:again", codeIn, (r, p) => AR.again(r, p.id));
    // Steering and dropping: many a second, so no answer and as little checking as is safe
    socket.on("alley:input", (raw: unknown) => {
      const input = codeIn.extend({ dir: z.number().int().min(0).max(4) }).safeParse(raw);
      if (!input.success || !data.person) return;
      const r = rooms.get(input.data.code);
      if (r?.kind === "alley" && r.game && !r.away.has(data.person.id)) A.setDir(r.game, data.person.id, input.data.dir as 0 | 1 | 2 | 3 | 4);
    });
    socket.on("alley:drop", (raw: unknown) => {
      const input = codeIn.safeParse(raw);
      if (!input.success || !data.person) return;
      const r = rooms.get(input.data.code);
      if (r?.kind === "alley" && r.game) A.drop(r.game, data.person.id, now());
    });

    // Giữ Làng co-op (Stage 24)
    socket.on("village:create", (raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      const p = need(ack);
      if (!p) return;
      const input = z.object({ map: z.enum(V.MAP_IDS as [V.MapId, ...V.MapId[]]).default("riverside") }).safeParse(raw ?? {});
      const code = newCode();
      rooms.set(code, {
        kind: "village",
        code,
        createdAt: now(),
        members: new Map(),
        emptySince: now(),
        hostId: p.id,
        map: input.success ? input.data.map : "riverside",
        endless: false,
        seats: [],
        game: null,
        speed: 1,
        paused: false,
        saved: false,
        lastStep: 0,
      });
      ack({ ok: true, code });
      announceRooms("village");
    });
    const villageAction = (event: string, schema: z.ZodType, fn: (r: VillageRoom, p: Person, input: any) => string | null | void) =>
      socket.on(event, async (raw: unknown, a: unknown) => {
        const ack = safeAck(a);
        const p = need(ack);
        if (!p) return;
        const r = roomFor(raw, ack, "village") as VillageRoom | null;
        if (!r) return;
        const input = schema.safeParse(raw);
        if (!input.success) return ack({ ok: false, error: "Invalid request" });
        const error = fn(r, p, input.data);
        ack(error ? { ok: false, error } : { ok: true });
        if (event !== "village:act") {
          await sendState(r);
          announceRooms("village");
        }
        if (r.game) emitVillage(r, false);
      });
    const hostOnly = (r: VillageRoom, p: Person) => (p.id === r.hostId ? null : "Only the host can do this");
    villageAction("village:settings", codeIn.extend({ map: z.enum(V.MAP_IDS as [V.MapId, ...V.MapId[]]).optional(), endless: z.boolean().optional() }), (r, p, i) => {
      if (r.game) return "The game has started";
      const no = hostOnly(r, p);
      if (no) return no;
      if (i.map) r.map = i.map;
      if (i.endless !== undefined) r.endless = i.endless;
    });
    villageAction("village:start", codeIn, (r, p) => {
      const no = hostOnly(r, p) ?? (r.game ? "The game has started" : null);
      if (no) return no;
      const two = r.seats.length > 1;
      r.game = V.newVillage(r.map, r.seats.map((s, i) => ({ ...s, side: two ? (i as 0 | 1) : null })), r.endless);
      r.saved = false;
      r.speed = 1;
      r.paused = false;
      r.lastStep = now();
    });
    const actionIn = z.discriminatedUnion("a", [
      z.object({ a: z.literal("build"), tx: z.number().int().min(0).max(V.COLS - 1), ty: z.number().int().min(0).max(V.ROWS - 1), kind: z.enum(V.TOWER_KINDS as [V.TowerKind, ...V.TowerKind[]]) }),
      z.object({ a: z.literal("upgrade"), id: z.number().int().positive(), branch: z.enum(["a", "b"]).optional() }),
      z.object({ a: z.literal("sell"), id: z.number().int().positive() }),
      z.object({ a: z.literal("next") }),
    ]);
    villageAction("village:act", codeIn.extend({ action: actionIn }), (r, p, i) => (r.game ? V.act(r.game, p.id, i.action) : "The game hasn't started"));
    villageAction("village:speed", codeIn.extend({ speed: z.union([z.literal(1), z.literal(2)]).optional(), paused: z.boolean().optional() }), (r, p, i) => {
      const no = hostOnly(r, p);
      if (no) return no;
      if (i.speed) r.speed = i.speed;
      if (i.paused !== undefined) r.paused = i.paused;
    });
    villageAction("village:again", codeIn, (r, p) => {
      const no = hostOnly(r, p);
      if (no) return no;
      if (r.game && r.game.phase !== "won" && r.game.phase !== "lost") return "The game isn't over";
      r.game = null;
      r.seats = r.seats.filter((s) => r.members.get(s.id)?.sockets.size);
    });

    // Chợ Đêm Brawl (Stage 25)
    socket.on("brawl:create", (_raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      const p = need(ack);
      if (!p) return;
      const code = newCode();
      rooms.set(code, { kind: "brawl", code, createdAt: now(), members: new Map(), emptySince: now(), hostId: p.id, seats: [], game: null, saved: false, lastStep: 0 });
      ack({ ok: true, code });
      announceRooms("brawl");
    });
    const brawlAction = (event: string, schema: z.ZodType, fn: (r: BrawlRoom, p: Person, input: any) => string | null | void) =>
      socket.on(event, async (raw: unknown, a: unknown) => {
        const ack = safeAck(a);
        const p = need(ack);
        if (!p) return;
        const r = roomFor(raw, ack, "brawl") as BrawlRoom | null;
        if (!r) return;
        const input = schema.safeParse(raw);
        if (!input.success) return ack({ ok: false, error: "Invalid request" });
        const error = fn(r, p, input.data);
        ack(error ? { ok: false, error } : { ok: true });
        if (event !== "brawl:act") {
          await sendState(r);
          announceRooms("brawl");
        }
      });
    brawlAction("brawl:hero", codeIn.extend({ hero: z.enum(BR.HERO_KINDS as [BR.HeroKind, ...BR.HeroKind[]]) }), (r, p, i) => {
      if (r.game) return "The run has started";
      const seat = r.seats.find((s) => s.id === p.id);
      if (!seat) return "Take a seat first";
      if (r.seats.some((s) => s.id !== p.id && s.hero === i.hero)) return "Someone already plays that hero";
      seat.hero = i.hero;
    });
    brawlAction("brawl:ready", codeIn.extend({ ready: z.boolean() }), (r, p, i) => {
      const seat = r.seats.find((s) => s.id === p.id);
      if (seat) seat.ready = i.ready;
    });
    brawlAction("brawl:start", codeIn, (r, p) => {
      if (p.id !== r.hostId) return "Only the host can start";
      if (r.game) return "The run has started";
      if (r.seats.some((s) => !s.hero)) return "Everyone needs a hero";
      if (r.seats.some((s) => s.id !== r.hostId && !s.ready)) return "Not everyone is ready";
      r.game = BR.newBrawl(
        r.seats.map((s) => ({ id: s.id, name: s.name, hero: s.hero! })),
        Math.floor(Math.random() * 2 ** 31),
        now(),
      );
      r.saved = false;
      r.lastStep = now();
    });
    const brawlActionIn = z.discriminatedUnion("a", [
      z.object({ a: z.literal("attack") }),
      z.object({ a: z.literal("dodge") }),
      z.object({ a: z.literal("special") }),
      z.object({ a: z.literal("buy"), buff: z.enum(["banhmi", "che", "caphe", "banhxeo"]) }),
      z.object({ a: z.literal("ready") }),
    ]);
    brawlAction("brawl:act", codeIn.extend({ action: brawlActionIn }), (r, p, i) => (r.game ? BR.act(r.game, p.id, i.action, now()) : "The run hasn't started"));
    brawlAction("brawl:again", codeIn, (r, p) => {
      if (p.id !== r.hostId) return "Only the host can do this";
      if (r.game && r.game.phase !== "won" && r.game.phase !== "lost") return "The run isn't over";
      r.game = null;
      r.seats = r.seats.filter((s) => r.members.get(s.id)?.sockets.size);
      for (const s of r.seats) s.ready = false;
    });
    // The stick: many times a second, no answer
    socket.on("brawl:stick", (raw: unknown) => {
      const input = codeIn.extend({ mx: z.number().min(-1).max(1), my: z.number().min(-1).max(1) }).safeParse(raw);
      if (!input.success || !data.person) return;
      const r = rooms.get(input.data.code);
      if (r?.kind === "brawl" && r.game) BR.setStick(r.game, data.person.id, input.data.mx, input.data.my);
    });

    // Nook TV screen share: the admin's browser sends video straight to each viewer (WebRTC);
    // the server only passes their connection messages along.
    socket.on("tv:status", (_raw: unknown, a: unknown) => safeAck(a)({ ok: true, live: !!tv.sharer, by: tv.sharer?.name ?? null }));
    socket.on("tv:share", (_raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      if (!data.isAdmin) return ack({ ok: false, error: "Only the admin can share" });
      tv.sharer = { socketId: socket.id, name: data.person?.name ?? "Admin" };
      void socket.join("tv:sharer");
      ack({ ok: true });
      server.emit("tv:live", { live: true, by: tv.sharer.name });
    });
    const stopSharing = () => {
      if (tv.sharer?.socketId !== socket.id) return;
      tv.sharer = null;
      server.emit("tv:live", { live: false, by: null });
    };
    socket.on("tv:stop", () => stopSharing());
    socket.on("tv:watch", (_raw: unknown, a: unknown) => {
      const ack = safeAck(a);
      if (!tv.sharer) return ack({ ok: false, error: "Nothing is being shared" });
      ack({ ok: true });
      server.to(tv.sharer.socketId).emit("tv:viewer", { id: socket.id, name: data.person?.name ?? null });
    });
    socket.on("tv:signal", (raw: unknown) => {
      const input = z.object({ to: z.string().min(1).max(64), data: z.record(z.string(), z.unknown()) }).safeParse(raw);
      if (!input.success || !tv.sharer) return;
      // Only between the sharer and a viewer, never viewer to viewer
      const fromSharer = socket.id === tv.sharer.socketId;
      if (!fromSharer && input.data.to !== tv.sharer.socketId) return;
      server.to(input.data.to).emit("tv:signal", { from: socket.id, data: input.data.data });
    });

    socket.on("disconnect", async () => {
      stopSharing();
      if (tv.sharer) server.to(tv.sharer.socketId).emit("tv:viewer-left", { id: socket.id });
      for (const code of mine) {
        const r = rooms.get(code);
        if (!r) continue;
        leave(r, socket);
        await sendState(r);
        announceRooms(r.kind);
      }
    });
  });

  // Every 250 ms: clocks running out, abandoned games, songs ending, empty rooms
  const timer = setInterval(() => void tick(), 250);
  timer.unref();
  // Stage 23: Ngõ Pháo runs its rules 20 times a second
  const fast = setInterval(() => void alleyTick(), 50);
  fast.unref();
  server.on("close", () => {
    clearInterval(timer);
    clearInterval(fast);
  });
  return server;
}

export async function tick() {
  const t = now();
  for (const r of rooms.values()) {
    if (r.kind === "chess" && r.game && !r.game.result) {
      let changed = C.flagIfOut(r.game, t);
      for (const [id, since] of r.gone) {
        if (t - since >= ABANDON_MS) {
          C.abandon(r.game, id);
          changed = true;
        }
      }
      if (changed) await afterChessChange(r);
    }
    if (r.kind === "listen") {
      const end = L.endsAt(r.listen);
      if (end !== null && t >= end) {
        L.next(r.listen, t);
        await sendState(r);
        announceRooms("listen");
      }
    }
    if (r.emptySince !== null && t - r.emptySince > EMPTY_MS) {
      rooms.delete(r.code);
      announceRooms(r.kind);
    }
  }
}

// --- Ngõ Pháo (Stage 23) -------------------------------------------------------------------------

/** Send the match to everyone in the room. Most updates may be dropped if a phone is behind ("volatile"):
 *  the next one, 50 ms later, has everything anyway. */
function emitAlley(r: AlleyRoom, volatile = true) {
  if (!io || !r.game) return;
  const view = { code: r.code, ...A.alleyView(r.game, now()) };
  (volatile ? io.to(roomName(r.code)).volatile : io.to(roomName(r.code))).emit("alley:tick", view);
}

export async function alleyTick() {
  const t = now();
  for (const r of rooms.values()) if (r.kind === "village") await villageStep(r, t);
  for (const r of rooms.values()) if (r.kind === "brawl") await brawlStep(r, t);
  for (const r of rooms.values()) {
    if (r.kind !== "alley" || !r.game || r.game.phase === "matchEnd") continue;
    const dt = Math.min(t - r.lastStep, 200); // a slow moment never teleports anyone
    r.lastStep = t;
    const before: A.AlleyGame["phase"] = r.game.phase;
    A.stepAlley(r.game, t, dt);
    const after = r.game.phase as A.AlleyGame["phase"];
    if (after === "matchEnd") {
      emitAlley(r, false);
      await saveAlley(r).catch((e) => console.error("arena: saving Ngõ Pháo failed", e));
      await sendState(r);
      announceRooms("alley");
      continue;
    }
    emitAlley(r, before === after); // a change of phase always arrives
  }
}

async function saveAlley(r: AlleyRoom) {
  if (r.saved || !r.game) return;
  r.saved = true;
  const people = r.game.players.filter((p) => !p.id.startsWith("bot:"));
  for (const p of people) await addResult(p.id, "alley", 0, p.id === r.game.matchWinner ? 1 : 0);
  const winner = people.find((p) => p.id === r.game!.matchWinner);
  if (winner) await publishActivity("Swords", "{name} won a Ngõ Pháo match", { name: winner.name });
}

/** Tests only: reach into a running Ngõ Pháo match */
export function alleyGameForTests(code: string) {
  const r = rooms.get(code);
  return r?.kind === "alley" ? r.game : null;
}

// --- Giữ Làng (Stage 24) -------------------------------------------------------------------------

function emitVillage(r: VillageRoom, volatile = true) {
  if (!io || !r.game) return;
  const view = { code: r.code, speed: r.speed, paused: r.paused, ...V.villageView(r.game) };
  (volatile ? io.to(roomName(r.code)).volatile : io.to(roomName(r.code))).emit("village:tick", view);
}

async function villageStep(r: VillageRoom, t: number) {
  if (!r.game || r.game.phase === "won" || r.game.phase === "lost") return;
  const dt = Math.min(t - r.lastStep, 200);
  r.lastStep = t;
  if (!r.paused) V.stepVillage(r.game, dt * r.speed);
  const phase = r.game.phase as V.VillageGame["phase"];
  if (phase === "won" || phase === "lost") {
    emitVillage(r, false);
    if (!r.saved) {
      r.saved = true;
      const g = r.game;
      await db
        .insert(villageScores)
        .values(r.seats.map((s) => ({ userId: s.id, map: g.map, mode: "coop" as const, endless: g.endless, waves: g.cleared, rice: g.rice, won: phase === "won", score: V.scoreOf(g) })))
        .catch((e) => console.error("arena: saving Giữ Làng failed", e));
    }
    await sendState(r);
    return;
  }
  emitVillage(r, r.game.events.length === 0);
}

// --- Chợ Đêm Brawl (Stage 25) ---------------------------------------------------------------------

async function brawlStep(r: BrawlRoom, t: number) {
  if (!io || !r.game) return;
  const g = r.game;
  if (g.phase === "won" || g.phase === "lost") return;
  const dt = Math.min(t - r.lastStep, 200);
  r.lastStep = t;
  const before = g.phase;
  BR.stepBrawl(g, t, dt);
  const view = { code: r.code, ...BR.brawlView(g) };
  const changed = before !== g.phase || view.events.length > 0;
  (changed ? io.to(roomName(r.code)) : io.to(roomName(r.code)).volatile).emit("brawl:tick", view);
  const after = g.phase as BR.BrawlGame["phase"];
  if ((after === "won" || after === "lost") && !r.saved) {
    r.saved = true;
    const res = BR.resultOf(g);
    await db
      .insert(brawlRuns)
      .values(g.heroes.map((h) => ({ userId: h.id, hero: h.hero, players: g.heroes.length, areas: res.areas, won: res.won, timeMs: res.timeMs, bonks: h.bonks })))
      .catch((e) => console.error("arena: saving Chợ Đêm Brawl failed", e));
    if (res.won) await publishActivity("Swords", "{name} cleared the Night Market", { name: g.heroes.map((h) => h.name).join(", ") });
    await sendState(r);
    announceRooms("brawl");
  }
}

/** Tests only */
export function brawlGameForTests(code: string) {
  const r = rooms.get(code);
  return r?.kind === "brawl" ? r.game : null;
}
