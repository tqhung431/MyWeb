// Stage 27: a name you can get back. A PIN, signing in on another device (name + PIN, or a code from a device
// that's already you, or a claim code from the admin), the Devices list, and locking after wrong PINs.

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

const agent = () => request.agent(app).set("User-Agent", "Mozilla/5.0 (iPhone) Safari");

describe("PIN and signing in on another device", () => {
  it("a name with a PIN can be signed into on a new browser; the PIN is never stored as typed", async () => {
    const phone = agent();
    const made = await phone.post("/api/me").send({ name: "Linh", pin: "4821" });
    expect(made.status).toBe(201);
    expect(made.body.user.hasPin).toBe(true);
    const { rows } = await pool.query("select pin_hash from users");
    expect(rows[0].pin_hash).not.toContain("4821");
    expect(rows[0].pin_hash).toMatch(/^[\w-]+:[\w-]+$/);

    // a new laptop: the name is taken, but the PIN gets it back
    const laptop = agent();
    expect((await laptop.post("/api/me").send({ name: "linh" })).status).toBe(409);
    expect((await laptop.post("/api/me/sign-in").send({ name: "LINH", pin: "1111" })).status).toBe(401);
    const ok = await laptop.post("/api/me/sign-in").send({ name: "linh", pin: "4821" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe("Linh");
    expect((await laptop.get("/api/me")).body.user.name).toBe("Linh");

    // both devices are listed; signing the other one out works from either
    const devices = (await laptop.get("/api/me/devices")).body;
    expect(devices).toHaveLength(2);
    expect(devices.filter((d: { current: boolean }) => d.current)).toHaveLength(1);
    expect(devices[0].userAgent).toContain("iPhone");
    expect((await laptop.delete("/api/me/devices/others")).body.signedOut).toBe(1);
    expect((await phone.get("/api/me")).body.user).toBeNull();
    // this browser can sign itself out
    expect((await laptop.post("/api/me/sign-out")).status).toBe(204);
    expect((await laptop.get("/api/me")).body.user).toBeNull();
  });

  it("10 wrong PINs lock the name for 15 minutes, even with the right PIN", async () => {
    await agent().post("/api/me").send({ name: "Bou", pin: "123456" });
    const thief = agent();
    for (let i = 0; i < 9; i++) expect((await thief.post("/api/me/sign-in").send({ name: "Bou", pin: String(100000 + i) })).status).toBe(401);
    expect((await thief.post("/api/me/sign-in").send({ name: "Bou", pin: "999999" })).status).toBe(429);
    expect((await thief.post("/api/me/sign-in").send({ name: "Bou", pin: "123456" })).status).toBe(429);
    await pool.query("update users set pin_locked_until = now() - interval '1 second'");
    expect((await agent().post("/api/me/sign-in").send({ name: "Bou", pin: "123456" })).status).toBe(200);
  });

  it("a name without a PIN only works on its own device; setting a PIN fixes that; PINs are 4 to 6 digits", async () => {
    const own = agent();
    expect((await own.post("/api/me").send({ name: "Mai" })).body.user.hasPin).toBe(false);
    const res = await agent().post("/api/me/sign-in").send({ name: "Mai", pin: "0000" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/no PIN yet/);
    for (const pin of ["12", "1234567", "abcd", "12 34"]) expect((await own.put("/api/me/pin").send({ pin })).status, pin).toBe(400);
    expect((await own.put("/api/me/pin").send({ pin: "0420" })).body.user.hasPin).toBe(true);
    expect((await own.get("/api/me")).body.user.hasPin).toBe(true);
    expect((await agent().post("/api/me/sign-in").send({ name: "Mai", pin: "0420" })).status).toBe(200);
  });

  it("a device code signs in another device once, within 5 minutes", async () => {
    const phone = agent();
    await phone.post("/api/me").send({ name: "Ann" });
    const { code, expiresAt } = (await phone.post("/api/me/codes")).body;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(new Date(expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000 + 1000);
    const tablet = agent();
    expect((await tablet.post("/api/me/sign-in/code").send({ code: code.toLowerCase() })).body.user.name).toBe("Ann");
    expect((await agent().post("/api/me/sign-in/code").send({ code })).status).toBe(401); // works once
    // an expired code doesn't work
    const second = (await phone.post("/api/me/codes")).body.code;
    await pool.query("update sign_in_codes set expires_at = now() - interval '1 second'");
    expect((await agent().post("/api/me/sign-in/code").send({ code: second })).status).toBe(401);
  });

  it("a deleted person's name is reserved; the PIN hash is never cached or sent", async () => {
    const me = agent();
    await me.post("/api/me").send({ name: "Cat", pin: "7777" });
    const body = JSON.stringify((await me.get("/api/me")).body);
    expect(body).not.toMatch(/pin_?hash|7777/i);
    await me.delete("/api/me");
    const again = await agent().post("/api/me").send({ name: "cat" });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/used here recently/);
  });
});
