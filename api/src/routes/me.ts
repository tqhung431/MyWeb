// You, on this browser (Stage 11: a name, no email or password).
//
// GET    /api/me               who am I? → { user } or { user: null }
// POST   /api/me   { name }    "call me Linh": creates you and remembers this browser (cookie)
// PATCH  /api/me   { name }    change your name
// DELETE /api/me               delete me and everything I made, now
// GET    /api/me/data          what Nook keeps about me (counts), and for how long
// PUT    /api/me/preferences   save personal settings (e.g. timer lengths)
//
// Stage 27: a PIN protects your name, so you can get it back on another device.
// PUT    /api/me/pin                 { pin }         set or change your PIN (4–6 digits)
// POST   /api/me/sign-in             { name, pin }   this browser becomes you (10 wrong PINs: locked 15 minutes)
// POST   /api/me/codes                               a 6-letter code (5 minutes) to sign in another device
// POST   /api/me/sign-in/code        { code }        sign in with that code, or with a claim code from the admin
// POST   /api/me/sign-out                            this browser forgets you
// GET    /api/me/devices                             the browsers signed in as you
// DELETE /api/me/devices/:id                         sign one out ("others": every one but this)
//
// Names are unique (ignoring upper/lower case), so everyone on this Nook knows who's who.

import { and, count, eq, gt, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import {
  checkPin,
  claimGuestData,
  COOKIE_NAME,
  currentSessionId,
  devicesOf,
  endSession,
  endSessionsOf,
  forgetAllOf,
  hashPin,
  makeSignInCode,
  PIN_RE,
  publicUser,
  refreshCachedSession,
  startSession,
  useSignInCode,
} from "../auth/sessions.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  achievements,
  chatImages,
  chatMessages,
  directMessages,
  focusSessions,
  gameScores,
  postComments,
  posts,
  songLikes,
  songs,
  reservedNames,
  users,
  watchEntries,
  habits,
  books,
  onlineGamePlayers,
} from "../db/schema.js";
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
export const nameBody = z.object({ name: nameSchema });
export const pinSchema = z.string().regex(PIN_RE, "A PIN is 4 to 6 digits");
export const newMeBody = z.object({ name: nameSchema, pin: pinSchema.optional() });

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

// Stage 27: a deleted person's name stays theirs for a while (people.ts), so nobody can take it and pretend
async function notReserved(name: string) {
  const [r] = await db
    .select()
    .from(reservedNames)
    .where(and(eq(reservedNames.name, name.toLowerCase()), gt(reservedNames.until, new Date())));
  if (r) throw new HttpError(409, "That name was used here recently. Pick another one for now.");
}

meRouter.post("/", ...newNameLimits, async (req, res) => {
  if (req.user) throw new HttpError(409, "You already have a name. Use PATCH /api/me to change it.");
  const { name, pin } = newMeBody.parse(req.body);
  await notReserved(name);
  const user = await db
    .insert(users)
    .values({ name, pinHash: pin ? await hashPin(pin) : null })
    .returning()
    .then((rows) => rows[0])
    .catch((err) => {
      throw isNameTaken(err) ? taken(name) : err;
    });

  await startSession(res, user.id, req.get("user-agent"));
  await claimGuestData(user.id, req.get("x-client-id")); // what you did before picking a name stays yours
  res.status(201).json({ user: publicUser(user) });

  await publishActivity("UserPlus", "{name} joined Nook", { name: user.name });
  await enqueue("achievements", { userId: user.id, clientId: null, timeZone: timeZoneOf(req) });
});

meRouter.patch("/", requireUser, async (req, res) => {
  const { name } = nameBody.parse(req.body);
  if (name.toLowerCase() !== req.user!.name.toLowerCase()) await notReserved(name);
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
      privateMessages: await n(db.select({ n: count() }).from(directMessages).where(eq(directMessages.senderId, id))),
      chatPictures: await n(db.select({ n: count() }).from(chatImages).where(eq(chatImages.uploaderId, id))),
      watchList: await n(db.select({ n: count() }).from(watchEntries).where(eq(watchEntries.userId, id))),
      habits: await n(db.select({ n: count() }).from(habits).where(eq(habits.userId, id))),
      books: await n(db.select({ n: count() }).from(books).where(eq(books.userId, id))),
      quizGames: await n(db.select({ n: count() }).from(onlineGamePlayers).where(eq(onlineGamePlayers.userId, id))),
    },
  });
});

// --- PUT /api/me/preferences (Stage 7) -------------------------------------------------

export const preferences = z.object({
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


// --- Stage 27: PIN, signing in on another device, devices ------------------------------------------

meRouter.put("/pin", requireUser, async (req, res) => {
  const { pin } = pinBody.parse(req.body);
  const [user] = await db
    .update(users)
    .set({ pinHash: await hashPin(pin), pinFailures: 0, pinLockedUntil: null })
    .where(eq(users.id, req.user!.id))
    .returning();
  await forgetAllOf(user.id);
  res.json({ user: publicUser(user) });
});

const MAX_PIN_TRIES = 10;
const LOCK_MINUTES = 15;
// Wrong PINs are also limited per visitor, so nobody can try many names one after another
export const signInBody = z.object({ name: nameSchema, pin: z.string().max(12) });
export const codeBody = z.object({ code: z.string().min(4).max(20) });
export const pinBody = z.object({ pin: pinSchema });
const signInLimit = rateLimit({ name: "sign-in", windowMs: 15 * 60_000, max: 30, key: (req) => `ip:${req.ip}` });
const wrongPin = () => new HttpError(401, "That name and PIN don't match");

meRouter.post("/sign-in", signInLimit, async (req, res) => {
  const { name, pin } = signInBody.parse(req.body);
  const [user] = await db.select().from(users).where(sql`lower(${users.name}) = lower(${name})`);
  if (!user) throw wrongPin();
  if (!user.pinHash) throw new HttpError(403, "That name has no PIN yet, so it can only be used on its own device. Ask the admin for a sign-in code.");
  if (user.pinLockedUntil && user.pinLockedUntil.getTime() > Date.now()) throw new HttpError(429, "Too many wrong PINs for this name. Try again in 15 minutes.");
  if (!(await checkPin(pin, user.pinHash))) {
    const failures = user.pinFailures + 1;
    await db
      .update(users)
      .set(failures >= MAX_PIN_TRIES ? { pinFailures: 0, pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { pinFailures: failures })
      .where(eq(users.id, user.id));
    throw failures >= MAX_PIN_TRIES ? new HttpError(429, "Too many wrong PINs for this name. Try again in 15 minutes.") : wrongPin();
  }
  await db.update(users).set({ pinFailures: 0, pinLockedUntil: null }).where(eq(users.id, user.id));
  if (req.user) await endSession(res, req.cookies?.[COOKIE_NAME]); // signed in as someone else on this browser: not any more
  await startSession(res, user.id, req.get("user-agent"));
  res.json({ user: publicUser(user) });
});

meRouter.post("/codes", requireUser, async (req, res) => {
  res.status(201).json(await makeSignInCode(req.user!.id, "device"));
});

meRouter.post("/sign-in/code", signInLimit, async (req, res) => {
  const { code } = codeBody.parse(req.body);
  const used = await useSignInCode(code);
  if (!used) throw new HttpError(401, "That code doesn't work. Codes work once, and only for a short time.");
  // A claim code (from the admin) means the old PIN is forgotten: you choose a new one now
  const [user] =
    used.kind === "claim"
      ? await db.update(users).set({ pinHash: null, pinFailures: 0, pinLockedUntil: null }).where(eq(users.id, used.userId)).returning()
      : await db.select().from(users).where(eq(users.id, used.userId));
  if (!user) throw new HttpError(401, "That code doesn't work. Codes work once, and only for a short time.");
  if (req.user) await endSession(res, req.cookies?.[COOKIE_NAME]);
  await startSession(res, user.id, req.get("user-agent"));
  res.json({ user: publicUser(user) });
});

meRouter.post("/sign-out", requireUser, async (req, res) => {
  await endSession(res, req.cookies?.[COOKIE_NAME]);
  res.status(204).end();
});

meRouter.get("/devices", requireUser, async (req, res) => {
  res.json(await devicesOf(req.user!.id, req.cookies?.[COOKIE_NAME]));
});

meRouter.delete("/devices/:id", requireUser, async (req, res) => {
  const id = z.string().regex(/^([0-9a-f]{12}|others)$/).parse(req.params.id);
  const current = currentSessionId(req.cookies?.[COOKIE_NAME]);
  const n =
    id === "others"
      ? await endSessionsOf(req.user!.id, { except: current })
      : current?.startsWith(id)
        ? 0 // this browser: use "Sign out" instead
        : await endSessionsOf(req.user!.id, { deviceId: id });
  res.json({ signedOut: n });
});
