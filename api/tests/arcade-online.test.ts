// Stage 14: a real two-player Quiz Party over Socket.IO, with short timers.

import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetRooms, setGameOptions } from "../src/arcade-online/rooms.js";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { attachRealtime } from "../src/realtime/server.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
let http: HttpServer;
let io: Server;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  http = createServer(app);
  io = await attachRealtime(http);
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});
beforeEach(async () => {
  await resetDatabase();
  resetRooms();
  setGameOptions({ rounds: 2, questionMs: 600, revealMs: 150 });
});
afterEach(() => sockets.splice(0).forEach((s) => s.disconnect()));
afterAll(async () => {
  resetRooms();
  io.close();
  await closeAll();
});

async function player(name: string) {
  const res = await request(app).post("/api/me").send({ name });
  const cookie = ([] as string[]).concat(res.headers["set-cookie"])[0].split(";")[0];
  const s = connect(url, {
    path: "/api/realtime",
    addTrailingSlash: false,
    transports: ["websocket"],
    auth: { clientId: randomUUID() },
    extraHeaders: { cookie },
    forceNew: true,
  });
  sockets.push(s);
  await new Promise((r) => s.once("presence", r));
  return { s, id: res.body.user.id as string, cookie };
}

type Ack = { ok: boolean; code?: string; error?: string };
const ask = (s: Socket, event: string, payload?: unknown) => new Promise<Ack>((r) => s.emit(event, payload ?? {}, r));
type State = {
  phase: string;
  round: number;
  hostId: string;
  players: { id: string; name: string; score: number; answered: boolean }[];
  question?: { text: string; choices: string[] };
  reveal?: { answer: number };
};
const state = (s: Socket, match: (st: State) => boolean, ms = 4000) =>
  new Promise<State>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no matching ao:state")), ms);
    const h = (st: State) => {
      if (!match(st)) return;
      clearTimeout(t);
      s.off("ao:state", h);
      resolve(st);
    };
    s.on("ao:state", h);
  });

describe("Quiz Party over Socket.IO", () => {
  it("plays a whole game: create, join, answer, results saved, leaderboard", async () => {
    const linh = await player("Linh");
    const mai = await player("Mai");

    const created = await ask(linh.s, "ao:create", { category: "mixed" });
    expect(created).toMatchObject({ ok: true });
    const code = created.code!;
    expect((await request(app).get("/api/arcade-online/rooms")).body[0]).toMatchObject({ code, host: "Linh", players: 1, phase: "lobby" });

    const lobby = state(linh.s, (st) => st.players.length === 2);
    expect(await ask(mai.s, "ao:join", { code: code.toLowerCase() })).toMatchObject({ ok: true });
    await lobby;

    expect(await ask(mai.s, "ao:start")).toMatchObject({ ok: false, error: "Only the host can do that" });
    const q1 = state(mai.s, (st) => st.phase === "question" && st.round === 1);
    expect(await ask(linh.s, "ao:start")).toMatchObject({ ok: true });
    const first = await q1;
    expect(first.question!.choices).toHaveLength(4);
    expect(first.reveal).toBeUndefined();

    // Both answer; the reveal says which was right
    const reveal = state(linh.s, (st) => st.phase === "reveal" && st.round === 1);
    expect(await ask(linh.s, "ao:answer", { round: 1, choice: 0 })).toMatchObject({ ok: true });
    expect(await ask(linh.s, "ao:answer", { round: 1, choice: 1 })).toMatchObject({ ok: false, error: "You already answered" });
    await ask(mai.s, "ao:answer", { round: 1, choice: 1 });
    expect(typeof (await reveal).reveal!.answer).toBe("number");

    // Round 2: nobody answers; time runs out by itself, then the final scores
    const final = await state(linh.s, (st) => st.phase === "final", 5000);
    expect(final.players).toHaveLength(2);

    await new Promise((r) => setTimeout(r, 200)); // results are saved just after the final state
    const { rows } = await pool.query("select count(*)::int as n from online_game_players");
    expect(rows[0].n).toBe(2);
    const board = await request(app).get("/api/arcade-online/leaderboard");
    expect(board.body.map((r: { name: string }) => r.name).sort()).toEqual(["Linh", "Mai"]);
  });

  it("needs a name, a real code, and keeps late-comers out of a started game", async () => {
    const guest = connect(url, { path: "/api/realtime", addTrailingSlash: false, transports: ["websocket"], auth: { clientId: randomUUID() }, forceNew: true });
    sockets.push(guest);
    await new Promise((r) => guest.once("presence", r));
    expect(await ask(guest, "ao:create")).toMatchObject({ ok: false, error: "Pick a name to play" });

    const linh = await player("Linh");
    expect(await ask(linh.s, "ao:join", { code: "ZZZZ" })).toMatchObject({ ok: false, error: "No room with that code" });
    const { code } = await ask(linh.s, "ao:create");
    await ask(linh.s, "ao:start");
    const bao = await player("Bao");
    expect(await ask(bao.s, "ao:join", { code })).toMatchObject({ ok: false });
  });

  it("closes a lobby seat when a player disconnects, and passes on the host", async () => {
    const linh = await player("Linh");
    const mai = await player("Mai");
    const { code } = await ask(linh.s, "ao:create");
    await ask(mai.s, "ao:join", { code });
    const after = state(mai.s, (st) => st.players.length === 1);
    linh.s.disconnect();
    const st = await after;
    expect(st.hostId).toBe(mai.id);
  });
});
