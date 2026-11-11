// Music: adding songs (checked with a FAKE SoundCloud / YouTube), charts, plays, likes.
// Also Stage 7 bits: timer preferences, real IPs and Secure cookies behind a trusted proxy.

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { parseLink } from "../src/music/links.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
let fake: Server;

// The fake platform: knows a few songs, one of which doesn't allow embedding.
beforeAll(async () => {
  const f = express();
  f.get("/soundcloud/oembed", (req, res) => {
    const url = String(req.query.url);
    if (url.endsWith("/private-song")) return void res.status(403).end();
    if (!url.startsWith("https://soundcloud.com/some-artist/")) return void res.status(404).end();
    const slug = url.split("/").pop();
    res.json({
      title: `Song ${slug} by Some Artist`,
      author_name: "Some Artist",
      thumbnail_url: "https://i1.sndcdn.com/artworks-x.jpg",
      html: `<iframe width="100%" height="400" src="https://w.soundcloud.com/player/?visual=true&amp;url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F123&amp;show_artwork=true"></iframe>`,
    });
  });
  f.get("/youtube/oembed", (_req, res) => {
    res.json({ title: "Official MV", author_name: "Artist Channel", thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg" });
  });
  await new Promise<void>((r) => {
    fake = f.listen(4998, "127.0.0.1", () => r());
  });
});
afterAll(async () => {
  await new Promise<void>((r) => fake.close(() => r()));
  await closeAll();
});
beforeEach(resetDatabase);

const guest = () => randomUUID();
const add = (client: string, url: string, genre = "drill") =>
  request(app).post("/api/songs").set("X-Client-Id", client).send({ url, genre });

describe("recognising links", () => {
  it("cleans SoundCloud and YouTube links", () => {
    expect(parseLink("https://soundcloud.com/some-artist/my-song?si=abc&utm_source=x")).toEqual({
      provider: "soundcloud",
      url: "https://soundcloud.com/some-artist/my-song",
    });
    expect(parseLink("https://youtu.be/dQw4w9WgXcQ?t=42").url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(parseLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=x").url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("refuses other sites and profile pages", () => {
    expect(() => parseLink("https://example.com/song.mp3")).toThrow(/Only SoundCloud and YouTube/);
    expect(() => parseLink("https://soundcloud.com/some-artist")).toThrow(/not a profile/);
    expect(() => parseLink("javascript:alert(1)")).toThrow();
  });
});

describe("adding songs", () => {
  it("adds a SoundCloud song with details from the platform, and only SoundCloud's own player", async () => {
    const res = await add(guest(), "https://soundcloud.com/some-artist/dem-sai-gon?si=123");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      provider: "soundcloud",
      url: "https://soundcloud.com/some-artist/dem-sai-gon",
      title: "Song dem-sai-gon", // " by Some Artist" removed
      artist: "Some Artist",
      genre: "drill",
    });
    const player = new URL(res.body.embedUrl);
    expect(player.hostname).toBe("w.soundcloud.com");
    expect(player.searchParams.get("visual")).toBe("false");
  });

  it("adds a YouTube video with the privacy-enhanced player", async () => {
    const res = await add(guest(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "pop");
    expect(res.status).toBe(201);
    expect(res.body.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  });

  it("explains what went wrong", async () => {
    expect((await add(guest(), "https://soundcloud.com/nobody/nothing")).status).toBe(404);
    const blocked = await add(guest(), "https://soundcloud.com/some-artist/private-song");
    expect(blocked.status).toBe(422);
    expect(blocked.body.error).toMatch(/doesn't allow/);
    expect((await add(guest(), "https://example.com/x.mp3")).status).toBe(400);
    expect((await request(app).post("/api/songs").set("X-Client-Id", guest()).send({ url: "https://soundcloud.com/some-artist/a", genre: "jazz" })).status).toBe(400);
  });

  it("doesn't add the same song twice", async () => {
    await add(guest(), "https://soundcloud.com/some-artist/same");
    const again = await add(guest(), "https://soundcloud.com/some-artist/same?utm_source=share");
    expect(again.status).toBe(409);
    expect(again.body.song.title).toBe("Song same");
  });
});

describe("charts", () => {
  it("ranks by plays + 3 × likes, filters by genre, and knows what I liked", async () => {
    const a = (await add(guest(), "https://soundcloud.com/some-artist/a", "drill")).body;
    const b = (await add(guest(), "https://soundcloud.com/some-artist/b", "drill")).body;
    const c = (await add(guest(), "https://soundcloud.com/some-artist/c", "lofi")).body;

    // A: 4 different listeners play it. B: 2 likes (= 6 points). C: lofi.
    for (let i = 0; i < 4; i++) await request(app).post(`/api/songs/${a.id}/play`).set("X-Client-Id", guest());
    const me = guest();
    await request(app).put(`/api/songs/${b.id}/like`).set("X-Client-Id", me);
    await request(app).put(`/api/songs/${b.id}/like`).set("X-Client-Id", guest());
    await request(app).post(`/api/songs/${c.id}/play`).set("X-Client-Id", guest());

    const week = (await request(app).get("/api/songs?period=week&genre=drill").set("X-Client-Id", me)).body;
    expect(week.map((s: { title: string }) => s.title)).toEqual(["Song b", "Song a"]);
    expect(week[0]).toMatchObject({ likes: 2, score: 6, liked: true });
    expect(week[1]).toMatchObject({ plays: 4, score: 4, liked: false });

    const lofi = (await request(app).get("/api/songs?genre=lofi")).body;
    expect(lofi.map((s: { title: string }) => s.title)).toEqual(["Song c"]);
  });

  it("only counts this week's plays in 'week', but all of them in 'all'", async () => {
    const a = (await add(guest(), "https://soundcloud.com/some-artist/old")).body;
    await pool.query("insert into song_plays (song_id, owner, played_at) values ($1, 'client:x', now() - interval '20 days')", [a.id]);
    expect((await request(app).get("/api/songs?period=week")).body[0].plays).toBe(0);
    expect((await request(app).get("/api/songs?period=month")).body[0].plays).toBe(1);
    expect((await request(app).get("/api/songs?period=all")).body[0].plays).toBe(1);
  });

  it("counts one play per person per song per 10 minutes", async () => {
    const a = (await add(guest(), "https://soundcloud.com/some-artist/repeat")).body;
    const me = guest();
    expect((await request(app).post(`/api/songs/${a.id}/play`).set("X-Client-Id", me)).body).toEqual({ counted: true });
    expect((await request(app).post(`/api/songs/${a.id}/play`).set("X-Client-Id", me)).body).toEqual({ counted: false });
  });

  it("likes and unlikes", async () => {
    const a = (await add(guest(), "https://soundcloud.com/some-artist/love")).body;
    const me = guest();
    expect((await request(app).put(`/api/songs/${a.id}/like`).set("X-Client-Id", me)).body).toEqual({ liked: true, likes: 1 });
    expect((await request(app).put(`/api/songs/${a.id}/like`).set("X-Client-Id", me)).body).toEqual({ liked: true, likes: 1 }); // no double like
    expect((await request(app).delete(`/api/songs/${a.id}/like`).set("X-Client-Id", me)).body).toEqual({ liked: false, likes: 0 });
  });
});

describe("timer preferences (signed in)", () => {
  it("saves timer lengths to the account and checks them", async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send({ name: "Linh", email: "linh@example.com", password: "quiet library hours" });
    const saved = await browser.put("/api/me/preferences").send({ timer: { focus: 50, short: 10, long: 30 } });
    expect(saved.body.user.preferences).toEqual({ timer: { focus: 50, short: 10, long: 30 } });
    expect((await browser.get("/api/auth/me")).body.user.preferences.timer.focus).toBe(50); // not a stale cached copy
    expect((await browser.put("/api/me/preferences").send({ timer: { focus: 500, short: 0, long: 30 } })).status).toBe(400);
    expect((await request(app).put("/api/me/preferences").send({ timer: { focus: 50, short: 10, long: 30 } })).status).toBe(401);
  });
});
