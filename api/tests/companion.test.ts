// The Companion (Stage 9): embeddings in pgvector, retrieval, and a streamed answer,
// against a FAKE Ollama (tests/fake-ollama.ts) so no real model is needed.

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reindex, search } from "../src/ai/knowledge.js";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { pool } from "../src/db/client.js";
import { processJob } from "../src/jobs/handlers.js";
import { startFakeOllama } from "./fake-ollama.js";
import { closeAll, ORIGIN, resetDatabase, SITE_HOST } from "./helpers.js";

const app = createApp();
let ollama: Server;
const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

beforeAll(async () => {
  ollama = await startFakeOllama();
});
afterAll(async () => {
  await new Promise<void>((r) => ollama.close(() => r()));
  await closeAll();
});
beforeEach(resetDatabase);

const upload = (file: string) =>
  request(app).post("/api/songs").set("Origin", ORIGIN).set("X-Forwarded-Host", SITE_HOST).set("X-Client-Id", randomUUID())
    .field("rights", "yes").field("license", "Own work").attach("file", fixture(file));

// Read a Server-Sent Events response into a list of { event, data }
function events(text: string) {
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => ({
      event: block.match(/^event: (.+)$/m)?.[1],
      data: JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "null"),
    }));
}

const chat = (content: string, client = randomUUID()) =>
  request(app).post("/api/companion/chat").set("X-Client-Id", client).send({ messages: [{ role: "user", content }] });

describe("status", () => {
  it("says whether Ollama and both models are ready", async () => {
    const res = await request(app).get("/api/companion/status");
    expect(res.body).toMatchObject({ enabled: true, reachable: true, ready: true, models: { chat: true, embed: true }, chatModel: "qwen2.5:1.5b" });
  });
});

describe("knowledge (embeddings in pgvector)", () => {
  it("indexes every tip and song, and only re-embeds what changed", async () => {
    await upload("title-remix.mp3");
    expect(await reindex()).toEqual({ embedded: 5, removed: 0, total: 5 }); // 4 tips + 1 song
    expect(await reindex()).toEqual({ embedded: 0, removed: 0, total: 5 }); // nothing changed

    await pool.query("update tips set summary = 'Changed!' where slug = 'real-breaks'");
    expect((await reindex()).embedded).toBe(1);

    await pool.query("delete from songs");
    expect((await reindex()).removed).toBe(1);
  });

  it("finds items by meaning: the closest embeddings first", async () => {
    await upload("title-remix.mp3"); // "Đêm Nay (Vinahouse Remix)" → genre remix: "dance, EDM, vinahouse, upbeat, party"
    await reindex();
    const party = await search("an upbeat dance song for a party");
    expect(party[0]).toMatchObject({ kind: "song" });
    const breaks = await search("how should I take breaks from the screen?");
    expect(breaks[0]).toMatchObject({ kind: "tip", refId: "real-breaks" });
  });

  it("is done by the worker's reindex job", async () => {
    expect(await processJob("reindex", {})).toMatchObject({ total: 4 });
  });

  it("is skipped, not failed, while Ollama isn't running", async () => {
    const saved = config.OLLAMA_URL;
    try {
      config.OLLAMA_URL = "http://127.0.0.1:4995"; // nothing listens here
      expect(await processJob("reindex", {})).toEqual({ skipped: "Can't reach Ollama. Is it running?" });
    } finally {
      config.OLLAMA_URL = saved;
    }
  });
});

describe("chat", () => {
  it("streams sources first, then the answer piece by piece, using MyWeb's own items", async () => {
    await upload("title-remix.mp3");
    await reindex();
    const res = await chat("Gợi ý một bài remix dance cho party"); // Vietnamese works too
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    const list = events(res.text);
    expect(list[0].event).toBe("sources");
    expect(list[0].data[0]).toMatchObject({ kind: "song", title: "Đêm Nay (Vinahouse Remix)", audioUrl: expect.stringMatching(/\/audio$/) });
    const tokens = list.filter((e) => e.event === "token");
    expect(tokens.length).toBeGreaterThan(3); // really streamed, not one big block
    expect(tokens.map((t) => t.data.t).join("")).toBe("You could try “Đêm Nay (Vinahouse Remix)”. Enjoy!");
    expect(list[list.length - 1].event).toBe("done");
  });

  it("checks the conversation it's sent", async () => {
    const bad = await request(app).post("/api/companion/chat").set("X-Client-Id", randomUUID())
      .send({ messages: [{ role: "assistant", content: "I go last" }] });
    expect(bad.status).toBe(400);
    const tooLong = await chat("x".repeat(2001));
    expect(tooLong.status).toBe(400);
  });

  it("says clearly when the AI is off or the model isn't downloaded", async () => {
    const saved = config.OLLAMA_URL;
    try {
      config.OLLAMA_URL = undefined;
      expect((await chat("hi")).status).toBe(503);
      expect((await request(app).get("/api/companion/status")).body).toMatchObject({ enabled: false, ready: false });
    } finally {
      config.OLLAMA_URL = saved;
    }
    const noModels = await startFakeOllama(4996, []); // Ollama running, but nothing downloaded
    try {
      config.OLLAMA_URL = "http://127.0.0.1:4996";
      const res = await chat("hi");
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/isn't downloaded/);
    } finally {
      config.OLLAMA_URL = saved;
      await new Promise<void>((r) => noModels.close(() => r()));
    }
  });
});
