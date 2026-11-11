// Stage 10: Mini Arcade high scores and leaderboards.

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

const save = (client: string, game: string, score: number) =>
  request(app).post("/api/arcade/scores").set("X-Client-Id", client).send({ game, score });

describe("saving scores", () => {
  it("says when a score is a new best, for games where higher is better", async () => {
    const me = randomUUID();
    const first = await save(me, "worm", 40);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ score: 40, best: 40, previousBest: null, newBest: true, rank: 1 });

    const worse = await save(me, "worm", 25);
    expect(worse.body).toMatchObject({ best: 40, newBest: false });

    const better = await save(me, "worm", 55);
    expect(better.body).toMatchObject({ best: 55, previousBest: 40, newBest: true });
  });

  it("understands games where lower is better (reaction time)", async () => {
    const me = randomUUID();
    await save(me, "reflex", 320);
    const faster = await save(me, "reflex", 250);
    expect(faster.body).toMatchObject({ best: 250, newBest: true });
    const slower = await save(me, "reflex", 400);
    expect(slower.body).toMatchObject({ best: 250, newBest: false });
  });

  it("refuses unknown games and impossible scores", async () => {
    const me = randomUUID();
    expect((await save(me, "chess", 10)).status).toBe(400);
    expect((await save(me, "worm", 999_999)).status).toBe(400);
    expect((await save(me, "pairs", 3)).status).toBe(400); // 8 pairs need at least 8 moves
    expect((await save(me, "worm", 1.5)).status).toBe(400);
    expect((await request(app).post("/api/arcade/scores").send({ game: "worm", score: 5 })).status).toBe(400); // no owner
  });
});

describe("leaderboards", () => {
  it("lists each person's best once, best first, and my rank", async () => {
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    await save(a, "bonk", 30);
    await save(a, "bonk", 90);
    await save(b, "bonk", 60);
    await save(c, "bonk", 10);

    const res = await request(app).get("/api/arcade/scores/bonk").set("X-Client-Id", b);
    expect(res.status).toBe(200);
    expect(res.body.top.map((r: { score: number }) => r.score)).toEqual([90, 60, 10]);
    expect(res.body.top[1]).toMatchObject({ rank: 2, name: "Guest", me: true });
    expect(res.body).toMatchObject({ best: 60, rank: 2 });
  });

  it("sorts lowest first when lower is better", async () => {
    await save(randomUUID(), "pairs", 20);
    await save(randomUUID(), "pairs", 12);
    const res = await request(app).get("/api/arcade/scores/pairs");
    expect(res.body.top.map((r: { score: number }) => r.score)).toEqual([12, 20]);
    expect(res.body.best).toBeNull();
  });

  it("'this week' leaves out older scores", async () => {
    const me = randomUUID();
    await save(me, "odd", 50);
    await pool.query("update game_scores set created_at = now() - interval '10 days'");
    await save(me, "odd", 20);
    const week = await request(app).get("/api/arcade/scores/odd?period=week").set("X-Client-Id", me);
    expect(week.body.top.map((r: { score: number }) => r.score)).toEqual([20]);
    const all = await request(app).get("/api/arcade/scores/odd?period=all").set("X-Client-Id", me);
    expect(all.body.best).toBe(50);
  });

  it("gives my best in every game", async () => {
    const me = randomUUID();
    await save(me, "worm", 12);
    await save(me, "reflex", 300);
    await save(me, "reflex", 280);
    const res = await request(app).get("/api/arcade/me").set("X-Client-Id", me);
    expect(res.body.bests).toEqual({ worm: 12, reflex: 280 });
  });
});

describe("accounts", () => {
  it("moves guest scores to you when you pick a name, with your name on the board", async () => {
    const guest = randomUUID();
    await save(guest, "pancakes", 14);
    const browser = request.agent(app);
    await browser
      .post("/api/me")
      .set("X-Client-Id", guest)
      .send({ name: "Linh Tran" });

    const me = await browser.get("/api/arcade/me").set("X-Client-Id", guest);
    expect(me.body.bests).toEqual({ pancakes: 14 });
    const board = await browser.get("/api/arcade/scores/pancakes");
    expect(board.body.top[0]).toMatchObject({ name: "Linh Tran", score: 14, me: true });

    // Signed out on the same browser, the scores aren't shown as the guest's any more
    const signedOut = await request(app).get("/api/arcade/me").set("X-Client-Id", guest);
    expect(signedOut.body.bests).toEqual({});
  });
});
