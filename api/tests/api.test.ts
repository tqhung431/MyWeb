// API tests: real HTTP requests (supertest) against a real test database.

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await pool.query("truncate tips, focus_sessions restart identity");
  await seed();
});

afterAll(async () => {
  await pool.end();
});

describe("health", () => {
  it("answers ok when the database is reachable", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("tips", () => {
  it("lists tips", async () => {
    const res = await request(app).get("/api/tips");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toMatchObject({ slug: "one-thing", title: "Pick one thing" });
  });

  it("returns one tip with its body", async () => {
    const res = await request(app).get("/api/tips/real-breaks");
    expect(res.status).toBe(200);
    expect(res.body.body).toHaveLength(2);
  });

  it("404s for an unknown tip", async () => {
    const res = await request(app).get("/api/tips/nope");
    expect(res.status).toBe(404);
  });
});

describe("sessions", () => {
  const client = randomUUID();

  it("saves a session and counts it in today's summary", async () => {
    const saved = await request(app)
      .post("/api/sessions")
      .set("X-Client-Id", client)
      .send({ mode: "focus", minutes: 25 });
    expect(saved.status).toBe(201);
    expect(saved.body).toMatchObject({ mode: "focus", minutes: 25, clientId: client });

    // breaks are saved but not counted as focus
    await request(app).post("/api/sessions").set("X-Client-Id", client).send({ mode: "short", minutes: 5 });

    const summary = await request(app)
      .get("/api/sessions/summary?tz=Asia/Ho_Chi_Minh&days=7")
      .set("X-Client-Id", client);
    expect(summary.status).toBe(200);
    expect(summary.body.days).toHaveLength(7);
    expect(summary.body.today).toMatchObject({ sessions: 1, minutes: 25 });
    expect(summary.body.total).toBe(1);
  });

  it("keeps each client's sessions separate", async () => {
    await request(app).post("/api/sessions").set("X-Client-Id", client).send({ mode: "focus", minutes: 25 });
    const other = await request(app).get("/api/sessions/summary").set("X-Client-Id", randomUUID());
    expect(other.body.total).toBe(0);
  });

  it("rejects bad input with 400 and details", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set("X-Client-Id", client)
      .send({ mode: "nap", minutes: 999 });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(["mode", "minutes"]);
  });

  it("requires a client id", async () => {
    const res = await request(app).post("/api/sessions").send({ mode: "focus", minutes: 25 });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown time zone", async () => {
    const res = await request(app).get("/api/sessions/summary?tz=Mars/Base").set("X-Client-Id", client);
    expect(res.status).toBe(400);
  });

  it("rejects broken JSON", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set("X-Client-Id", client)
      .set("Content-Type", "application/json")
      .send("{oops");
    expect(res.status).toBe(400);
  });
});
