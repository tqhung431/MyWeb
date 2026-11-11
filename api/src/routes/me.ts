// You, on this browser (Stage 11: a name, no email or password).
//
// GET    /api/me               who am I? → { user } or { user: null }
// POST   /api/me   { name }    "call me Linh": creates you and remembers this browser (cookie)
// PATCH  /api/me   { name }    change your name
// DELETE /api/me               delete me and everything I made, now
// GET    /api/me/data          what Nook keeps about me (counts), and for how long
// PUT    /api/me/preferences   save personal settings (e.g. timer lengths)
//
// Names are unique (ignoring upper/lower case), so everyone on this Nook knows who's who.

import { count, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { claimGuestData, COOKIE_NAME, endSession, publicUser, refreshCachedSession, startSession } from "../auth/sessions.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { achievements, chatMessages, focusSessions, gameScores, postComments, posts, songLikes, songs, users, watchEntries } from "../db/schema.js";
import { enqueue } from "../jobs/queue.js";
import { deletePerson } from "../people.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { broadcast, publishActivity } from "../realtime/emit.js";
import { timeZoneOf } from "./sessions.js";

export const meRouter = Router();

// 1–30 characters; letters from any language, numbers, emoji and spaces are all fine.
export const nameSchema = z
  .string()
  .transform((n) => n.normalize("NFC").replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Enter a name")
      .max(30, "Use 30 characters or fewer")
      .refine((n) => !/[\p{Cc}\p{Cf}<>]/u.test(n), "Use letters, numbers, spaces or emoji")
      .refine((n) => n.toLowerCase() !== "guest" && n.toLowerCase() !== "a guest", "Pick a name other than Guest"),
  );
const nameBody = z.object({ name: nameSchema });

// The database refuses a second "Linh" (unique index on lower(name)): turn that into a friendly 409.
function isNameTaken(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
const taken = (name: string) => new HttpError(409, `Someone here is already called “${name}”. Try adding an initial or an emoji.`);

// New names: a few an hour per visitor (behind Caddy), and a cap for everyone together.
const HOUR = 60 * 60 * 1000;
const newNameLimits = [
  rateLimit({ name: "name-all", windowMs: HOUR, max: 300, key: () => "all" }),
  ...(config.TRUST_PROXY === false ? [] : [rateLimit({ name: "name-ip", windowMs: HOUR, max: 20, key: (req) => req.ip ?? "?" })]),
];

meRouter.get("/", (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

meRouter.post("/", ...newNameLimits, async (req, res) => {
  if (req.user) throw new HttpError(409, "You already have a name. Use PATCH /api/me to change it.");
  const { name } = nameBody.parse(req.body);
  const user = await db
    .insert(users)
    .values({ name })
    .returning()
    .then((rows) => rows[0])
    .catch((err) => {
      throw isNameTaken(err) ? taken(name) : err;
    });

  await startSession(res, user.id, req.get("user-agent"));
  await claimGuestData(user.id, req.get("x-client-id")); // what you did before picking a name stays yours
  res.status(201).json({ user: publicUser(user) });

  await publishActivity("UserPlus", `${user.name} joined Nook`);
  await enqueue("achievements", { userId: user.id, clientId: null, timeZone: timeZoneOf(req) });
});

meRouter.patch("/", requireUser, async (req, res) => {
  const { name } = nameBody.parse(req.body);
  const [user] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, req.user!.id))
    .returning()
    .catch((err) => {
      throw isNameTaken(err) ? taken(name) : err;
    });
  await refreshCachedSession(req.cookies?.[COOKIE_NAME]);
  res.json({ user: publicUser(user) });
  broadcast("people:changed"); // names shown in chats and boards refresh
});

meRouter.delete("/", requireUser, async (req, res) => {
  await deletePerson(req.user!.id);
  await endSession(res, req.cookies?.[COOKIE_NAME]);
  res.status(204).end();
  broadcast("people:changed");
});

meRouter.get("/data", requireUser, async (req, res) => {
  const id = req.user!.id;
  const owner = `user:${id}`;
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  res.json({
    name: req.user!.name,
    createdAt: req.user!.createdAt,
    lastSeenAt: req.user!.lastSeenAt,
    keptForDays: config.DATA_RETENTION_DAYS,
    chatKeptForDays: config.CHAT_RETENTION_DAYS,
    counts: {
      focusSessions: await n(db.select({ n: count() }).from(focusSessions).where(eq(focusSessions.userId, id))),
      badges: await n(db.select({ n: count() }).from(achievements).where(eq(achievements.userId, id))),
      gameScores: await n(db.select({ n: count() }).from(gameScores).where(eq(gameScores.userId, id))),
      songsAdded: await n(db.select({ n: count() }).from(songs).where(eq(songs.addedByUserId, id))),
      songLikes: await n(db.select({ n: count() }).from(songLikes).where(eq(songLikes.owner, owner))),
      posts: await n(db.select({ n: count() }).from(posts).where(eq(posts.authorId, id))),
      comments: await n(db.select({ n: count() }).from(postComments).where(eq(postComments.authorId, id))),
      chatMessages: await n(db.select({ n: count() }).from(chatMessages).where(eq(chatMessages.authorId, id))),
      watchList: await n(db.select({ n: count() }).from(watchEntries).where(eq(watchEntries.userId, id))),
    },
  });
});

// --- PUT /api/me/preferences (Stage 7) -------------------------------------------------

const preferences = z.object({
  timer: z
    .object({
      focus: z.number().int().min(1).max(120),
      short: z.number().int().min(1).max(60),
      long: z.number().int().min(1).max(60),
    })
    .optional(),
});

meRouter.put("/preferences", requireUser, async (req, res) => {
  const changes = preferences.parse(req.body);
  // "||" merges JSON objects in PostgreSQL: keys we send replace old ones, others stay.
  const [user] = await db
    .update(users)
    .set({ preferences: sql`${users.preferences} || ${JSON.stringify(changes)}::jsonb` })
    .where(eq(users.id, req.user!.id))
    .returning();
  await refreshCachedSession(req.cookies?.[COOKIE_NAME]);
  res.json({ user: publicUser(user) });
});
