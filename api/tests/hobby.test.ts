// Stage 11: Hobby Hub groups, posts, comments, likes and chat (REST). Live delivery: realtime.test.ts.

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { slugify } from "../src/routes/hobby.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

async function person(name: string, ...groups: string[]) {
  const agent = request.agent(app);
  await agent.post("/api/me").send({ name });
  for (const g of groups) await agent.put(`/api/hobby/groups/${g}/membership`); // Stage 21: members write
  return agent;
}

describe("groups", () => {
  it("starts with six starter groups that anyone can read", async () => {
    const res = await request(app).get("/api/hobby/groups");
    expect(res.status).toBe(200);
    expect(res.body.map((g: { slug: string }) => g.slug)).toEqual(["gaming", "cooking", "music", "books", "movies-anime", "sports"]);
    expect(res.body[0]).toMatchObject({ name: "Gaming", emoji: "🎮", members: 0, posts: 0, joined: false });
  });

  it("lets people with a name start, join, leave and delete a group", async () => {
    const linh = await person("Linh");
    const created = await linh.post("/api/hobby/groups").send({ name: "Board Games", emoji: "🎲", description: "Catan nights" });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe("board-games");

    const mai = await person("Mai");
    await mai.put("/api/hobby/groups/board-games/membership");
    const group = await mai.get("/api/hobby/groups/board-games");
    expect(group.body.members.map((m: { name: string }) => m.name)).toEqual(["Linh", "Mai"]);
    expect(group.body).toMatchObject({ joined: true, mine: false });

    await mai.delete("/api/hobby/groups/board-games/membership");
    expect((await mai.get("/api/hobby/groups/board-games")).body.joined).toBe(false);

    expect((await mai.delete("/api/hobby/groups/board-games")).status).toBe(403); // not hers
    expect((await linh.delete("/api/hobby/groups/board-games")).status).toBe(204);
    expect((await request(app).get("/api/hobby/groups/board-games")).status).toBe(404);
  });

  it("needs a name to write, and refuses duplicates and bad input", async () => {
    expect((await request(app).post("/api/hobby/groups").send({ name: "X", emoji: "🎲" })).status).toBe(401);
    const linh = await person("Linh");
    expect((await linh.post("/api/hobby/groups").send({ name: "gaming", emoji: "🎮" })).status).toBe(409);
    expect((await linh.post("/api/hobby/groups").send({ name: "", emoji: "🎮" })).status).toBe(400);
    expect((await linh.post("/api/hobby/groups").send({ name: "Chess", emoji: "abc" })).status).toBe(400);
  });

  it("makes readable, unique addresses from any name", () => {
    expect(slugify("Nấu ăn ngon")).toBe("nau-an-ngon");
    expect(slugify("Đọc sách")).toBe("doc-sach");
    expect(slugify("🎲🎲")).toBe("group");
  });
});

describe("posts", () => {
  it("posts, likes and comments, newest post first", async () => {
    const linh = await person("Linh", "cooking");
    const mai = await person("Mai", "cooking");
    const first = await linh.post("/api/hobby/groups/cooking/posts").send({ body: "Pho recipe?" });
    expect(first.status).toBe(201);
    await mai.post("/api/hobby/groups/cooking/posts").send({ body: "Made bánh mì today 🥖" });

    await mai.put(`/api/hobby/posts/${first.body.id}/like`);
    const liked = await linh.put(`/api/hobby/posts/${first.body.id}/like`);
    expect(liked.body).toEqual({ liked: true, likes: 2 });
    await mai.post(`/api/hobby/posts/${first.body.id}/comments`).send({ body: "Star anise is the secret" });

    const board = await linh.get("/api/hobby/groups/cooking/posts");
    expect(board.body.posts.map((p: { body: string }) => p.body)).toEqual(["Made bánh mì today 🥖", "Pho recipe?"]);
    expect(board.body.posts[1]).toMatchObject({ author: { name: "Linh" }, likes: 2, liked: true, comments: 1, mine: true });
    const groups = (await linh.get("/api/hobby/groups")).body;
    const cooking = groups.find((g: { slug: string }) => g.slug === "cooking");
    expect(cooking).toMatchObject({ posts: 2, members: 2, joined: true });
    expect(cooking.lastActivity).not.toBeNull();
    expect(groups.find((g: { slug: string }) => g.slug === "gaming")).toMatchObject({ posts: 0, members: 0, joined: false, lastActivity: null });
    expect((await request(app).get(`/api/hobby/posts/${first.body.id}/comments`)).status).toBe(403); // Stage 29: members only
    const comments = await linh.get(`/api/hobby/posts/${first.body.id}/comments`);
    expect(comments.body[0]).toMatchObject({ body: "Star anise is the secret", author: { name: "Mai" } });
  });

  it("only lets authors delete their own posts and comments", async () => {
    const linh = await person("Linh", "cooking");
    const mai = await person("Mai", "cooking");
    const post = await linh.post("/api/hobby/groups/cooking/posts").send({ body: "Hello" });
    const comment = await mai.post(`/api/hobby/posts/${post.body.id}/comments`).send({ body: "Hi!" });
    expect((await linh.delete(`/api/hobby/comments/${comment.body.id}`)).status).toBe(403);
    expect((await mai.delete(`/api/hobby/posts/${post.body.id}`)).status).toBe(403);
    expect((await mai.delete(`/api/hobby/comments/${comment.body.id}`)).status).toBe(204);
    expect((await linh.delete(`/api/hobby/posts/${post.body.id}`)).status).toBe(204);
  });

  it("pages the board 20 at a time", async () => {
    const linh = await person("Linh", "books");
    // straight into the database: the API allows only 10 posts per 10 minutes per person
    await pool.query(`insert into posts (group_id, author_id, body)
      select g.id, u.id, 'Book ' || i from hobby_groups g, users u, generate_series(1, 22) i where g.slug = 'books' order by i`);
    const page1 = await linh.get("/api/hobby/groups/books/posts");
    expect(page1.body.posts).toHaveLength(20);
    expect(page1.body.more).toBe(true);
    const page2 = await linh.get(`/api/hobby/groups/books/posts?before=${page1.body.posts[19].id}`);
    expect(page2.body.posts.map((p: { body: string }) => p.body)).toEqual(["Book 2", "Book 1"]);
    expect(page2.body.more).toBe(false);
  });

  it("slows down floods: 10 posts per 10 minutes", async () => {
    const linh = await person("Linh", "books");
    for (let i = 0; i < 10; i++) await linh.post("/api/hobby/groups/books/posts").send({ body: `Book ${i}` });
    expect((await linh.post("/api/hobby/groups/books/posts").send({ body: "one more" })).status).toBe(429);
  });

  it("keeps text as text and refuses empty or huge posts", async () => {
    const linh = await person("Linh", "music");
    const res = await linh.post("/api/hobby/groups/music/posts").send({ body: "<script>alert(1)</script>" });
    expect(res.body.body).toBe("<script>alert(1)</script>"); // stored as typed; the website shows it as text, never as HTML
    expect((await linh.post("/api/hobby/groups/music/posts").send({ body: "   " })).status).toBe(400);
    expect((await linh.post("/api/hobby/groups/music/posts").send({ body: "x".repeat(4001) })).status).toBe(400);
  });
});

describe("chat", () => {
  it("keeps the history, oldest first, and only authors delete messages", async () => {
    const linh = await person("Linh", "gaming");
    const mai = await person("Mai", "gaming");
    await linh.post("/api/hobby/groups/gaming/messages").send({ body: "anyone up for a match?" });
    const reply = await mai.post("/api/hobby/groups/gaming/messages").send({ body: "me! 🎮" });
    expect(reply.status).toBe(201);

    const history = await linh.get("/api/hobby/groups/gaming/messages");
    expect(history.body.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine])).toEqual([
      ["anyone up for a match?", true],
      ["me! 🎮", false],
    ]);
    expect((await linh.delete(`/api/hobby/messages/${reply.body.id}`)).status).toBe(403);
    expect((await mai.delete(`/api/hobby/messages/${reply.body.id}`)).status).toBe(204);
  });

  it("slows down floods: 20 messages per 30 seconds", async () => {
    const linh = await person("Linh", "gaming");
    for (let i = 0; i < 20; i++) expect((await linh.post("/api/hobby/groups/gaming/messages").send({ body: `${i}` })).status).toBe(201);
    expect((await linh.post("/api/hobby/groups/gaming/messages").send({ body: "one more" })).status).toBe(429);
  });
});
