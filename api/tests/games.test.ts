// Stage 16: Nook Games cloud saves.

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

async function person(name: string) {
  const agent = request.agent(app);
  await agent.post("/api/me").send({ name });
  return agent;
}

const save = (layer: number, extra = {}) => ({ version: 1, summary: `Luyện Khí tầng ${layer}`, data: { v: 1, player: { name: "Lan", layer }, ...extra } });

describe("game saves", () => {
  it("needs a name: guests keep their save on their own device", async () => {
    const res = await request(app).put("/api/games/saves/van-lo").send(save(1));
    expect(res.status).toBe(401);
  });

  it("saves, loads, replaces and deletes", async () => {
    const lan = await person("Lan");
    expect((await lan.get("/api/games/saves/van-lo")).status).toBe(404);

    expect((await lan.put("/api/games/saves/van-lo").send(save(1))).status).toBe(200);
    await lan.put("/api/games/saves/van-lo").send(save(4));
    const got = await lan.get("/api/games/saves/van-lo");
    expect(got.status).toBe(200);
    expect(got.body).toMatchObject({ game: "van-lo", version: 1, summary: "Luyện Khí tầng 4", data: { player: { layer: 4 } } });

    const list = await lan.get("/api/games/saves");
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty("data");

    expect((await lan.delete("/api/games/saves/van-lo")).status).toBe(204);
    expect((await lan.get("/api/games/saves/van-lo")).status).toBe(404);
  });

  it("each person has their own save", async () => {
    const lan = await person("Lan");
    const mai = await person("Mai");
    await lan.put("/api/games/saves/van-lo").send(save(7));
    expect((await mai.get("/api/games/saves/van-lo")).status).toBe(404);
  });

  it("accepts saves bigger than the usual 10 KB, but not huge ones", async () => {
    const lan = await person("Lan");
    const big = save(2, { map: "#".repeat(60_000) });
    expect((await lan.put("/api/games/saves/van-lo").send(big)).status).toBe(200);
    const huge = save(2, { map: "#".repeat(300_000) });
    expect((await lan.put("/api/games/saves/van-lo").send(huge)).status).toBe(413);
  });

  it("refuses unknown games and bad bodies", async () => {
    const lan = await person("Lan");
    expect((await lan.put("/api/games/saves/minecraft").send(save(1))).status).toBe(400);
    expect((await lan.put("/api/games/saves/van-lo").send({ version: 1, data: "nope" })).status).toBe(400);
  });

  it("goes when the person is deleted", async () => {
    const lan = await person("Lan");
    await lan.put("/api/games/saves/van-lo").send(save(1));
    await lan.delete("/api/me");
    const { rows } = await pool.query("select count(*)::int as n from game_saves");
    expect(rows[0].n).toBe(0);
  });

  it("ranks cultivators by realm, then by enemies defeated (Stage 18)", async () => {
    const lan = await person("Lan");
    const mai = await person("Mai");
    const vy = await person("Vy");
    await lan.put("/api/games/saves/van-lo").send({ ...save(5), board: { path: "kiem", level: 14, kills: 300 } });
    await mai.put("/api/games/saves/van-lo").send({ ...save(5), board: { path: "binh", level: 14, kills: 420 } });
    await vy.put("/api/games/saves/van-lo").send(save(1)); // an old save without board info: not listed
    const board = (await mai.get("/api/games/leaderboard/van-lo")).body;
    expect(board).toEqual([
      expect.objectContaining({ rank: 1, name: "Mai", path: "binh", level: 14, kills: 420, me: true }),
      expect.objectContaining({ rank: 2, name: "Lan", path: "kiem", me: false }),
    ]);
    expect((await request(app).get("/api/games/leaderboard/van-lo")).status).toBe(200); // public
  });
});
