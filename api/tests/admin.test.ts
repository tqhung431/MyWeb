// Stage 27: the admin. Becoming admin (and when that's refused), the Admin page's tools, moderation in Hobby Hub,
// reports (the admin sees only what was reported, never whole private chats), pausing, locking, and the admin log.

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { pool } from "../src/db/client.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

async function person(name: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/me").send({ name, pin: "2468" });
  return { agent, id: res.body.user.id as string };
}
async function admin(name = "Owner") {
  const p = await person(name);
  expect((await p.agent.post("/api/admin").send({ passcode: "let-me-in-please" })).status).toBe(200);
  return p;
}

describe("becoming admin", () => {
  it("logs wrong tries and successes; ends after 12 hours; the tools need the admin", async () => {
    const ann = await person("Ann");
    expect((await ann.agent.get("/api/admin/people")).status).toBe(403);
    expect((await ann.agent.post("/api/admin").send({ passcode: "wrong-wrong-wrong" })).status).toBe(403);
    expect((await ann.agent.post("/api/admin").send({ passcode: "let-me-in-please" })).status).toBe(200);
    expect((await ann.agent.get("/api/admin/people")).status).toBe(200);
    const log = (await ann.agent.get("/api/admin/log")).body.map((l: { action: string; byName: string }) => `${l.byName}: ${l.action}`);
    expect(log).toEqual(["Ann: became admin", "Ann: wrong admin passcode"]);
    // 12 hours later
    await pool.query("update auth_sessions set admin_until = now() - interval '1 minute'");
    expect((await ann.agent.get("/api/admin/people")).status).toBe(403);
    expect((await ann.agent.get("/api/admin")).body.isAdmin).toBe(false);
  });
});

describe("when becoming admin is refused", () => {
  it("a passcode under 16 characters switches admin off; over plain http on the network it's refused", async () => {
    const ann = await person("Ann");
    const real = config.ADMIN_PASSCODE;
    try {
      config.ADMIN_PASSCODE = "short-pass";
      // Stage 29: visitors only hear "not enabled", never why
      expect((await ann.agent.get("/api/admin")).body).toMatchObject({ enabled: false, problem: "off" });
      const short = await ann.agent.post("/api/admin").send({ passcode: "short-pass" });
      expect(short.status).toBe(403);
      expect(short.body.error).toBe("Admin isn't enabled on this Nook");
      config.ADMIN_PASSCODE = real;
      config.ADMIN_REQUIRE_HTTPS = true;
      // a phone on the home network over http: refused, so the passcode never travels unencrypted
      const lan = await ann.agent.post("/api/admin").set("Host", "192.168.1.20").send({ passcode: real });
      expect(lan.status).toBe(403);
      expect(lan.body.error).toBe("Admin isn't available on this connection");
      // on the Nook PC itself (localhost) it's fine; over https too (req.secure, behind Caddy)
      const local = await ann.agent.post("/api/admin").set("Host", "localhost:4000").send({ passcode: real });
      expect(local.status).toBe(200);
    } finally {
      config.ADMIN_PASSCODE = real;
      config.ADMIN_REQUIRE_HTTPS = false;
    }
  });
});

describe("the Admin page", () => {
  it("people: list, rename, claim code (forgets the old PIN), sign out everywhere, pause, delete with the name typed", async () => {
    const boss = await admin();
    const bou = await person("Bou");
    const people = (await boss.agent.get("/api/admin/people")).body;
    expect(people.map((p: { name: string }) => p.name).sort()).toEqual(["Bou", "Owner"]);
    expect(people.find((p: { name: string }) => p.name === "Bou")).toMatchObject({ hasPin: true, devices: 1, pausedUntil: null });

    expect((await boss.agent.patch(`/api/admin/people/${bou.id}`).send({ name: "Bou 🐻" })).body.name).toBe("Bou 🐻");
    expect((await bou.agent.get("/api/me")).body.user.name).toBe("Bou 🐻");

    // locked out: the admin makes a claim code; it signs Bou in on a new phone, and the old PIN is gone
    const { code } = (await boss.agent.post(`/api/admin/people/${bou.id}/claim-code`)).body;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const phone = request.agent(app);
    const signed = await phone.post("/api/me/sign-in/code").send({ code });
    expect(signed.body.user).toMatchObject({ name: "Bou 🐻", hasPin: false });
    expect((await request(app).post("/api/me/sign-in").send({ name: "Bou 🐻", pin: "2468" })).status).toBe(403);

    // pause: can read, can't write; lifting it works
    expect((await boss.agent.post(`/api/admin/people/${bou.id}/pause`).send({ days: 7 })).status).toBe(200);
    expect((await phone.get("/api/hobby/groups")).status).toBe(200);
    const blocked = await phone.post("/api/hobby/groups").send({ name: "Pause test", emoji: "🎲" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatch(/paused/);
    expect((await phone.put("/api/me/pin").send({ pin: "1357" })).status).toBe(200); // their own account still works
    await boss.agent.post(`/api/admin/people/${bou.id}/pause`).send({ days: 0 });
    expect((await phone.post("/api/hobby/groups").send({ name: "Pause test", emoji: "🎲" })).status).toBe(201);

    // sign out everywhere (the admin's own browser stays)
    expect((await boss.agent.post(`/api/admin/people/${bou.id}/sign-out`)).body.signedOut).toBe(2);
    expect((await phone.get("/api/me")).body.user).toBeNull();

    // delete: the admin can't delete themselves; Bou needs the name typed exactly
    expect((await boss.agent.delete(`/api/admin/people/${boss.id}`).send({ confirm: "Owner" })).status).toBe(400);
    expect((await boss.agent.delete(`/api/admin/people/${bou.id}`).send({ confirm: "Bou" })).status).toBe(400);
    expect((await boss.agent.delete(`/api/admin/people/${bou.id}`).send({ confirm: "bou 🐻" })).status).toBe(204);
    expect((await pool.query("select count(*)::int as n from users")).rows[0].n).toBe(1);
    const log = (await boss.agent.get("/api/admin/log")).body.map((l: { action: string }) => l.action);
    expect(log).toEqual(expect.arrayContaining(["renamed someone", "made a sign-in code", "paused someone", "lifted a pause", "signed someone out everywhere", "deleted someone"]));
  });

  it("Hobby Hub: the admin deletes anyone's post, comment and chat message, and locks a group", async () => {
    const boss = await admin();
    const ann = await person("Ann");
    await ann.agent.put("/api/hobby/groups/gaming/membership");
    const post = (await ann.agent.post("/api/hobby/groups/gaming/posts").send({ body: "spam spam" })).body;
    const comment = (await ann.agent.post(`/api/hobby/posts/${post.id}/comments`).send({ body: "more spam" })).body;
    const msg = (await ann.agent.post("/api/hobby/groups/gaming/messages").send({ body: "chat spam" })).body;
    // someone else (not admin) still can't
    const bob = await person("Bob");
    expect((await bob.agent.delete(`/api/hobby/messages/${msg.id}`)).status).toBe(403);
    expect((await boss.agent.delete(`/api/hobby/comments/${comment.id}`)).status).toBe(204);
    expect((await boss.agent.delete(`/api/hobby/posts/${post.id}`)).status).toBe(204);
    expect((await boss.agent.delete(`/api/hobby/messages/${msg.id}`)).status).toBe(204);
    // locked: read yes, write no
    expect((await boss.agent.post("/api/admin/groups/gaming/lock").send({ locked: true })).body.locked).toBe(true);
    expect((await ann.agent.get("/api/hobby/groups/gaming/posts")).status).toBe(200);
    const locked = await ann.agent.post("/api/hobby/groups/gaming/messages").send({ body: "hello?" });
    expect(locked.status).toBe(403);
    expect(locked.body.error).toMatch(/locked/);
    const log = (await boss.agent.get("/api/admin/log")).body.map((l: { action: string }) => l.action);
    expect(log).toEqual(expect.arrayContaining(["deleted a post", "deleted a comment", "deleted a chat message", "locked a group"]));
  });

  it("reports: only what was reported reaches the admin; a private message only from the two people in it", async () => {
    const boss = await admin();
    const ann = await person("Ann");
    const mai = await person("Mai");
    const eve = await person("Eve");
    const dm = (await ann.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "a rude private message" })).body;
    await ann.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "a friendly one" });
    // someone outside the chat can't report it (and learns nothing)
    expect((await eve.agent.post("/api/reports").send({ kind: "dm", id: dm.id })).status).toBe(404);
    // you can't report your own
    expect((await ann.agent.post("/api/reports").send({ kind: "dm", id: dm.id })).status).toBe(400);
    expect((await mai.agent.post("/api/reports").send({ kind: "dm", id: dm.id, reason: "rude" })).status).toBe(201);
    expect((await mai.agent.post("/api/reports").send({ kind: "dm", id: dm.id, reason: "rude" })).status).toBe(201); // twice is fine, kept once

    const open = (await boss.agent.get("/api/admin/reports")).body;
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ kind: "dm", authorName: "Ann", excerpt: "a rude private message", where: "a private chat", reason: "rude", reporter: "Mai" });
    expect(JSON.stringify(open)).not.toContain("a friendly one"); // never the rest of the chat
    expect((await boss.agent.post(`/api/admin/reports/${open[0].id}`).send({ action: "delete" })).body.status).toBe("deleted");
    expect((await boss.agent.get("/api/admin/reports")).body).toHaveLength(0);
    const chat = (await mai.agent.get(`/api/hobby/dms/${ann.id}`)).body;
    expect(JSON.stringify(chat)).not.toContain("rude");
    expect(JSON.stringify(chat)).toContain("a friendly one");
  });

  it("banner, storage, scores, health and cleanup", async () => {
    const boss = await admin();
    expect((await request(app).get("/api/banner")).body.text).toBeNull();
    await boss.agent.put("/api/admin/banner").send({ text: "Nook restarts at 9 pm" });
    expect((await request(app).get("/api/banner")).body.text).toBe("Nook restarts at 9 pm");
    await boss.agent.put("/api/admin/banner").send({ text: "" });
    expect((await request(app).get("/api/banner")).body.text).toBeNull();

    const storage = (await boss.agent.get("/api/admin/storage")).body;
    expect(storage).toMatchObject({ songs: { bytes: expect.any(Number) }, pictures: { files: expect.any(Number) } });

    await boss.agent.post("/api/scores").send({ game: "snake", score: 999999 });
    const scores = (await boss.agent.get("/api/admin/scores")).body;
    if (scores.length) expect((await boss.agent.delete(`/api/admin/scores/${scores[0].id}`)).status).toBe(204);

    const health = (await boss.agent.get("/api/admin/health")).body;
    expect(health).toMatchObject({ database: "working", valkey: "working" });
    expect(["working", "not reachable"]).toContain(health.gameServer);
    expect(["working", "not reachable", "off", "getting ready"]).toContain(health.ai);
    expect((await boss.agent.post("/api/admin/cleanup")).status).toBe(200);
  });
});
