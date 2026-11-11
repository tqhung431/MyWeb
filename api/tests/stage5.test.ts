// Stage 5: cache, shared rate limits, job queue + worker, and life without Valkey.
// Uses a real Valkey (database 1) and the real test PostgreSQL.

import { randomUUID } from "node:crypto";
import { Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { pool } from "../src/db/client.js";
import { seed } from "../src/db/seed.js";
import { processJob } from "../src/jobs/handlers.js";
import type { JobName } from "../src/jobs/queue.js";
import { valkey } from "../src/valkey/client.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
const alice = { name: "Alice" };

beforeEach(resetDatabase);
afterAll(closeAll);

describe("cache (tips)", () => {
  it("answers MISS first, then HIT from Valkey", async () => {
    expect((await request(app).get("/api/tips")).headers["x-cache"]).toBe("MISS");
    await new Promise((r) => setTimeout(r, 50)); // the copy is saved without waiting
    const second = await request(app).get("/api/tips");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body).toHaveLength(4);
  });

  it("serves the cached copy until it's invalidated", async () => {
    await request(app).get("/api/tips/real-breaks");
    await new Promise((r) => setTimeout(r, 50));
    await pool.query("update tips set title = 'Changed in SQL' where slug = 'real-breaks'");

    // Still the old copy: the database changed behind the cache's back
    expect((await request(app).get("/api/tips/real-breaks")).body.title).toBe("Take real breaks");

    await seed(); // seeding deletes the cached copies (and resets the title)
    const fresh = await request(app).get("/api/tips/real-breaks");
    expect(fresh.headers["x-cache"]).toBe("MISS");
  });
});

describe("cached session lookups", () => {
  it("stop working right after you delete yourself, even though they were cached", async () => {
    const res = await request(app).post("/api/me").send(alice);
    const cookie = ([] as string[]).concat(res.headers["set-cookie"])[0].split(";")[0];

    await request(app).get("/api/me").set("Cookie", cookie); // now cached in Valkey
    expect(await valkey.keys("auth:session:*")).toHaveLength(1);

    await request(app).delete("/api/me").set("Cookie", cookie);
    expect(await valkey.keys("auth:session:*")).toHaveLength(0);
    expect((await request(app).get("/api/me").set("Cookie", cookie)).body.user).toBeNull();
  });
});

describe("shared rate-limit counters", () => {
  it("are stored in Valkey, so every API server sees the same count", async () => {
    await request(app).post("/api/me").send({ name: "Linh" });
    const keys = await valkey.keys("ratelimit:name-all:*");
    expect(keys).toEqual(["ratelimit:name-all:all"]);
    expect(await valkey.get(keys[0])).toBe("1");
    expect(await valkey.pttl(keys[0])).toBeGreaterThan(0); // the window expires by itself
  });
});

describe("job queue + worker", () => {
  it("queues a badge check when a focus session is saved; a worker awards the badge", async () => {
    const clientId = randomUUID();
    const saved = await request(app)
      .post("/api/sessions")
      .set("X-Client-Id", clientId)
      .set("X-Time-Zone", "Asia/Ho_Chi_Minh")
      .send({ mode: "focus", minutes: 25 });
    expect(saved.status).toBe(201);

    // The job waits in Valkey until a worker takes it
    const connection = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: null });
    const queue = new Queue(config.QUEUE_NAME, { connection });
    expect(await queue.getWaitingCount()).toBe(1);

    let earned = (await request(app).get("/api/achievements").set("X-Client-Id", clientId)).body;
    expect(earned.find((a: { code: string }) => a.code === "first-focus").earnedAt).toBeNull(); // not yet

    // Start a real worker, wait for the job to finish
    const events = new QueueEvents(config.QUEUE_NAME, { connection: new Redis(config.VALKEY_URL, { maxRetriesPerRequest: null }) });
    await events.waitUntilReady();
    const finished = new Promise((resolve) => events.once("completed", resolve));
    const worker = new Worker(config.QUEUE_NAME, (job) => processJob(job.name as JobName, job.data), { connection });
    await finished;
    await worker.close();
    await events.close();
    await queue.close();

    earned = (await request(app).get("/api/achievements").set("X-Client-Id", clientId)).body;
    expect(earned.find((a: { code: string }) => a.code === "first-focus").earnedAt).not.toBeNull();
  });

  it("queues a badge check when you pick a name", async () => {
    await request(app).post("/api/me").send(alice);
    const queue = new Queue(config.QUEUE_NAME, { connection: new Redis(config.VALKEY_URL, { maxRetriesPerRequest: null }) });
    const names = (await queue.getWaiting()).map((j) => j.name).sort();
    expect(names).toEqual(["achievements"]);
    await queue.close();
  });

  it("moves guest badges into the account: the account is re-checked from the merged history", async () => {
    const clientId = randomUUID();
    await request(app).post("/api/sessions").set("X-Client-Id", clientId).send({ mode: "focus", minutes: 25 });
    await processJob("achievements", { userId: null, clientId, timeZone: "UTC" });

    const browser = request.agent(app);
    const reg = await browser.post("/api/me").set("X-Client-Id", clientId).send(alice);
    await processJob("achievements", { userId: reg.body.user.id, clientId: null, timeZone: "UTC" });

    const mine = (await browser.get("/api/achievements")).body;
    expect(mine.find((a: { code: string }) => a.code === "first-focus").earnedAt).not.toBeNull();
    const { rows } = await pool.query("select count(*)::int as n from achievements where user_id is null");
    expect(rows[0].n).toBe(0);
  });

  it("is safe to run twice", async () => {
    const clientId = randomUUID();
    await request(app).post("/api/sessions").set("X-Client-Id", clientId).send({ mode: "focus", minutes: 25 });
    const first = await processJob("achievements", { userId: null, clientId, timeZone: "UTC" });
    const again = await processJob("achievements", { userId: null, clientId, timeZone: "UTC" });
    expect(first.added).toContain("first-focus"); // (maybe "early-bird" too, depending on the clock)
    expect(again).toEqual({ added: [] });
  });
});

describe("without Valkey", () => {
  it("keeps working: tips from PostgreSQL, sessions saved, limits counted in memory", async () => {
    valkey.disconnect(); // simulate Valkey going down
    try {
      const tips = await request(app).get("/api/tips");
      expect(tips.status).toBe(200);
      expect(tips.headers["x-cache"]).toBe("MISS");

      const saved = await request(app)
        .post("/api/sessions")
        .set("X-Client-Id", randomUUID())
        .send({ mode: "focus", minutes: 25 });
      expect(saved.status).toBe(201);

      const health = await request(app).get("/health");
      expect(health.body.valkey).toMatch(/^down/);
    } finally {
      await valkey.connect();
    }
  });
});
