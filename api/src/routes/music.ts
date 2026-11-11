// Music: songs with vocals, stored and played by Nook itself, ranked by Nook listeners.
//
// GET    /api/songs?period=week|month|all&genre=all|drill|remix|pop|lofi   the charts
// POST   /api/songs                 upload one song (multipart: file, license, credit?, sourceUrl?, genre?)
// GET    /api/songs/:id/audio       the song file (supports seeking: HTTP Range requests)
// GET    /api/songs/:id/artwork     its cover picture, if the file had one
// PATCH  /api/songs/:id             fix genre / title / artist (only whoever added it)
// DELETE /api/songs/:id             remove it (only whoever added it)
// POST   /api/songs/:id/play        count a play (once per person per song per 10 minutes)
// PUT    /api/songs/:id/like        like      DELETE /api/songs/:id/like   unlike
//
// Charts: score = plays + 3 × likes inside the period.

import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, gte, ilike, or, sql } from "drizzle-orm";
import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { songLikes, songPlays, songs, type Song } from "../db/schema.js";
import { songPlays as songPlaysMetric, songUploads } from "../metrics.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { enqueue } from "../jobs/queue.js";
import { addSongFile } from "../music/add.js";
import { mediaPath, removeFiles } from "../music/files.js";
import { GENRES } from "../music/genre.js";
import { broadcast, displayName, ownerRoom, publishActivity } from "../realtime/emit.js";
import { owner } from "./sessions.js";

export const musicRouter = Router();

const DAY = 86_400_000;
const PERIODS = { week: 7 * DAY, month: 30 * DAY, all: null } as const;

// "user:<id>" / "client:<id>": who played or liked. Optional for reading the charts.
function ownerKey(req: Request, required: boolean): string | null {
  if (!required && !req.user && !req.get("x-client-id")) return null;
  return ownerRoom(owner(req));
}

// What the browser gets for a song: never the file's location on disk.
export function publicSong(song: Song) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    genre: song.genre,
    durationSec: song.durationSec,
    license: song.license,
    licenseUrl: song.licenseUrl,
    credit: song.credit,
    sourceUrl: song.sourceUrl,
    audioUrl: `/api/songs/${song.id}/audio`,
    artworkUrl: song.artworkFile ? `/api/songs/${song.id}/artwork` : null,
    createdAt: song.createdAt,
  };
}

// --- Charts -----------------------------------------------------------------------

const chartQuery = z.object({
  period: z.enum(["week", "month", "all"]).default("week"),
  genre: z.enum(["all", ...GENRES]).default("all"),
  // Stage 18 fix: the chart used to stop at 50 songs. Now it comes in pages, and can be searched.
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

musicRouter.get("/", async (req, res) => {
  const { period, genre, q, limit, offset } = chartQuery.parse(req.query);
  const me = ownerKey(req, false);
  const span = PERIODS[period];
  const since = span ? new Date(Date.now() - span) : new Date(0);

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
      song: songs,
      plays: sql<number>`coalesce(${plays.n}, 0)`,
      likes: sql<number>`coalesce(${totalLikes.n}, 0)`,
      score,
      liked: me ? sql<boolean>`exists (select 1 from ${songLikes} where ${songLikes.songId} = ${songs.id} and ${songLikes.owner} = ${me})` : sql<boolean>`false`,
    })
    .from(songs)
    .leftJoin(plays, eq(plays.songId, songs.id))
    .leftJoin(likes, eq(likes.songId, songs.id))
    .leftJoin(totalLikes, eq(totalLikes.songId, songs.id))
    .where(
      and(
        genre === "all" ? undefined : eq(songs.genre, genre),
        q ? or(ilike(songs.title, `%${likeSafe(q)}%`), ilike(songs.artist, `%${likeSafe(q)}%`)) : undefined,
      ),
    )
    .orderBy(sql`${score} desc`, sql`${songs.createdAt} desc`, sql`${songs.id} desc`)
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(songs)
    .where(
      and(
        genre === "all" ? undefined : eq(songs.genre, genre),
        q ? or(ilike(songs.title, `%${likeSafe(q)}%`), ilike(songs.artist, `%${likeSafe(q)}%`)) : undefined,
      ),
    );
  res.set("X-Total-Count", String(total));

  res.json(
    rows.map((r) => ({
      ...publicSong(r.song),
      plays: r.plays,
      likes: r.likes,
      score: r.score,
      liked: r.liked,
      mine: me !== null && isAddedBy(r.song, me),
    })),
  );
});

// % and _ are wildcards in LIKE: a search for "100%" should find "100%", not everything
const likeSafe = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

function isAddedBy(song: Song, who: string) {
  return who === (song.addedByUserId ? `user:${song.addedByUserId}` : `client:${song.addedByClientId}`);
}

// --- Upload -----------------------------------------------------------------------

// multer saves the upload to a temporary file first (never all in memory), with a size limit.
// Stage 12: browsers send file names as UTF-8, but multer reads them as Latin-1 unless told otherwise,
// which turned "Đêm Nay 🎵.mp3" into "ÄÃªm Nay ðµ.mp3".
const upload = multer({
  dest: path.join(tmpdir(), "nook-uploads"),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10 },
  defParamCharset: "utf8",
}).single("file");

const uploadFields = z.object({
  // The person must confirm they may share it. Nook only hosts songs people have the right to share.
  rights: z.literal("yes", { message: "Please confirm you may share this song" }),
  license: z.string().trim().min(2).max(80),
  licenseUrl: z.url().max(300).optional().or(z.literal("").transform(() => undefined)),
  credit: z.string().trim().max(200).optional(),
  sourceUrl: z.url().max(300).optional().or(z.literal("").transform(() => undefined)),
  genre: z.enum(["auto", ...GENRES]).default("auto"),
});

// Stage 12: 300 songs an hour per person (was 30: too few for adding a music collection).
const addLimit = rateLimit({ name: "song-add", windowMs: 60 * 60 * 1000, max: config.SONG_UPLOADS_PER_HOUR, key: (req) => ownerKey(req, true)! });

// GET /api/songs/upload-limits: the website checks sizes before sending anything.
musicRouter.get("/upload-limits", (_req, res) => {
  res.json({ maxMb: config.MAX_UPLOAD_MB, perHour: config.SONG_UPLOADS_PER_HOUR });
});

// The limit is checked AFTER the file has arrived (Stage 12 fix). Answering while the browser is still
// sending makes the server close the connection mid-upload, and the browser only sees "connection lost"
// instead of our message. multer itself drains the rest of the upload when a file is too big.
musicRouter.post("/", (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new HttpError(err.code === "LIMIT_FILE_SIZE" ? 413 : 400, err.code === "LIMIT_FILE_SIZE" ? `Songs can be up to ${config.MAX_UPLOAD_MB} MB` : err.message));
    }
    next(err);
  });
}, (req, res, next) => {
  const done = (err?: unknown) => {
    if (err && req.file) void rm(req.file.path, { force: true }); // not kept: remove the temporary file
    if (err instanceof HttpError && err.status === 429) {
      const minutes = Math.max(1, Math.ceil(Number(res.getHeader("Retry-After") ?? 60) / 60));
      return next(new HttpError(429, `Too many songs this hour (${config.SONG_UPLOADS_PER_HOUR}). Try the rest in about ${minutes} min.`));
    }
    next(err);
  };
  Promise.resolve(addLimit(req, res, done)).catch(done);
}, async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, "Choose a song file to upload");
  try {
    const fields = uploadFields.parse(req.body);
    const o = owner(req);
    const { song, detected, starter } = await addSongFile({
      path: file.path,
      originalName: file.originalname.normalize("NFC"), // a Mac's "e + ◌̂" becomes the usual "ê"
      owner: o,
      license: fields.license,
      licenseUrl: fields.licenseUrl,
      credit: fields.credit,
      sourceUrl: fields.sourceUrl,
      genre: fields.genre === "auto" ? undefined : fields.genre,
    });
    songUploads.add(1, { genre: song.genre, starter_pack: starter });
    await publishActivity("ListMusic", `${displayName(req.user?.name)} added “${song.title}” by ${song.artist}`);
    broadcast("music:changed");
    res.status(201).json({ ...publicSong(song), detectedGenre: detected, starterPack: starter });
    await enqueue("reindex", {}); // Stage 9: the Companion learns about the new song
  } finally {
    await rm(file.path, { force: true }); // the temporary upload (already moved if it was accepted)
  }
});

// --- Files ------------------------------------------------------------------------

const idParam = z.object({ id: z.coerce.number().int().positive() });

async function findSong(req: Request): Promise<Song> {
  const { id } = idParam.parse(req.params);
  const [song] = await db.select().from(songs).where(eq(songs.id, id));
  if (!song) throw new HttpError(404, "Song not found");
  return song;
}

// sendFile handles "Range: bytes=…" for seeking, plus ETag / Last-Modified.
// A song file never changes (a new upload gets a new id), so browsers may keep it for a year.
musicRouter.get("/:id/audio", async (req, res) => {
  const song = await findSong(req);
  res.sendFile(mediaPath(song.fileName), {
    headers: { "Content-Type": song.mimeType, "Cache-Control": "public, max-age=31536000, immutable" },
    dotfiles: "allow", // MEDIA_DIR may be a hidden folder (tests use tests/.media); names come from our database, not the visitor
  });
});

musicRouter.get("/:id/artwork", async (req, res) => {
  const song = await findSong(req);
  if (!song.artworkFile) throw new HttpError(404, "This song has no cover picture");
  res.sendFile(mediaPath(song.artworkFile), { headers: { "Cache-Control": "public, max-age=31536000, immutable" }, dotfiles: "allow" });
});

// --- Fix or remove (only whoever added it) -------------------------------------------

async function findOwnSong(req: Request): Promise<Song> {
  const song = await findSong(req);
  if (!isAddedBy(song, ownerKey(req, true)!)) throw new HttpError(403, "Only the person who added this song can change it");
  return song;
}

const edits = z.object({
  genre: z.enum(GENRES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  artist: z.string().trim().min(1).max(200).optional(),
});

musicRouter.patch("/:id", async (req, res) => {
  const song = await findOwnSong(req);
  const changes = edits.parse(req.body);
  const [updated] = await db.update(songs).set(changes).where(eq(songs.id, song.id)).returning();
  broadcast("music:changed");
  res.json(publicSong(updated));
  await enqueue("reindex", {});
});

musicRouter.delete("/:id", async (req, res) => {
  const song = await findOwnSong(req);
  await db.delete(songs).where(eq(songs.id, song.id)); // plays and likes go too (cascade)
  await removeFiles(song.fileName, song.artworkFile);
  broadcast("music:changed");
  res.status(204).end();
  await enqueue("reindex", {});
});

// --- Plays and likes --------------------------------------------------------------

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
  songPlaysMetric.add(1, { genre: song.genre });
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
