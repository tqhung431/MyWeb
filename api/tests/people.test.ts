// Stage 11: you are a name on a browser (no email, no password).

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { closeAll, ORIGIN, resetDatabase, SITE_HOST } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

function sessionCookie(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return cookies.find((c) => c.startsWith("nook_session="));
}

describe("picking a name", () => {
  it("creates you and remembers this browser with an httpOnly cookie", async () => {
    const browser = request.agent(app);
    expect((await browser.get("/api/me")).body.user).toBeNull();
    const res = await browser.post("/api/me").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).send({ name: "  Linh   Tran " });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Linh Tran" });
    expect(Object.keys(res.body.user).sort()).toEqual(["createdAt", "id", "name", "preferences"]); // nothing else about you
    expect(sessionCookie(res)).toMatch(/HttpOnly/i);
    expect(sessionCookie(res)).toMatch(/SameSite=Lax/i);
    expect((await browser.get("/api/me")).body.user.name).toBe("Linh Tran");
  });

  it("keeps names unique, ignoring upper/lower case", async () => {
    await request(app).post("/api/me").send({ name: "Linh" });
    const again = await request(app).post("/api/me").send({ name: "LINH" });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already called/);
  });

  it("refuses empty, too long, 'Guest' and odd characters", async () => {
    for (const name of ["", "   ", "x".repeat(31), "Guest", "<b>hi</b>", "a\u0000b"]) {
      expect((await request(app).post("/api/me").send({ name })).status, JSON.stringify(name)).toBe(400);
    }
    expect((await request(app).post("/api/me").send({ name: "Bà Ngoại 👵" })).status).toBe(201); // any language, emoji
  });

  it("can't pick a second name on the same browser, but can change it", async () => {
    const browser = request.agent(app);
    await browser.post("/api/me").send({ name: "Linh" });
    expect((await browser.post("/api/me").send({ name: "Mai" })).status).toBe(409);
    const renamed = await browser.patch("/api/me").send({ name: "Linh 🌙" });
    expect(renamed.body.user.name).toBe("Linh 🌙");
    expect((await browser.get("/api/me")).body.user.name).toBe("Linh 🌙"); // the cached copy was refreshed
    await request(app).post("/api/me").send({ name: "Mai" });
    expect((await browser.patch("/api/me").send({ name: "mai" })).status).toBe(409);
  });

  it("stores only a hash of the session token", async () => {
    const res = await request(app).post("/api/me").send({ name: "Linh" });
    const token = sessionCookie(res)!.split(";")[0].split("=")[1];
    const { rows } = await pool.query("select id from auth_sessions");
    expect(rows[0].id).not.toBe(token);
    expect(rows[0].id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("makes what this browser did as a guest yours", async () => {
    const clientId = randomUUID();
    await request(app).post("/api/sessions").set("X-Client-Id", clientId).send({ mode: "focus", minutes: 25 });
    await request(app).post("/api/arcade/scores").set("X-Client-Id", clientId).send({ game: "worm", score: 30 });

    const browser = request.agent(app);
    await browser.post("/api/me").set("X-Client-Id", clientId).send({ name: "Linh" });
    expect((await browser.get("/api/sessions/summary")).body.total).toBe(1);
    expect((await browser.get("/api/arcade/me")).body.bests).toEqual({ worm: 30 });
    // and the same browser without the cookie doesn't see them as a guest any more
    expect((await request(app).get("/api/sessions/summary").set("X-Client-Id", clientId)).body.total).toBe(0);
  });
});

describe("what Nook keeps about you", () => {
  it("lists it, with how long it's kept", async () => {
    const browser = request.agent(app);
    await browser.post("/api/me").send({ name: "Linh" });
    await browser.post("/api/sessions").send({ mode: "focus", minutes: 25 });
    await browser.post("/api/hobby/groups/cooking/posts").send({ body: "Pho tonight!" });
    const data = await browser.get("/api/me/data");
    expect(data.body).toMatchObject({ name: "Linh", keptForDays: 90, chatKeptForDays: 30 });
    expect(data.body.counts).toMatchObject({ focusSessions: 1, posts: 1, chatMessages: 0 });
  });

  it("deletes you and everything you made when you ask", async () => {
    const browser = request.agent(app);
    const res = await browser.post("/api/me").send({ name: "Linh" });
    const cookie = sessionCookie(res)!.split(";")[0];
    await browser.post("/api/sessions").send({ mode: "focus", minutes: 25 });
    await browser.post("/api/hobby/groups/cooking/posts").send({ body: "Pho tonight!" });
    await browser.post("/api/hobby/groups/cooking/messages").send({ body: "hi!" });

    expect((await browser.delete("/api/me")).status).toBe(204);
    expect((await request(app).get("/api/me").set("Cookie", cookie)).body.user).toBeNull(); // the old cookie is useless
    for (const table of ["users", "focus_sessions", "posts", "chat_messages", "auth_sessions"]) {
      const { rows } = await pool.query(`select count(*)::int as n from ${table}`);
      expect(rows[0].n, table).toBe(0);
    }
    // the name is free again
    expect((await request(app).post("/api/me").send({ name: "Linh" })).status).toBe(201);
  });
});

describe("CSRF protection", () => {
  it("blocks POSTs from other websites", async () => {
    const res = await request(app).post("/api/me").set("Origin", "https://evil.example").send({ name: "Linh" });
    expect(res.status).toBe(403);
  });

  it("allows another PC that opened Nook by its network address", async () => {
    const res = await request(app)
      .post("/api/me")
      .set("Origin", "http://192.168.1.20:3000")
      .set("X-Forwarded-Host", "192.168.1.20:3000")
      .send({ name: "Linh" });
    expect(res.status).toBe(201);
  });

  it("blocks a page on one address posting to another", async () => {
    const res = await request(app)
      .post("/api/me")
      .set("Origin", "http://192.168.1.99:3000")
      .set("X-Forwarded-Host", "192.168.1.20:3000")
      .send({ name: "Linh" });
    expect(res.status).toBe(403);
  });

  it("only accepts JSON bodies", async () => {
    const res = await request(app).post("/api/me").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).type("form").send("name=Linh");
    expect(res.status).toBe(415);
  });
});
