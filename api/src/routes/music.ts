// Music: songs with vocals, embedded from SoundCloud / YouTube, ranked by MyWeb listeners.
//
// GET    /api/songs?period=week|month|all&genre=all|drill|remix|pop|lofi   the charts
// POST   /api/songs              { url, genre }   add a song (checked with the platform first)
// POST   /api/songs/:id/play     count a play (once per person per song per 10 minutes)
// PUT    /api/songs/:id/like     like      DELETE /api/songs/:id/like   unlike
//
// Charts: score = plays + 3 × likes inside the period. A like is worth more than a play,
// because it's a deliberate "I love this".

import { and, eq, gte, sql } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { songLikes, songPlays, songs } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { lookUp, parseLink } from "../music/links.js";
import { broadcast, displayName, ownerRoom, publishActivity } from "../realtime/emit.js";
import { owner } from "./sessions.js";

export const musicRouter = Router();

export const GENRES = ["drill", "remix", "pop", "lofi"] as const;
const DAY = 86_400_000;
const PERIODS = { week: 7 * DAY, month: 30 * DAY, all: null } as const;

// "user:<id>" / "client:<id>": who played or liked. Optional for reading the charts.
function ownerKey(req: Request, required: boolean): string | null {
  if (!required && !req.user && !req.get("x-client-id")) return null;
  return ownerRoom(owner(req));
}

// --- Charts -----------------------------------------------------------------------

const chartQuery = z.object({
  period: z.enum(["week", "month", "all"]).default("week"),
  genre: z.enum(["all", ...GENRES]).default("all"),
});

musicRouter.get("/", async (req, res) => {
  const { period, genre } = chartQuery.parse(req.query);
  const me = ownerKey(req, false);
  const span = PERIODS[period];
  const since = span ? new Date(Date.now() - span) : new Date(0);

  // Count plays and likes inside the period with sub-queries, then rank.
  const plays = db
    .select({ songId: songPlays.songId, n: sql<number>`count(*)::int`.as("plays") })
    .from(songPlays)
    .where(gte(songPlays.playedAt, since))
    .groupBy(songPlays.songId)
    .as("p");
  const likes = db
    .select({ songId: songLikes.songId, n: sql<number>`count(*)::int`.as("likes") })
    .from(songLikes)
    .where(gte(songLikes.likedAt, since))
    .groupBy(songLikes.songId)
    .as("l");
  const totalLikes = db
    .select({ songId: songLikes.songId, n: sql<number>`count(*)::int`.as("total_likes") })
    .from(songLikes)
    .groupBy(songLikes.songId)
    .as("tl");

  const score = sql<number>`coalesce(${plays.n}, 0) + 3 * coalesce(${likes.n}, 0)`;
  const rows = await db
    .select({
      id: songs.id,
      provider: songs.provider,
      url: songs.url,
      embedUrl: songs.embedUrl,
      title: songs.title,
      artist: songs.artist,
      artworkUrl: songs.artworkUrl,
      genre: songs.genre,
      createdAt: songs.createdAt,
      plays: sql<number>`coalesce(${plays.n}, 0)`,
      likes: sql<number>`coalesce(${totalLikes.n}, 0)`,
      score,
      liked: me ? sql<boolean>`exists (select 1 from ${songLikes} where ${songLikes.songId} = ${songs.id} and ${songLikes.owner} = ${me})` : sql<boolean>`false`,
    })
    .from(songs)
    .leftJoin(plays, eq(plays.songId, songs.id))
    .leftJoin(likes, eq(likes.songId, songs.id))
    .leftJoin(totalLikes, eq(totalLikes.songId, songs.id))
    .where(genre === "all" ? undefined : eq(songs.genre, genre))
    .orderBy(sql`${score} desc`, sql`${songs.createdAt} desc`)
    .limit(50);

  res.json(rows);
});

// --- Add a song -------------------------------------------------------------------

const newSong = z.object({ url: z.string().min(8).max(500), genre: z.enum(GENRES) });

const addLimit = rateLimit({ name: "song-add", windowMs: 60 * 60 * 1000, max: 10, key: (req) => ownerKey(req, true)! });

musicRouter.post("/", addLimit, async (req, res) => {
  const { url, genre } = newSong.parse(req.body);
  const link = parseLink(url); // 400 for anything that isn't SoundCloud / YouTube

  const [existing] = await db.select().from(songs).where(eq(songs.url, link.url));
  if (existing) {
    res.status(409).json({ error: "That song is already in MyWeb", song: existing });
    return;
  }

  const details = await lookUp(link); // asks SoundCloud / YouTube; 404 / 422 / 502 on problems
  const o = owner(req);
  const [song] = await db
    .insert(songs)
    .values({ ...details, genre, addedByUserId: o.userId, addedByClientId: o.clientId })
    .onConflictDoNothing()
    .returning();
  if (!song) throw new HttpError(409, "That song is already in MyWeb");

  await publishActivity("ListMusic", `${displayName(req.user?.name)} added “${song.title}” by ${song.artist}`);
  broadcast("music:changed");
  res.status(201).json(song);
});

// --- Plays and likes --------------------------------------------------------------

const idParam = z.object({ id: z.coerce.number().int().positive() });

async function findSong(req: Request) {
  const { id } = idParam.parse(req.params);
  const [song] = await db.select().from(songs).where(eq(songs.id, id));
  if (!song) throw new HttpError(404, "Song not found");
  return song;
}

musicRouter.post("/:id/play", async (req, res) => {
  const song = await findSong(req);
  const who = ownerKey(req, true)!;

  // Pressing play again and again shouldn't push a song up the chart: one play per 10 minutes.
  const [recent] = await db
    .select({ id: songPlays.id })
    .from(songPlays)
    .where(and(eq(songPlays.songId, song.id), eq(songPlays.owner, who), gte(songPlays.playedAt, new Date(Date.now() - 10 * 60_000))))
    .limit(1);
  if (recent) {
    res.json({ counted: false });
    return;
  }
  await db.insert(songPlays).values({ songId: song.id, owner: who });
  await publishActivity("Headphones", `${displayName(req.user?.name)} is listening to “${song.title}”`);
  broadcast("music:changed");
  res.status(201).json({ counted: true });
});

async function likeCount(songId: number) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(songLikes).where(eq(songLikes.songId, songId));
  return row.n;
}

musicRouter.put("/:id/like", async (req, res) => {
  const song = await findSong(req);
  await db.insert(songLikes).values({ songId: song.id, owner: ownerKey(req, true)! }).onConflictDoNothing();
  broadcast("music:changed"); // likes don't go in the feed, but the charts should re-sort
  res.json({ liked: true, likes: await likeCount(song.id) });
});

musicRouter.delete("/:id/like", async (req, res) => {
  const song = await findSong(req);
  await db.delete(songLikes).where(and(eq(songLikes.songId, song.id), eq(songLikes.owner, ownerKey(req, true)!)));
  broadcast("music:changed");
  res.json({ liked: false, likes: await likeCount(song.id) });
});
