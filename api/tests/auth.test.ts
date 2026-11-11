// Login tests: real HTTP requests against a real test database.

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { closeAll, ORIGIN, resetDatabase, SITE_HOST } from "./helpers.js";

const app = createApp();
const alice = { email: "Alice@Example.com", password: "correct horse battery", name: "Alice" };

beforeEach(resetDatabase);
afterAll(closeAll);

function sessionCookie(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return cookies.find((c) => c.startsWith("myweb_session="));
}

describe("register", () => {
  it("creates an account and signs in with an httpOnly cookie", async () => {
    const res = await request(app).post("/api/auth/register").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).send(alice);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "alice@example.com", name: "Alice" });
    expect(res.body.user.passwordHash).toBeUndefined(); // never sent to the browser

    const cookie = sessionCookie(res)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("stores a hash, never the password", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const { rows } = await pool.query("select password_hash from users");
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain(alice.password);
  });

  it("refuses a second account with the same email (any letter case)", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const res = await request(app).post("/api/auth/register").send({ ...alice, email: "ALICE@example.com" });
    expect(res.status).toBe(409);
  });

  it("checks the input", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "nope", password: "short", name: "" });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("login, me and logout", () => {
  it("works end to end", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const browser = request.agent(app); // keeps cookies between requests, like a browser

    expect((await browser.get("/api/auth/me")).body.user).toBeNull();

    const login = await browser.post("/api/auth/login").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).send({ email: alice.email, password: alice.password });
    expect(login.status).toBe(200);

    const me = await browser.get("/api/auth/me");
    expect(me.body.user.email).toBe("alice@example.com");

    expect((await browser.post("/api/auth/logout").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST)).status).toBe(204);
    expect((await browser.get("/api/auth/me")).body.user).toBeNull();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await request(app).post("/api/auth/register").send(alice);
    const wrong = await request(app).post("/api/auth/login").send({ email: alice.email, password: "wrong password" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "bob@example.com", password: "whatever1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("makes a stolen-then-logged-out cookie useless", async () => {
    const res = await request(app).post("/api/auth/register").send(alice);
    const cookie = sessionCookie(res)!.split(";")[0];
    await request(app).post("/api/auth/logout").set("Cookie", cookie);
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body.user).toBeNull();
  });

  it("stores only a hash of the session token", async () => {
    const res = await request(app).post("/api/auth/register").send(alice);
    const token = sessionCookie(res)!.split(";")[0].split("=")[1];
    const { rows } = await pool.query("select id from auth_sessions");
    expect(rows[0].id).not.toBe(token);
    expect(rows[0].id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("focus sessions with accounts", () => {
  it("moves anonymous sessions into the account on sign-up", async () => {
    const clientId = randomUUID();
    await request(app).post("/api/sessions").set("X-Client-Id", clientId).send({ mode: "focus", minutes: 25 });

    const browser = request.agent(app);
    await browser.post("/api/auth/register").set("X-Client-Id", clientId).send(alice);
    const summary = await browser.get("/api/sessions/summary");
    expect(summary.body.total).toBe(1);
  });

  it("follows the user to another device", async () => {
    const laptop = request.agent(app);
    await laptop.post("/api/auth/register").send(alice);
    await laptop.post("/api/sessions").send({ mode: "focus", minutes: 25 });

    const phone = request.agent(app);
    await phone.post("/api/auth/login").send({ email: alice.email, password: alice.password });
    expect((await phone.get("/api/sessions/summary")).body.total).toBe(1);
  });

  it("hides a user's sessions from the same browser after logout", async () => {
    const clientId = randomUUID();
    const browser = request.agent(app);
    await browser.post("/api/auth/register").set("X-Client-Id", clientId).send(alice);
    await browser.post("/api/sessions").set("X-Client-Id", clientId).send({ mode: "focus", minutes: 25 });
    await browser.post("/api/auth/logout");

    const anon = await browser.get("/api/sessions/summary").set("X-Client-Id", clientId);
    expect(anon.body.total).toBe(0);
  });
});

describe("CSRF protection", () => {
  it("blocks POSTs from other websites", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", "https://evil.example").send(alice);
    expect(res.status).toBe(403);
  });

  it("allows another PC that opened Nook by its network address", async () => {
    // The browser on the other PC opened http://192.168.1.20:3000; the Next.js proxy passes that on.
    const res = await request(app)
      .post("/api/auth/register")
      .set("Origin", "http://192.168.1.20:3000")
      .set("X-Forwarded-Host", "192.168.1.20:3000")
      .send(alice);
    expect(res.status).toBe(201);
  });

  it("blocks a page on one address posting to another", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://192.168.1.99:3000")
      .set("X-Forwarded-Host", "192.168.1.20:3000")
      .send(alice);
    expect(res.status).toBe(403);
  });

  it("only accepts JSON bodies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST)
      .type("form")
      .send("email=a@b.c&password=x");
    expect(res.status).toBe(415);
  });
});
