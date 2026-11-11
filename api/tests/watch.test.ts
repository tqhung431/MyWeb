// Stage 12: WatchList, against a fake TVmaze and Jikan (tests/fake-watch.ts).

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { processJob } from "../src/jobs/handlers.js";
import { plainText } from "../src/watch/sources.js";
import { startFakeWatch, type FakeWatch } from "./fake-watch.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
let fake: FakeWatch;

beforeAll(async () => {
  fake = await startFakeWatch();
});
beforeEach(async () => {
  await resetDatabase();
  fake.calls.length = 0;
  fake.animeDown = false;
});
afterAll(async () => {
  fake.close();
  await closeAll();
});

async function person(name: string) {
  const agent = request.agent(app);
  await agent.post("/api/me").send({ name });
  return agent;
}

describe("search", () => {
  it("finds TV shows and anime in one shape", async () => {
    const tv = await request(app).get("/api/watch/search?q=friends");
    expect(tv.status).toBe(200);
    expect(tv.body.results[0]).toMatchObject({ source: "tv", externalId: "431", title: "Friends", year: 1994, kind: "TV show", rating: 85, mine: null });
    expect(tv.body.results[0].summary).not.toMatch(/<p>|<b>/); // HTML removed

    const anime = await request(app).get("/api/watch/search?q=frieren&type=anime");
    expect(anime.body.results[0]).toMatchObject({
      source: "anime",
      externalId: "52991",
      title: "Frieren: Beyond Journey's End",
      originalTitle: "Sousou no Frieren",
      kind: "Anime series",
      episodes: 28,
      rating: 93,
      genres: ["Adventure", "Drama", "Fantasy"],
    });
    expect(anime.body.results[0].summary).not.toContain("MAL Rewrite");
  });

  it("asks the sources only once a day for the same words (Valkey cache)", async () => {
    await request(app).get("/api/watch/search?q=Friends&type=tv");
    await request(app).get("/api/watch/search?q=friends&type=tv");
    expect(fake.calls.filter((c) => c.startsWith("/tvmaze/search"))).toHaveLength(1);
  });

  it("still answers when one source is down, and says which", async () => {
    fake.animeDown = true;
    const res = await request(app).get("/api/watch/search?q=friends");
    expect(res.status).toBe(200);
    expect(res.body.unavailable).toEqual(["anime"]);
    expect(res.body.results[0].title).toBe("Friends");
    expect((await request(app).get("/api/watch/search?q=zzz&type=anime")).status).toBe(503);
  });

  it("refuses too-short searches", async () => {
    expect((await request(app).get("/api/watch/search?q=a")).status).toBe(400);
  });
});

describe("your list", () => {
  it("adds, updates and removes titles, and needs a name", async () => {
    expect((await request(app).put("/api/watch/list/tv/431").send({ status: "want" })).status).toBe(401);
    const linh = await person("Linh");
    const added = await linh.put("/api/watch/list/anime/52991").send({ status: "watching", episodesSeen: 5 });
    expect(added.status).toBe(200);
    expect(added.body).toMatchObject({ title: "Frieren: Beyond Journey's End", status: "watching", episodesSeen: 5, stars: null });

    const done = await linh.put("/api/watch/list/anime/52991").send({ status: "done", stars: 5, note: "Cried twice." });
    expect(done.body).toMatchObject({ status: "done", stars: 5, note: "Cried twice.", episodesSeen: 5 });
    await linh.put("/api/watch/list/tv/431").send({ status: "want" });

    const list = await linh.get("/api/watch/list");
    expect(list.body.map((e: { title: string }) => e.title)).toEqual(["Friends", "Frieren: Beyond Journey's End"]);
    expect((await linh.get("/api/watch/list?status=done")).body).toHaveLength(1);

    // the search knows it's on your list
    const search = await linh.get("/api/watch/search?q=friends&type=tv");
    expect(search.body.results[0].mine).toMatchObject({ status: "want" });

    expect((await linh.delete(`/api/watch/list/${done.body.titleId}`)).status).toBe(204);
    expect((await linh.get("/api/watch/list")).body).toHaveLength(1);
  });

  it("refuses bad ratings, unknown titles and made-up sources", async () => {
    const linh = await person("Linh");
    expect((await linh.put("/api/watch/list/tv/431").send({ status: "done", stars: 6 })).status).toBe(400);
    expect((await linh.put("/api/watch/list/tv/999999").send({ status: "want" })).status).toBe(404);
    expect((await linh.put("/api/watch/list/netflix/1").send({ status: "want" })).status).toBe(400);
  });

  it("keeps working from its own copy when the source is down", async () => {
    const linh = await person("Linh");
    await linh.put("/api/watch/list/anime/52991").send({ status: "watching" });
    fake.animeDown = true;
    expect((await linh.put("/api/watch/list/anime/52991").send({ status: "done", stars: 4 })).status).toBe(200);
  });
});

describe("on Nook", () => {
  it("shows what people here watch, with average stars and names", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    await linh.put("/api/watch/list/anime/52991").send({ status: "done", stars: 5 });
    await mai.put("/api/watch/list/anime/52991").send({ status: "done", stars: 4 });
    await mai.put("/api/watch/list/tv/431").send({ status: "watching" });

    const res = await request(app).get("/api/watch/popular");
    expect(res.body.popular[0]).toMatchObject({ title: "Frieren: Beyond Journey's End", people: 2, avgStars: 4.5 });
    expect(res.body.popular[0].names.sort()).toEqual(["Linh", "Mai"]);
    expect(res.body.latest[0]).toMatchObject({ name: "Mai", title: "Friends", status: "watching" });

    const title = await linh.get(`/api/watch/titles/${res.body.popular[0].titleId}`);
    expect(title.body.people.map((p: { name: string }) => p.name).sort()).toEqual(["Linh", "Mai"]);
    expect(title.body.mine).toMatchObject({ stars: 5 });
  });

  it("forgets titles nobody has any more (daily clean-up)", async () => {
    const linh = await person("Linh");
    const e = await linh.put("/api/watch/list/tv/431").send({ status: "want" });
    await linh.delete(`/api/watch/list/${e.body.titleId}`);
    const result = await processJob("cleanup", {});
    expect(result).toMatchObject({ watchTitles: 1 });
    expect((await pool.query("select count(*)::int as n from watch_titles")).rows[0].n).toBe(0);
  });
});

it("turns HTML summaries into plain text", () => {
  expect(plainText("<p><b>Friends</b> is a show &amp; more.</p>")).toBe("Friends is a show & more.");
  expect(plainText("x".repeat(700)).length).toBe(600);
});
