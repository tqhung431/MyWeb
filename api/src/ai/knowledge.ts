// The Companion's knowledge: embeddings of every tip and song (Stage 9).
//
// Indexing (the worker does this, in the background):
//   tip / song → a short text → Ollama embed → 768 numbers → saved in "knowledge"
// Searching (when someone asks something):
//   question → embed → the rows whose numbers are CLOSEST (cosine distance, pgvector) → best matches
//
// This is "retrieval": the model then answers using these real Nook items,
// instead of making up songs that don't exist here.

import { createHash } from "node:crypto";
import { and, asc, cosineDistance, eq, notInArray, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { knowledge, songs, tips } from "../db/schema.js";
import { embed } from "./ollama.js";

const GENRE_WORDS: Record<string, string> = {
  drill: "drill, rap, hip-hop, energetic, hard beats",
  remix: "remix, dance, EDM, vinahouse, upbeat, party",
  pop: "pop, catchy, singing, feel-good",
  lofi: "lofi, chill, calm, relaxing, good for studying and focus",
};

type Item = { kind: "tip" | "song"; refId: string; content: string };

async function allItems(): Promise<Item[]> {
  const tipRows = await db.select().from(tips).orderBy(asc(tips.id));
  const songRows = await db.select().from(songs).orderBy(asc(songs.id));
  return [
    ...tipRows.map((t) => ({
      kind: "tip" as const,
      refId: t.slug,
      content: `Focus tip: ${t.title}. ${t.summary} ${t.body.join(" ")}`,
    })),
    ...songRows.map((s) => ({
      kind: "song" as const,
      refId: String(s.id),
      content: `Song with vocals: "${s.title}" by ${s.artist}. Genre: ${GENRE_WORDS[s.genre] ?? s.genre}.${s.credit ? ` ${s.credit}.` : ""}`,
    })),
  ];
}

const hash = (text: string) => createHash("sha256").update(`${config.AI_EMBED_MODEL}\n${text}`).digest("hex");

// Bring the index up to date: embed new or changed items, forget deleted ones.
// Safe to run any time, as often as you like (unchanged items are skipped).
export async function reindex(): Promise<{ embedded: number; removed: number; total: number }> {
  const items = await allItems();
  const known = new Map(
    (await db.select({ kind: knowledge.kind, refId: knowledge.refId, contentHash: knowledge.contentHash }).from(knowledge)).map((r) => [
      `${r.kind}:${r.refId}`,
      r.contentHash,
    ]),
  );
  const changed = items.filter((i) => known.get(`${i.kind}:${i.refId}`) !== hash(i.content));

  // Embed in small batches: fewer round trips, without one giant request
  for (let i = 0; i < changed.length; i += 16) {
    const batch = changed.slice(i, i + 16);
    const vectors = await embed(batch.map((b) => b.content));
    for (const [n, item] of batch.entries()) {
      await db
        .insert(knowledge)
        .values({ ...item, contentHash: hash(item.content), model: config.AI_EMBED_MODEL, embedding: vectors[n] })
        .onConflictDoUpdate({
          target: [knowledge.kind, knowledge.refId],
          set: { content: item.content, contentHash: hash(item.content), model: config.AI_EMBED_MODEL, embedding: vectors[n], updatedAt: new Date() },
        });
    }
  }

  // Remove knowledge about deleted songs / tips
  let removed = 0;
  for (const kind of ["tip", "song"] as const) {
    const ids = items.filter((i) => i.kind === kind).map((i) => i.refId);
    const gone = await db
      .delete(knowledge)
      .where(ids.length ? and(eq(knowledge.kind, kind), notInArray(knowledge.refId, ids)) : eq(knowledge.kind, kind))
      .returning({ id: knowledge.id });
    removed += gone.length;
  }
  return { embedded: changed.length, removed, total: items.length };
}

export type Found = { kind: "tip" | "song"; refId: string; content: string; similarity: number };

// The k items closest in meaning to the question (cosine similarity 1 = same meaning, 0 = unrelated).
// minSimilarity 0.2: multilingual models score lower than English-only ones; below this it's noise.
export async function search(question: string, k = 6, minSimilarity = 0.2): Promise<Found[]> {
  const [vector] = await embed([question]);
  const similarity = sql<number>`1 - (${cosineDistance(knowledge.embedding, vector)})`;
  const rows = await db
    .select({ kind: knowledge.kind, refId: knowledge.refId, content: knowledge.content, similarity })
    .from(knowledge)
    .orderBy(cosineDistance(knowledge.embedding, vector)) // uses the HNSW index
    .limit(k);
  return rows.filter((r) => r.similarity >= minSimilarity);
}

export async function knowledgeCount(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(knowledge);
  return row.n;
}
