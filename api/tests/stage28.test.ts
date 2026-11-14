// Stage 28: chat and privacy. Deleting leaves "Message deleted" in place (words and picture gone for good),
// editing within 10 minutes, the feed shows only what people do together (milestones only when shared),
// and the admin's sign-in log.

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { recentActivity, type Activity } from "../src/realtime/emit.js";
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
// The feed is written just after the answer is sent: wait a moment for it
async function feed(until?: (lines: string[]) => boolean): Promise<string[]> {
  const fill = (a: Activity) => a.text.replace(/\{(\w+)\}/g, (_, k: string) => String(a.params?.[k] ?? ""));
  for (let i = 0; i < 20; i++) {
    const lines = (await recentActivity()).map(fill);
    if (!until || until(lines)) return lines;
    await new Promise((r) => setTimeout(r, 50));
  }
  return (await recentActivity()).map(fill);
}

describe("group chat: delete and edit", () => {
  it("a deleted message stays as 'Message deleted' for everyone; only the author can edit, for 10 minutes", async () => {
    const ann = await person("Ann");
    const bob = await person("Bob");
    await ann.agent.put("/api/hobby/groups/gaming/membership"); // a group Nook starts with
    await bob.agent.put("/api/hobby/groups/gaming/membership");
    const m = (await ann.agent.post("/api/hobby/groups/gaming/messages").send({ body: "helo all" })).body;

    // Bob can't edit or delete Ann's message
    expect((await bob.agent.patch(`/api/hobby/messages/${m.id}`).send({ body: "hacked" })).status).toBe(403);
    expect((await bob.agent.delete(`/api/hobby/messages/${m.id}`)).status).toBe(403);

    const edited = await ann.agent.patch(`/api/hobby/messages/${m.id}`).send({ body: "hello all" });
    expect(edited.status).toBe(200);
    expect(edited.body.editedAt).toBeTruthy();
    let list = (await bob.agent.get("/api/hobby/groups/gaming/messages")).body.messages;
    expect(list[0]).toMatchObject({ body: "hello all", deletedBy: null });
    expect(list[0].editedAt).toBeTruthy();

    // 11 minutes later: too late to edit
    await pool.query("update chat_messages set created_at = now() - interval '11 minutes'");
    expect((await ann.agent.patch(`/api/hobby/messages/${m.id}`).send({ body: "again" })).status).toBe(409);

    expect((await ann.agent.delete(`/api/hobby/messages/${m.id}`)).status).toBe(204);
    list = (await bob.agent.get("/api/hobby/groups/gaming/messages")).body.messages;
    expect(list).toHaveLength(1); // still in its place
    expect(list[0]).toMatchObject({ id: m.id, body: "", image: null, deletedBy: "author", editedAt: null });
    // the words are gone from the database, not just hidden
    expect((await pool.query("select body from chat_messages where id = $1", [m.id])).rows[0].body).toBe("");
    // can't edit a deleted message
    expect((await ann.agent.patch(`/api/hobby/messages/${m.id}`).send({ body: "back" })).status).toBe(404);
  });

  it("the admin's delete shows as removed by the admin", async () => {
    const ann = await person("Ann");
    await ann.agent.put("/api/hobby/groups/gaming/membership"); // a group Nook starts with
    const m = (await ann.agent.post("/api/hobby/groups/gaming/messages").send({ body: "spam spam" })).body;
    const boss = await admin();
    expect((await boss.agent.delete(`/api/hobby/messages/${m.id}`)).status).toBe(204);
    const [row] = (await ann.agent.get("/api/hobby/groups/gaming/messages")).body.messages;
    expect(row).toMatchObject({ body: "", deletedBy: "admin" });
  });
});

describe("private chat: delete and edit", () => {
  it("works like group chat; the chat list says the last message was deleted", async () => {
    const ann = await person("Ann");
    const bob = await person("Bob");
    const m = (await ann.agent.post(`/api/hobby/dms/${bob.id}`).send({ body: "secret" })).body;
    expect((await bob.agent.patch(`/api/hobby/dms/messages/${m.id}`).send({ body: "x" })).status).toBe(403);
    expect((await ann.agent.patch(`/api/hobby/dms/messages/${m.id}`).send({ body: "secret!" })).status).toBe(200);
    expect((await bob.agent.get(`/api/hobby/dms/${ann.id}`)).body.messages[0]).toMatchObject({ body: "secret!" });

    expect((await ann.agent.delete(`/api/hobby/dms/messages/${m.id}`)).status).toBe(204);
    const chat = (await bob.agent.get(`/api/hobby/dms/${ann.id}`)).body.messages;
    expect(chat[0]).toMatchObject({ id: m.id, body: "", deletedBy: "author" });
    const [convo] = (await bob.agent.get("/api/hobby/dms")).body;
    expect(convo).toMatchObject({ name: "Ann", lastDeleted: true, lastBody: "" });
  });

  it("a reported private message removed by the admin shows as removed by the admin", async () => {
    const ann = await person("Ann");
    const bob = await person("Bob");
    const m = (await ann.agent.post(`/api/hobby/dms/${bob.id}`).send({ body: "rude words" })).body;
    await bob.agent.post("/api/reports").send({ kind: "dm", id: m.id, reason: "rude" });
    const boss = await admin();
    const [report] = (await boss.agent.get("/api/admin/reports")).body;
    expect((await boss.agent.post(`/api/admin/reports/${report.id}`).send({ action: "delete" })).status).toBe(200);
    expect((await bob.agent.get(`/api/hobby/dms/${ann.id}`)).body.messages[0]).toMatchObject({ body: "", deletedBy: "admin" });
  });
});

describe("the live feed", () => {
  it("shows joining Nook; groups (Stage 29), focus sessions, watching and listening stay private", async () => {
    const ann = await person("Ann");
    await ann.agent.post("/api/sessions").send({ mode: "focus", minutes: 25 });
    await ann.agent.post("/api/hobby/groups").send({ name: "Pottery club", emoji: "🏺" });
    await ann.agent.post("/api/hobby/groups/pottery-club/posts").send({ body: "first pot!" });
    await new Promise((r) => setTimeout(r, 200));
    const lines = await feed();
    expect(lines).toEqual(["Ann joined Nook"]); // no "started the group", no "posted in", no focus session
  });

  it("lines that are private now leave the feed, even ones written before Stage 28", async () => {
    const { valkey } = await import("../src/valkey/client.js");
    const old = (icon: string, text: string) => JSON.stringify({ id: icon, icon, text, params: { name: "Old", n: 25, title: "X" }, at: new Date().toISOString() });
    await valkey.lpush(
      "activity:recent",
      old("Timer", "{name} finished a {n}-min focus session"),
      old("Clapperboard", "{name} is watching “{title}”"),
      old("Headphones", "{name} is listening to “{title}”"),
      old("BookOpen", "{name} finished reading “{title}”"),
      old("UserPlus", "{name} joined Nook"),
    );
    expect(await feed()).toEqual(["Old joined Nook"]);
  });

  it("milestones appear only for people who share them (Settings → Privacy)", async () => {
    const ann = await person("Ann");
    const book = (await ann.agent.post("/api/books").send({ title: "Dune" })).body;
    await ann.agent.patch(`/api/books/${book.id}`).send({ status: "finished" });
    await new Promise((r) => setTimeout(r, 200));
    expect((await feed()).join("\n")).not.toMatch(/finished reading/);

    const saved = await ann.agent.put("/api/me/preferences").send({ shareMilestones: true });
    expect(saved.body.user.preferences.shareMilestones).toBe(true);
    const next = (await ann.agent.post("/api/books").send({ title: "Emma" })).body;
    await ann.agent.patch(`/api/books/${next.id}`).send({ status: "finished" });
    expect(await feed((l) => l.some((x) => x.includes("Emma")))).toContain("Ann finished reading “Emma”");
  });
});

describe("the sign-in log", () => {
  it("records new names, PIN and code sign-ins with the device, only for the admin", async () => {
    const ann = await person("Ann");
    const phone = request.agent(app);
    await phone.post("/api/me/sign-in").set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1").send({ name: "Ann", pin: "2468" });
    const { code } = (await ann.agent.post("/api/me/codes")).body;
    await request.agent(app).post("/api/me/sign-in/code").send({ code });
    expect((await ann.agent.get("/api/admin/sign-ins")).status).toBe(403);

    const boss = await admin("Boss");
    const log = (await boss.agent.get("/api/admin/sign-ins")).body as { name: string; how: string; userAgent: string | null }[];
    expect(log.map((l) => `${l.name}: ${l.how}`)).toEqual(["Boss: new", "Ann: code", "Ann: pin", "Ann: new"]);
    expect(log[2].userAgent).toMatch(/iPhone/);
    expect(Object.keys(log[0]).sort()).toEqual(["at", "how", "id", "name", "userAgent"]); // nothing else
  });

  it("is cleaned up after 90 days, and goes with the person", async () => {
    const ann = await person("Ann");
    await person("Bob");
    await pool.query("update sign_ins set at = now() - interval '91 days' where name = 'Bob'");
    const { processJob } = await import("../src/jobs/handlers.js");
    await processJob("cleanup", {});
    expect((await pool.query("select name from sign_ins")).rows.map((r) => r.name)).toEqual(["Ann"]);
    await ann.agent.delete("/api/me").send({ confirm: "Ann" });
    expect((await pool.query("select count(*)::int as n from sign_ins")).rows[0].n).toBe(0);
  });
});
