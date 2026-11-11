// Quiz Party rooms (Stage 14): connects games (game.ts) to Socket.IO.
//
//   browser → server   ao:create {category?}        → ack { code }
//                      ao:join {code}               → ack { ok } (also to come back after a reconnect)
//                      ao:leave · ao:start · ao:again · ao:category {category} · ao:answer {round, choice}
//   server → browser   ao:state  (the room's snapshot, to everyone in room "ao:<code>", on every change)
//                      ao:rooms  (to everyone: the list of open rooms changed)
//
// Games live in THIS API process's memory (a Map). That's fine for one Nook server; with several API servers,
// everyone in a room would need to reach the same one (or the state would move to Valkey). See docs/stage-14.md.

import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { db } from "../db/client.js";
import { onlineGamePlayers, onlineGames } from "../db/schema.js";
import { publishActivity } from "../realtime/emit.js";
import { Game, GameError, type GameOptions, type Player } from "./game.js";
import { CATEGORY_LABEL, type Category } from "./questions.js";

type Room = { game: Game; emptySince: number | null };
const rooms = new Map<string, Room>();
let io: Server | null = null;
let options: Partial<GameOptions> = {};

export const roomName = (code: string) => `ao:${code}`;
export function setArcadeServer(server: Server | null) {
  io = server;
}
// Tests use short timers
export function setGameOptions(o: Partial<GameOptions>) {
  options = o;
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O: easy to read out loud
function newCode(): string {
  for (;;) {
    const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
    if (!rooms.has(code)) return code;
  }
}

let listTimer: NodeJS.Timeout | null = null;
function roomsChanged() {
  if (listTimer) return;
  listTimer = setTimeout(() => {
    listTimer = null;
    io?.emit("ao:rooms");
  }, 500);
}

function changed(g: Game) {
  io?.to(roomName(g.code)).emit("ao:state", g.snapshot());
  const room = rooms.get(g.code);
  if (room) room.emptySince = g.connectedCount === 0 ? (room.emptySince ?? Date.now()) : null;
  roomsChanged();
}

async function finished(g: Game, ranking: Player[]) {
  const [game] = await db.insert(onlineGames).values({ code: g.code, category: g.category, rounds: g.snapshot().rounds }).returning();
  await db
    .insert(onlineGamePlayers)
    .values(ranking.map((p, i) => ({ gameId: game.id, userId: p.id, score: p.score, correct: p.correct, place: i + 1, players: ranking.length })));
  if (ranking.length > 1) {
    const others = ranking.slice(1).map((p) => p.name);
    const against = others.length <= 2 ? others.join(" and ") : `${others.length} others`;
    await publishActivity("Swords", `${ranking[0].name} won Quiz Party against ${against} (${ranking[0].score} pts)`);
  }
}

export function openRooms() {
  return [...rooms.values()]
    .filter((r) => r.game.connectedCount > 0)
    .map(({ game: g }) => ({
      code: g.code,
      host: g.players.get(g.hostId)?.name ?? "?",
      players: g.connectedCount,
      max: g.opts.maxPlayers,
      phase: g.phase,
      category: g.category === "mixed" ? "Mixed" : CATEGORY_LABEL[g.category],
    }));
}

// Rooms nobody has been in for 2 minutes are closed
const sweeper = setInterval(() => {
  for (const [code, r] of rooms) {
    if (r.emptySince && Date.now() - r.emptySince > 120_000) {
      r.game.dispose();
      rooms.delete(code);
      roomsChanged();
    }
  }
}, 30_000);
sweeper.unref();

export function resetRooms() {
  for (const r of rooms.values()) r.game.dispose();
  rooms.clear();
}

// --- one socket -----------------------------------------------------------------------------------

type Data = { userId: string | null; name: string | null; aoRoom?: string | null };
type Ack = (answer: { ok: boolean; code?: string; error?: string }) => void;

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}$/),
});
const categorySchema = z.enum(["mixed", "general", "science", "music", "screen", "food"]);
const answerSchema = z.object({ round: z.number().int().min(1), choice: z.number().int().min(0).max(3) });

export function attachArcadeOnline(socket: Socket) {
  const data = socket.data as Data;

  // Every handler: needs a name, catches mistakes, always answers the browser
  const handle = (event: string, fn: (raw: unknown, me: { id: string; name: string }) => string | void) => {
    socket.on(event, (raw: unknown, ack?: Ack) => {
      const reply: Ack = typeof ack === "function" ? ack : () => {};
      if (!data.userId || !data.name) return reply({ ok: false, error: "Pick a name to play" });
      try {
        const code = fn(raw, { id: data.userId, name: data.name });
        reply({ ok: true, ...(code && { code }) });
      } catch (e) {
        reply({ ok: false, error: e instanceof GameError ? e.message : "That didn't work" });
      }
    });
  };

  const current = () => (data.aoRoom ? rooms.get(data.aoRoom)?.game : undefined);

  const leaveCurrent = (me: string) => {
    const g = current();
    if (g) {
      void socket.leave(roomName(g.code));
      if (!otherSocketOf(me, g.code)) g.leave(me);
    }
    data.aoRoom = null;
  };

  const enter = (g: Game, me: { id: string; name: string }) => {
    if (data.aoRoom && data.aoRoom !== g.code) leaveCurrent(me.id);
    g.join(me); // throws if the game has started or the room is full: then nothing else changes
    data.aoRoom = g.code;
    void socket.join(roomName(g.code));
    socket.emit("ao:state", g.snapshot());
  };

  handle("ao:create", (raw, me) => {
    const category = categorySchema.catch("mixed").parse((raw as { category?: unknown } | undefined)?.category);
    const code = newCode();
    const game = new Game(code, me, options, changed, (g, ranking) => void finished(g, ranking).catch((e) => console.warn("Quiz result not saved:", e)));
    game.category = category;
    rooms.set(code, { game, emptySince: null });
    enter(game, me);
    return code;
  });

  handle("ao:join", (raw, me) => {
    const parsed = codeSchema.safeParse(raw);
    const room = parsed.success ? rooms.get(parsed.data.code) : undefined;
    if (!room) throw new GameError("No room with that code");
    enter(room.game, me);
    return room.game.code;
  });

  handle("ao:leave", (_raw, me) => leaveCurrent(me.id));
  handle("ao:start", (_raw, me) => current()?.start(me.id));
  handle("ao:again", (_raw, me) => current()?.playAgain(me.id));
  handle("ao:category", (raw, me) => current()?.setCategory(me.id, categorySchema.parse((raw as { category?: unknown })?.category) as Category | "mixed"));
  handle("ao:answer", (raw, me) => {
    const parsed = answerSchema.safeParse(raw);
    if (!parsed.success) throw new GameError("Pick one of the four answers");
    const g = current();
    if (!g) throw new GameError("You're not in a game");
    g.answer(me.id, parsed.data.round - 1, parsed.data.choice);
  });

  socket.on("disconnect", () => {
    if (data.userId) leaveCurrent(data.userId);
  });

  // Is this person still in the room from another tab?
  function otherSocketOf(userId: string, code: string): boolean {
    const ids = io?.sockets.adapter.rooms.get(roomName(code));
    if (!ids) return false;
    for (const id of ids) {
      const s = io?.sockets.sockets.get(id);
      if (s && s.id !== socket.id && (s.data as Data).userId === userId) return true;
    }
    return false;
  }
}
