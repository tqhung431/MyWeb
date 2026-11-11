// Music (Stage 8): songs are files Nook stores and streams itself.
// Uses tiny test songs in tests/fixtures (2 seconds of tone, made with ffmpeg).

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { mediaDir } from "../src/music/files.js";
import { detectGenre } from "../src/music/genre.js";
import { closeAll, ORIGIN, resetDatabase, SITE_HOST } from "./helpers.js";

const app = createApp();
const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

beforeEach(resetDatabase);
afterAll(closeAll);

// Upload like the browser does: a form from Nook's own page.
function upload(file: string, opts: { client?: string; as?: string; fields?: Record<string, string> } = {}) {
  const req = request(app)
    .post("/api/songs")
    .set("Origin", ORIGIN)
    .set("X-Forwarded-Host", SITE_HOST)
    .set("X-Client-Id", opts.client ?? randomUUID());
  const fields = { rights: "yes", license: "Own work", ...opts.fields };
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  return req.attach("file", fixture(file), opts.as ? { filename: opts.as } : undefined);
}

describe("detecting the genre", () => {
  it("uses the file's genre tag first, then words in the title", () => {
    expect(detectGenre({ tags: ["Hip-Hop"] })).toBe("drill");
    expect(detectGenre({ tags: ["Chillout"] })).toBe("lofi");
    expect(detectGenre({ tags: ["Dance"] })).toBe("remix");
    expect(detectGenre({ title: "Đêm Nay (Vinahouse Remix)" })).toBe("remix");
    expect(detectGenre({ title: "Em Ơi (Lofi Ver.) slowed + reverb" })).toBe("lofi");
    expect(detectGenre({ title: "Drill Sài Gòn" })).toBe("drill");
    expect(detectGenre({ title: "Một Bài Hát" })).toBe("pop"); // no clue → pop
  });
});

describe("uploading", () => {
  it("reads title, artist, genre, length and cover from the file: no need to choose a genre", async () => {
    const res = await upload("tagged-hiphop.mp3");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Street Lights",
      artist: "Test Rapper",
      genre: "drill", // from the "Hip-Hop" tag
      detectedGenre: "drill",
      durationSec: 2,
      license: "Own work",
      audioUrl: `/api/songs/${res.body.id}/audio`,
      artworkUrl: `/api/songs/${res.body.id}/artwork`,
    });
    expect(res.body).not.toHaveProperty("fileName"); // where it's stored stays private
  });

  it("detects from the title, keeps Vietnamese text, and falls back to the file name", async () => {
    const remix = await upload("title-remix.mp3");
    expect(remix.body).toMatchObject({ title: "Đêm Nay (Vinahouse Remix)", artist: "DJ Thử", genre: "remix", artworkUrl: null });
    const plain = await upload("untagged-song.mp3");
    expect(plain.body).toMatchObject({ title: "untagged-song", artist: "Unknown artist", genre: "pop" });
  });

  it("lets you pick the genre yourself if you want", async () => {
    expect((await upload("tagged-hiphop.mp3", { fields: { genre: "lofi" } })).body.genre).toBe("lofi");
  });

  it("recognises starter-pack songs and fills in the credit and licence", async () => {
    const res = await upload("untagged-song.mp3", { as: "4nsic_-_Go_time (1).mp3", fields: { license: "whatever" } });
    expect(res.body).toMatchObject({
      title: "Go time",
      artist: "FORENSIC",
      genre: "drill",
      license: "CC BY-NC 3.0",
      licenseUrl: "http://creativecommons.org/licenses/by-nc/3.0/",
      credit: "feat. Sol, speak ez",
      sourceUrl: "https://ccmixter.org/files/4nsic/28500",
      starterPack: true,
    });
  });

  it("refuses files that aren't music, duplicates, and uploads without the rights checkbox", async () => {
    expect((await upload("not-audio.mp3")).status).toBe(415);
    await upload("tagged-hiphop.mp3");
    const again = await upload("tagged-hiphop.mp3", { as: "renamed.mp3" });
    expect(again.status).toBe(409); // same file, even with another name
    expect(again.body.error).toMatch(/Street Lights/);
    expect((await upload("untagged-song.mp3", { fields: { rights: "no" } })).status).toBe(400);
  });

  it("refuses uploads from other websites, or with no Origin at all", async () => {
    const evil = await request(app).post("/api/songs").set("Origin", "https://evil.example").set("X-Client-Id", randomUUID())
      .field("rights", "yes").field("license", "x").attach("file", fixture("untagged-song.mp3"));
    expect(evil.status).toBe(403);
    const noOrigin = await request(app).post("/api/songs").set("X-Client-Id", randomUUID())
      .field("rights", "yes").field("license", "x").attach("file", fixture("untagged-song.mp3"));
    expect(noOrigin.status).toBe(403);
  });
});

describe("playing the file", () => {
  it("streams the song, supports seeking, and serves the cover", async () => {
    const { body: song } = await upload("tagged-hiphop.mp3");
    const full = await request(app).get(song.audioUrl);
    expect(full.status).toBe(200);
    expect(full.headers["content-type"]).toBe("audio/mpeg");
    expect(full.headers["cache-control"]).toMatch(/immutable/);

    const part = await request(app).get(song.audioUrl).set("Range", "bytes=0-99"); // jump around in the song
    expect(part.status).toBe(206);
    expect(part.headers["content-range"]).toMatch(/^bytes 0-99\//);

    const cover = await request(app).get(song.artworkUrl);
    expect(cover.headers["content-type"]).toBe("image/png");
  });
});

describe("fixing or removing a song", () => {
  it("only the person who added it can change or delete it, and deleting removes the files", async () => {
    const me = randomUUID();
    const { body: song } = await upload("tagged-hiphop.mp3", { client: me });

    const other = await request(app).patch(`/api/songs/${song.id}`).set("X-Client-Id", randomUUID()).send({ genre: "pop" });
    expect(other.status).toBe(403);
    const fixed = await request(app).patch(`/api/songs/${song.id}`).set("X-Client-Id", me).send({ genre: "pop" });
    expect(fixed.body.genre).toBe("pop");

    expect((await readdir(mediaDir)).length).toBe(2); // song + cover
    expect((await request(app).delete(`/api/songs/${song.id}`).set("X-Client-Id", me)).status).toBe(204);
    expect(existsSync(mediaDir) ? await readdir(mediaDir) : []).toEqual([]);
  });
});

describe("charts", () => {
  it("ranks by plays + 3 × likes, filters by genre, and knows what I liked and added", async () => {
    const me = randomUUID();
    const drill = (await upload("tagged-hiphop.mp3", { client: me })).body;
    const remix = (await upload("title-remix.mp3")).body;
    const pop = (await upload("untagged-song.mp3")).body;

    for (let i = 0; i < 4; i++) await request(app).post(`/api/songs/${pop.id}/play`).set("X-Client-Id", randomUUID());
    await request(app).put(`/api/songs/${remix.id}/like`).set("X-Client-Id", me);
    await request(app).put(`/api/songs/${remix.id}/like`).set("X-Client-Id", randomUUID());
    await request(app).post(`/api/songs/${drill.id}/play`).set("X-Client-Id", randomUUID());

    const week = (await request(app).get("/api/songs?period=week").set("X-Client-Id", me)).body;
    expect(week.map((s: { title: string }) => s.title)).toEqual(["Đêm Nay (Vinahouse Remix)", "untagged-song", "Street Lights"]);
    expect(week[0]).toMatchObject({ likes: 2, score: 6, liked: true, mine: false });
    expect(week[2]).toMatchObject({ plays: 1, mine: true });
    expect((await request(app).get("/api/songs?genre=drill")).body.map((s: { id: number }) => s.id)).toEqual([drill.id]);
  });

  it("counts week, month and all time separately, and one play per person per 10 minutes", async () => {
    const song = (await upload("tagged-hiphop.mp3")).body;
    await pool.query("insert into song_plays (song_id, owner, played_at) values ($1, 'client:x', now() - interval '20 days')", [song.id]);
    expect((await request(app).get("/api/songs?period=week")).body[0].plays).toBe(0);
    expect((await request(app).get("/api/songs?period=month")).body[0].plays).toBe(1);
    const me = randomUUID();
    expect((await request(app).post(`/api/songs/${song.id}/play`).set("X-Client-Id", me)).body).toEqual({ counted: true });
    expect((await request(app).post(`/api/songs/${song.id}/play`).set("X-Client-Id", me)).body).toEqual({ counted: false });
  });
});

describe("timer preferences (signed in)", () => {
  it("saves timer lengths to the account and checks them", async () => {
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send({ name: "Linh", email: "linh@example.com", password: "quiet library hours" });
    const saved = await browser.put("/api/me/preferences").send({ timer: { focus: 50, short: 10, long: 30 } });
    expect(saved.body.user.preferences).toEqual({ timer: { focus: 50, short: 10, long: 30 } });
    expect((await browser.get("/api/auth/me")).body.user.preferences.timer.focus).toBe(50);
    expect((await browser.put("/api/me/preferences").send({ timer: { focus: 500, short: 0, long: 30 } })).status).toBe(400);
  });
});
