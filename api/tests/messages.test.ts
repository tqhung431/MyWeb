// Stage 21: private chats, pictures in chats, members-only writing and unread counts.

import { existsSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { imagePath, inspectImage } from "../src/hobby/images.js";
import { cleanup } from "../src/jobs/cleanup.js";
import { slugify } from "../src/routes/hobby.js";
import { closeAll, ORIGIN, resetDatabase, SITE_HOST } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

// A real 2×1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwnwEJAAA6/QL+3x/iMwAAAABJRU5ErkJggg==", "base64");

async function person(name: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/me").send({ name });
  return { agent, id: res.body.user.id as string };
}

const upload = (agent: ReturnType<typeof request.agent>, buf: Buffer, name = "photo.png") =>
  agent.post("/api/hobby/images").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).attach("file", buf, name);

describe("private chats", () => {
  it("only the two people see a chat, newest last, with unread counts", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    const an = await person("An");

    const sent = await linh.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "hi Mai!" });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ body: "hi Mai!", mine: true, readAt: null, image: null });
    await mai.agent.post(`/api/hobby/dms/${linh.id}`).send({ body: "hey 👋" });
    await linh.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "pho tonight?" });

    const chat = await mai.agent.get(`/api/hobby/dms/${linh.id}`);
    expect(chat.body.person).toEqual({ id: linh.id, name: "Linh" });
    expect(chat.body.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([
      ["hi Mai!", false],
      ["hey 👋", true],
      ["pho tonight?", false],
    ]);

    // An isn't in it: their own chat with Linh is empty
    expect((await an.agent.get(`/api/hobby/dms/${linh.id}`)).body.messages).toEqual([]);
    expect((await an.agent.get("/api/hobby/dms")).body).toEqual([]);

    expect((await mai.agent.get("/api/hobby/unread")).body).toEqual({ messages: 2, groups: 0 });
    const list = (await mai.agent.get("/api/hobby/dms")).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: linh.id, name: "Linh", lastBody: "pho tonight?", lastMine: false, unread: 2 });

    expect((await mai.agent.put(`/api/hobby/dms/${linh.id}/read`)).status).toBe(204);
    expect((await mai.agent.get("/api/hobby/unread")).body.messages).toBe(0);
    const seen = (await linh.agent.get(`/api/hobby/dms/${mai.id}`)).body.messages;
    expect(seen[0].readAt).not.toBeNull(); // Linh sees "Seen"
  });

  it("needs a name, a real person, and not yourself", async () => {
    const linh = await person("Linh");
    expect((await request(app).get("/api/hobby/dms")).status).toBe(401);
    expect((await request(app).get("/api/hobby/unread")).body).toEqual({ messages: 0, groups: 0 }); // guests: no badge
    expect((await linh.agent.post(`/api/hobby/dms/${linh.id}`).send({ body: "me" })).status).toBe(400);
    expect((await linh.agent.post("/api/hobby/dms/00000000-0000-4000-8000-000000000000").send({ body: "?" })).status).toBe(404);
    expect((await linh.agent.post("/api/hobby/dms/not-a-uuid").send({ body: "?" })).status).toBe(404);
  });

  it("only the sender deletes a message; the other person sees only that it was deleted (Stage 28)", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    const an = await person("An");
    const m = await linh.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "oops" });
    expect((await an.agent.delete(`/api/hobby/dms/messages/${m.body.id}`)).status).toBe(404); // not theirs to know about
    expect((await mai.agent.delete(`/api/hobby/dms/messages/${m.body.id}`)).status).toBe(403);
    expect((await linh.agent.delete(`/api/hobby/dms/messages/${m.body.id}`)).status).toBe(204);
    const [left] = (await mai.agent.get(`/api/hobby/dms/${linh.id}`)).body.messages;
    expect(left).toMatchObject({ id: m.body.id, body: "", image: null, deletedBy: "author" });
  });

  it("finds people by name to start a chat with (not yourself)", async () => {
    const linh = await person("Linh");
    await person("Mai");
    await person("Mai Anh");
    const found = (await linh.agent.get("/api/hobby/people?q=mai")).body.map((p: { name: string }) => p.name).sort();
    expect(found).toEqual(["Mai", "Mai Anh"]);
    expect((await linh.agent.get("/api/hobby/people")).body.map((p: { name: string }) => p.name)).not.toContain("Linh");
  });
});

describe("pictures", () => {
  it("reads the type and size from the file itself", () => {
    expect(inspectImage(PNG)).toEqual({ type: "image/png", width: 2, height: 1 });
    expect(inspectImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(inspectImage(Buffer.from("GIF89a\x0a\x00\x05\x00" + "\0".repeat(20), "latin1"))).toEqual({ type: "image/gif", width: 10, height: 5 });
  });

  it("sends a picture in a private chat; only the two people can open it", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    const an = await person("An");

    const up = await upload(linh.agent, PNG);
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ width: 2, height: 1, url: `/api/hobby/images/${up.body.id}` });

    const sent = await linh.agent.post(`/api/hobby/dms/${mai.id}`).send({ imageId: up.body.id });
    expect(sent.status).toBe(201);
    expect(sent.body.image.id).toBe(up.body.id);

    const pic = await mai.agent.get(up.body.url);
    expect(pic.status).toBe(200);
    expect(pic.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(pic.body, PNG)).toBe(0);
    expect((await an.agent.get(up.body.url)).status).toBe(404);
    expect((await request(app).get(up.body.url)).status).toBe(404);

    // An can't send Linh's picture as their own
    expect((await an.agent.post(`/api/hobby/dms/${mai.id}`).send({ imageId: up.body.id })).status).toBe(400);

    // Deleting the message deletes the picture and its file
    expect(existsSync(imagePath(up.body.id, "image/png"))).toBe(true);
    await linh.agent.delete(`/api/hobby/dms/messages/${sent.body.id}`);
    expect((await linh.agent.get(up.body.url)).status).toBe(404);
    expect(existsSync(imagePath(up.body.id, "image/png"))).toBe(false);
  });

  it("group chat pictures are for the group's members, like the chat (Stage 29)", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    await linh.agent.put("/api/hobby/groups/cooking/membership");
    const up = await upload(linh.agent, PNG);
    const sent = await linh.agent.post("/api/hobby/groups/cooking/messages").send({ body: "my pho", imageId: up.body.id });
    expect(sent.status).toBe(201);
    expect((await request(app).get("/api/hobby/groups/cooking/messages")).status).toBe(403);
    expect((await mai.agent.get(up.body.url)).status).toBe(404); // not a member
    await mai.agent.put("/api/hobby/groups/cooking/membership");
    const history = await mai.agent.get("/api/hobby/groups/cooking/messages");
    expect(history.body.messages[0]).toMatchObject({ body: "my pho", image: { id: up.body.id, width: 2, height: 1 } });
    expect((await mai.agent.get(up.body.url)).status).toBe(200);
    // leaving: the pictures go too
    await mai.agent.delete("/api/hobby/groups/cooking/membership");
    expect((await mai.agent.get(up.body.url)).status).toBe(404);
  });

  it("refuses files that aren't pictures, and uploads from other sites", async () => {
    const linh = await person("Linh");
    expect((await upload(linh.agent, Buffer.from("<svg onload=alert(1)></svg>"), "x.svg")).status).toBe(415);
    expect((await upload(linh.agent, Buffer.from("just text, not a picture at all"), "x.png")).status).toBe(415);
    const evil = await linh.agent
      .post("/api/hobby/images")
      .set("Origin", "https://evil.example")
      .set("X-Forwarded-Host", SITE_HOST)
      .attach("file", PNG, "a.png");
    expect(evil.status).toBe(403);
    expect((await request(app).post("/api/hobby/images").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).attach("file", PNG, "a.png")).status).toBe(
      401,
    );
  });

  it("cleanup deletes pictures no message shows, and private chats after 30 days", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    const unsent = await upload(linh.agent, PNG);
    const kept = await upload(linh.agent, PNG);
    await linh.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "look", imageId: kept.body.id });
    await linh.agent.post(`/api/hobby/dms/${mai.id}`).send({ body: "old" });
    await pool.query("update chat_images set created_at = now() - interval '2 hours'");
    await pool.query("update direct_messages set created_at = now() - interval '31 days' where body = 'old'");

    const result = await cleanup();
    expect(result).toMatchObject({ chatMessages: 1, chatImages: 1 });
    expect(existsSync(imagePath(unsent.body.id, "image/png"))).toBe(false);
    expect(existsSync(imagePath(kept.body.id, "image/png"))).toBe(true);
    expect((await pool.query("select body from direct_messages")).rows).toEqual([{ body: "look" }]);
  });
});

describe("joining a group (Stage 21)", () => {
  it("only members read, post, comment, like and chat; leaving hides it all (Stage 29)", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    expect((await linh.agent.post("/api/hobby/groups/books/posts").send({ body: "hi" })).status).toBe(403);
    expect((await linh.agent.post("/api/hobby/groups/books/messages").send({ body: "hi" })).status).toBe(403);
    await linh.agent.put("/api/hobby/groups/books/membership");
    const post = await linh.agent.post("/api/hobby/groups/books/posts").send({ body: "Reading Dune" });
    expect(post.status).toBe(201);
    expect((await mai.agent.post(`/api/hobby/posts/${post.body.id}/comments`).send({ body: "nice" })).status).toBe(403);
    expect((await mai.agent.put(`/api/hobby/posts/${post.body.id}/like`)).status).toBe(403);
    expect((await mai.agent.get("/api/hobby/groups/books/posts")).status).toBe(403);
    expect((await request(app).get("/api/hobby/groups/books/posts")).status).toBe(403);
    // what a non-member sees of the group: its name and how many are in it, not who
    const outside = (await mai.agent.get("/api/hobby/groups/books")).body;
    expect(outside).toMatchObject({ slug: "books", joined: false, canRead: false, memberCount: 1, members: [] });
    // joining opens it; leaving closes it again
    await mai.agent.put("/api/hobby/groups/books/membership");
    expect((await mai.agent.get("/api/hobby/groups/books/posts")).body.posts).toHaveLength(1);
    expect((await mai.agent.get("/api/hobby/groups/books")).body).toMatchObject({ canRead: true, memberCount: 2 });
    await mai.agent.delete("/api/hobby/groups/books/membership");
    expect((await mai.agent.get("/api/hobby/groups/books/posts")).status).toBe(403);
    expect((await mai.agent.get(`/api/hobby/posts/${post.body.id}/comments`)).status).toBe(403);
    expect((await mai.agent.get("/api/hobby/groups/books/messages")).status).toBe(403);
  });

  it("counts what's new since you last looked, for members only", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    await linh.agent.put("/api/hobby/groups/gaming/membership");
    await mai.agent.put("/api/hobby/groups/gaming/membership");
    await mai.agent.post("/api/hobby/groups/gaming/messages").send({ body: "gg" });
    await mai.agent.post("/api/hobby/groups/gaming/posts").send({ body: "Tournament Friday" });
    await linh.agent.post("/api/hobby/groups/gaming/messages").send({ body: "count me in" }); // your own don't count

    const gaming = (await linh.agent.get("/api/hobby/groups")).body.find((g: { slug: string }) => g.slug === "gaming");
    expect(gaming).toMatchObject({ joined: true, unread: 2 });
    expect((await linh.agent.get("/api/hobby/unread")).body).toEqual({ messages: 0, groups: 2 });
    expect((await mai.agent.get("/api/hobby/unread")).body.groups).toBe(1);

    expect((await linh.agent.put("/api/hobby/groups/gaming/read")).status).toBe(204);
    expect((await linh.agent.get("/api/hobby/unread")).body.groups).toBe(0);

    // Leaving: nothing counts any more
    await mai.agent.delete("/api/hobby/groups/gaming/membership");
    expect((await mai.agent.get("/api/hobby/unread")).body.groups).toBe(0);
  });

  it("never gives a group the address of Hobby Hub's own pages", () => {
    expect(slugify("Messages")).toBe("messages-group");
    expect(slugify("Message board")).toBe("message-board");
  });
});
