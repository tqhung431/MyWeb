// Stage 11: Nook keeps data only for a while (DATA_RETENTION_DAYS = 90, CHAT_RETENTION_DAYS = 30).

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { processJob } from "../src/jobs/handlers.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

const count = async (table: string) => (await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n as number;

describe("cleanup", () => {
  it("deletes people not seen for 90 days, with everything they made; active people stay", async () => {
    const old = request.agent(app);
    await old.post("/api/me").send({ name: "Old Timer" });
    await old.post("/api/sessions").send({ mode: "focus", minutes: 25 });
    await old.put("/api/hobby/groups/books/membership");
    await old.post("/api/hobby/groups/books/posts").send({ body: "Hello" });
    await old.post("/api/arcade/scores").send({ game: "worm", score: 10 });
    const active = request.agent(app);
    await active.post("/api/me").send({ name: "Active" });
    await active.put("/api/hobby/groups/books/membership");
    await active.post("/api/hobby/groups/books/posts").send({ body: "Still here" });

    await pool.query("update users set last_seen_at = now() - interval '91 days' where name = 'Old Timer'");
    const result = await processJob("cleanup", {});
    expect(result).toMatchObject({ people: 1 });

    expect((await pool.query("select name from users")).rows).toEqual([{ name: "Active" }]);
    expect(await count("focus_sessions")).toBe(0);
    expect(await count("game_scores")).toBe(0);
    expect(await count("posts")).toBe(1);
    // Stage 27: the name stays reserved for 30 days, so nobody can take it and pretend; then it's free again
    expect((await request(app).post("/api/me").send({ name: "Old Timer" })).status).toBe(409);
    await pool.query("update reserved_names set until = now() - interval '1 minute'");
    expect((await request(app).post("/api/me").send({ name: "Old Timer" })).status).toBe(201);
  });

  it("deletes chat messages after 30 days, and old guest history after 90", async () => {
    const linh = request.agent(app);
    await linh.post("/api/me").send({ name: "Linh" });
    await linh.put("/api/hobby/groups/gaming/membership");
    await linh.post("/api/hobby/groups/gaming/messages").send({ body: "old news" });
    await linh.post("/api/hobby/groups/gaming/messages").send({ body: "fresh" });
    await pool.query("update chat_messages set created_at = now() - interval '31 days' where body = 'old news'");

    const guest = randomUUID();
    await request(app).post("/api/sessions").set("X-Client-Id", guest).send({ mode: "focus", minutes: 25 });
    await request(app).post("/api/sessions").set("X-Client-Id", guest).send({ mode: "focus", minutes: 25 });
    await pool.query("update focus_sessions set completed_at = now() - interval '100 days' where id = (select min(id) from focus_sessions)");

    const result = await processJob("cleanup", {});
    expect(result).toMatchObject({ people: 0, chatMessages: 1, guestRows: 1 });
    expect((await pool.query("select body from chat_messages")).rows).toEqual([{ body: "fresh" }]);
    expect(await count("focus_sessions")).toBe(1);
  });

  it("moves 'last seen' forward when you use Nook", async () => {
    const linh = request.agent(app);
    await linh.post("/api/me").send({ name: "Linh" });
    await pool.query("update users set last_seen_at = now() - interval '80 days'");
    await linh.get("/api/me");
    const { rows } = await pool.query("select extract(epoch from now() - last_seen_at) as age from users");
    expect(Number(rows[0].age)).toBeLessThan(60);
  });
});
