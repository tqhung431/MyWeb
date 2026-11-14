// Stage 27: the Admin page's API. Every route needs the admin (a browser that typed the passcode, for 12 hours),
// and every change is written to the admin log.
//
// GET    /api/admin/people                        everyone: joined, last seen, PIN or not, paused, devices
// PATCH  /api/admin/people/:id        { name }    rename
// POST   /api/admin/people/:id/claim-code         a one-time sign-in code (24 h) for someone locked out
// POST   /api/admin/people/:id/sign-out           sign them out on every device
// POST   /api/admin/people/:id/pause  { days }    read only for 1, 7 or 3650 days; 0 = lift
// DELETE /api/admin/people/:id        { confirm } delete them and their data (type their name to confirm)
// POST   /api/admin/groups/:slug/lock { locked }  a Hobby Hub group becomes read only (or not)
// GET    /api/admin/reports?status=open           reported posts, comments and messages
// POST   /api/admin/reports/:id       { action }  "keep" or "delete" the reported thing
// DELETE /api/admin/songs/:id                     remove a song and its file
// GET    /api/admin/scores                        the top Mini Arcade scores · DELETE /api/admin/scores/:id
// PUT    /api/admin/banner            { text }    a message on every page ("" = none)
// GET    /api/admin/storage                       space used by songs and chat pictures
// POST   /api/admin/cleanup                       run the daily cleanup now
// GET    /api/admin/log                           the admin log
// GET    /api/admin/sign-ins                      Stage 28: the sign-in log (who, when, what kind of device)
// GET    /api/admin/health                        database, Valkey, game server, AI, disk
//
// For everyone:
// POST   /api/reports                 { kind, id, reason }   report a post, comment, chat message or private message
// GET    /api/banner                                         the admin's banner, if any

import { statfs } from "node:fs/promises";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { and, count, desc, eq, max, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { isAdmin, logAdmin, requireAdmin } from "../admin.js";
import { aiStatus } from "../ai/ollama.js";
import { COOKIE_NAME, currentSessionId, endSessionsOf, forgetAllOf, makeSignInCode } from "../auth/sessions.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import {
  adminLog,
  authSessions,
  chatMessages,
  directMessages,
  gameScores,
  hobbyGroups,
  postComments,
  posts,
  reports,
  signIns,
  siteSettings,
  songs,
  users,
} from "../db/schema.js";
import { eraseChatMessage, eraseDirectMessage } from "../hobby/erase.js";
import { dropImageIfUnused } from "../hobby/images.js";
import { enqueue } from "../jobs/queue.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { mediaDir, removeFiles } from "../music/files.js";
import { deletePerson } from "../people.js";
import { broadcast, groupRoom, notifyOwner, toRoom } from "../realtime/emit.js";
import { valkey, valkeyReady } from "../valkey/client.js";
import { nameBody } from "./me.js";

export const adminToolsRouter = Router();
export const reportsRouter = Router();
export const bannerRouter = Router();

// Every admin tool needs the admin
adminToolsRouter.use(async (req, _res, next) => {
  await requireAdmin(req);
  next();
});

const uuidParam = z.uuid();
const idParam = z.coerce.number().int().positive();
async function person(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, uuidParam.parse(id)));
  if (!u) throw new HttpError(404, "That person isn't here any more");
  return u;
}
const notMe = (req: { user: { id: string } | null }, id: string, what: string) => {
  if (req.user?.id === id) throw new HttpError(400, `You can't ${what} yourself here`);
};

// --- people --------------------------------------------------------------------------------------

adminToolsRouter.get("/people", async (_req, res) => {
  const devices = db
    .select({ userId: authSessions.userId, n: count().as("n"), last: max(authSessions.lastUsedAt).as("last") })
    .from(authSessions)
    .where(sql`${authSessions.expiresAt} > now()`)
    .groupBy(authSessions.userId)
    .as("d");
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      hasPin: sql<boolean>`${users.pinHash} is not null`,
      pausedUntil: users.pausedUntil,
      devices: sql<number>`coalesce(${devices.n}, 0)::int`,
    })
    .from(users)
    .leftJoin(devices, eq(devices.userId, users.id))
    .orderBy(desc(users.lastSeenAt));
  res.json(rows.map((r) => ({ ...r, pausedUntil: r.pausedUntil && r.pausedUntil.getTime() > Date.now() ? r.pausedUntil : null })));
});

adminToolsRouter.patch("/people/:id", async (req, res) => {
  const u = await person(String(req.params.id));
  const { name } = nameBody.parse(req.body);
  const [updated] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, u.id))
    .returning()
    .catch((err) => {
      throw (err as { cause?: { code?: string } })?.cause?.code === "23505" || (err as { code?: string })?.code === "23505"
        ? new HttpError(409, `Someone here is already called “${name}”.`)
        : err;
    });
  await forgetAllOf(u.id);
  await logAdmin(req, "renamed someone", `${u.name} → ${updated.name}`);
  broadcast("people:changed");
  res.json({ id: updated.id, name: updated.name });
});

adminToolsRouter.post("/people/:id/claim-code", async (req, res) => {
  const u = await person(String(req.params.id));
  const code = await makeSignInCode(u.id, "claim");
  await logAdmin(req, "made a sign-in code", u.name);
  res.status(201).json(code);
});

adminToolsRouter.post("/people/:id/sign-out", async (req, res) => {
  const u = await person(String(req.params.id));
  // the admin's own browser stays signed in
  const n = await endSessionsOf(u.id, { except: currentSessionId(req.cookies?.[COOKIE_NAME]) });
  await logAdmin(req, "signed someone out everywhere", u.name);
  res.json({ signedOut: n });
});

export const pauseBody = z.object({ days: z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(3650)]) });
export const lockBody = z.object({ locked: z.boolean() });
export const reportAction = z.object({ action: z.enum(["keep", "delete"]) });
export const bannerBody = z.object({ text: z.string().trim().max(200) });
export const confirmBody = z.object({ confirm: z.string() });

adminToolsRouter.post("/people/:id/pause", async (req, res) => {
  const u = await person(String(req.params.id));
  notMe(req, u.id, "pause");
  const { days } = pauseBody.parse(req.body);
  const until = days ? new Date(Date.now() + days * 86_400_000) : null;
  await db.update(users).set({ pausedUntil: until }).where(eq(users.id, u.id));
  await forgetAllOf(u.id);
  await logAdmin(req, days ? "paused someone" : "lifted a pause", days ? `${u.name} · ${days === 3650 ? "until lifted" : `${days} day${days > 1 ? "s" : ""}`}` : u.name);
  res.json({ pausedUntil: until });
});

adminToolsRouter.delete("/people/:id", async (req, res) => {
  const u = await person(String(req.params.id));
  notMe(req, u.id, "delete");
  const { confirm } = confirmBody.parse(req.body ?? {});
  if (confirm.trim().toLowerCase() !== u.name.toLowerCase()) throw new HttpError(400, "Type their name exactly to delete them");
  await forgetAllOf(u.id);
  await deletePerson(u.id);
  await logAdmin(req, "deleted someone", u.name);
  broadcast("people:changed");
  res.status(204).end();
});

// --- Hobby Hub groups ----------------------------------------------------------------------------

adminToolsRouter.post("/groups/:slug/lock", async (req, res) => {
  const { locked } = lockBody.parse(req.body);
  const [g] = await db.update(hobbyGroups).set({ locked }).where(eq(hobbyGroups.slug, String(req.params.slug))).returning();
  if (!g) throw new HttpError(404, "Group not found");
  await logAdmin(req, locked ? "locked a group" : "unlocked a group", g.name);
  toRoom(groupRoom(g.slug), "hobby:board", { slug: g.slug });
  broadcast("hobby:groups");
  res.json({ locked: g.locked });
});

// --- reports -------------------------------------------------------------------------------------

export const reportBody = z.object({
  kind: z.enum(["post", "comment", "message", "dm"]),
  id: z.number().int().positive(),
  reason: z.string().trim().max(200).default(""),
});
const reportLimit = rateLimit({ name: "report", windowMs: 60 * 60_000, max: 30, key: (req) => `user:${req.user?.id ?? req.ip}` });

/** What the report keeps: who wrote it, the words (or "a picture"), and where */
async function snapshot(kind: "post" | "comment" | "message" | "dm", id: number, viewerId: string) {
  if (kind === "post") {
    const [r] = await db
      .select({ body: posts.body, author: users.name, authorId: posts.authorId, where: hobbyGroups.name })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .innerJoin(hobbyGroups, eq(hobbyGroups.id, posts.groupId))
      .where(eq(posts.id, id));
    return r ? { ...r, picture: false } : null;
  }
  if (kind === "comment") {
    const [r] = await db
      .select({ body: postComments.body, author: users.name, authorId: postComments.authorId, where: hobbyGroups.name })
      .from(postComments)
      .innerJoin(users, eq(users.id, postComments.authorId))
      .innerJoin(posts, eq(posts.id, postComments.postId))
      .innerJoin(hobbyGroups, eq(hobbyGroups.id, posts.groupId))
      .where(eq(postComments.id, id));
    return r ? { ...r, picture: false } : null;
  }
  if (kind === "message") {
    const [r] = await db
      .select({ body: chatMessages.body, author: users.name, authorId: chatMessages.authorId, where: hobbyGroups.name, imageId: chatMessages.imageId })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.authorId))
      .innerJoin(hobbyGroups, eq(hobbyGroups.id, chatMessages.groupId))
      .where(eq(chatMessages.id, id));
    return r ? { ...r, picture: !!r.imageId } : null;
  }
  // a private message: only the two people in that chat can report it
  const [m] = await db
    .select({ body: directMessages.body, author: users.name, authorId: directMessages.senderId, recipientId: directMessages.recipientId, imageId: directMessages.imageId })
    .from(directMessages)
    .innerJoin(users, eq(users.id, directMessages.senderId))
    .where(eq(directMessages.id, id));
  if (!m || (m.authorId !== viewerId && m.recipientId !== viewerId)) return null;
  return { body: m.body, author: m.author, authorId: m.authorId, where: "a private chat", picture: !!m.imageId };
}

reportsRouter.post("/", requireUser, reportLimit, async (req, res) => {
  const { kind, id, reason } = reportBody.parse(req.body);
  const snap = await snapshot(kind, id, req.user!.id);
  if (!snap) throw new HttpError(404, "That's gone already");
  if (snap.authorId === req.user!.id) throw new HttpError(400, "That's yours: you can delete it yourself");
  await db
    .insert(reports)
    .values({ kind, targetId: id, reporterId: req.user!.id, authorName: snap.author, excerpt: snap.body.slice(0, 300), hasPicture: snap.picture, where: snap.where, reason })
    .onConflictDoNothing();
  res.status(201).json({ reported: true });
});

adminToolsRouter.get("/reports", async (req, res) => {
  const status = z.enum(["open", "kept", "deleted"]).default("open").parse(req.query.status);
  const rows = await db
    .select({
      id: reports.id,
      kind: reports.kind,
      targetId: reports.targetId,
      authorName: reports.authorName,
      excerpt: reports.excerpt,
      hasPicture: reports.hasPicture,
      where: reports.where,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      reporter: users.name,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(100);
  res.json(rows);
});

/** Delete what was reported, and tell the screens that show it */
async function removeReported(kind: string, id: number) {
  if (kind === "post") {
    const [p] = await db.delete(posts).where(eq(posts.id, id)).returning();
    if (p) {
      const [g] = await db.select({ slug: hobbyGroups.slug }).from(hobbyGroups).where(eq(hobbyGroups.id, p.groupId));
      if (g) toRoom(groupRoom(g.slug), "hobby:board", { slug: g.slug });
    }
  } else if (kind === "comment") {
    const [c] = await db.delete(postComments).where(eq(postComments.id, id)).returning();
    if (c) {
      const [g] = await db.select({ slug: hobbyGroups.slug }).from(posts).innerJoin(hobbyGroups, eq(hobbyGroups.id, posts.groupId)).where(eq(posts.id, c.postId));
      if (g) toRoom(groupRoom(g.slug), "hobby:board", { slug: g.slug, postId: c.postId });
    }
  } else if (kind === "message") {
    await eraseChatMessage(id, "admin"); // Stage 28: "Removed by the admin" stays in its place
  } else if (kind === "dm") {
    await eraseDirectMessage(id, "admin");
  }
}

adminToolsRouter.post("/reports/:id", async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { action } = reportAction.parse(req.body);
  const [r] = await db.select().from(reports).where(eq(reports.id, id));
  if (!r) throw new HttpError(404, "Report not found");
  if (action === "delete") await removeReported(r.kind, r.targetId);
  // every report of the same thing is settled at once
  await db
    .update(reports)
    .set({ status: action === "delete" ? "deleted" : "kept" })
    .where(and(eq(reports.kind, r.kind), eq(reports.targetId, r.targetId)));
  await logAdmin(req, action === "delete" ? "deleted something reported" : "kept something reported", `${r.authorName}: ${r.excerpt.slice(0, 80) || "(a picture)"}`);
  res.json({ status: action === "delete" ? "deleted" : "kept" });
});

// --- content --------------------------------------------------------------------------------------

adminToolsRouter.delete("/songs/:id", async (req, res) => {
  const [song] = await db.delete(songs).where(eq(songs.id, idParam.parse(req.params.id))).returning();
  if (!song) throw new HttpError(404, "Song not found");
  await removeFiles(song.fileName, song.artworkFile);
  broadcast("music:changed");
  await logAdmin(req, "deleted a song", `${song.title} · ${song.artist}`);
  res.status(204).end();
});

adminToolsRouter.get("/scores", async (_req, res) => {
  const rows = await db
    .select({ id: gameScores.id, game: gameScores.game, score: gameScores.score, name: users.name, createdAt: gameScores.createdAt })
    .from(gameScores)
    .leftJoin(users, eq(users.id, gameScores.userId))
    .orderBy(desc(gameScores.score))
    .limit(100);
  res.json(rows.map((r) => ({ ...r, name: r.name ?? "a guest" })));
});

adminToolsRouter.delete("/scores/:id", async (req, res) => {
  const [s] = await db.delete(gameScores).where(eq(gameScores.id, idParam.parse(req.params.id))).returning();
  if (!s) throw new HttpError(404, "Score not found");
  await logAdmin(req, "removed a score", `${s.game}: ${s.score}`);
  res.status(204).end();
});

// --- Nook: banner, storage, cleanup, log -----------------------------------------------------------

const BANNER = "banner";
bannerRouter.get("/", async (_req, res) => {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, BANNER));
  const text = (row?.value as { text?: string } | undefined)?.text ?? "";
  res.json({ text: text || null });
});

adminToolsRouter.put("/banner", async (req, res) => {
  const { text } = bannerBody.parse(req.body);
  await db
    .insert(siteSettings)
    .values({ key: BANNER, value: { text } })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: { text }, updatedAt: new Date() } });
  await logAdmin(req, text ? "set the banner" : "removed the banner", text);
  broadcast("banner:changed", { text: text || null });
  res.json({ text: text || null });
});

async function folderSize(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await folderSize(p);
      bytes += sub.bytes;
      files += sub.files;
    } else if (e.isFile()) {
      bytes += (await stat(p).catch(() => ({ size: 0 }))).size;
      files++;
    }
  }
  return { bytes, files };
}

adminToolsRouter.get("/storage", async (_req, res) => {
  const chat = await folderSize(path.join(mediaDir, "chat"));
  const all = await folderSize(mediaDir);
  const disk = await statfs(mediaDir).catch(() => null);
  res.json({
    songs: { bytes: all.bytes - chat.bytes, files: all.files - chat.files },
    pictures: chat,
    disk: disk ? { free: disk.bavail * disk.bsize, total: disk.blocks * disk.bsize } : null,
  });
});

adminToolsRouter.post("/cleanup", async (req, res) => {
  const queued = await enqueue("cleanup", {});
  await logAdmin(req, "ran the cleanup");
  res.json({ queued });
});

adminToolsRouter.get("/log", async (_req, res) => {
  res.json(await db.select().from(adminLog).orderBy(desc(adminLog.id)).limit(200));
});

// Stage 28: who came in (new name, PIN, code, claim code), when, on what kind of device. Nothing else.
adminToolsRouter.get("/sign-ins", async (_req, res) => {
  res.json(
    await db
      .select({ id: signIns.id, name: signIns.name, how: signIns.how, userAgent: signIns.userAgent, at: signIns.at })
      .from(signIns)
      .orderBy(desc(signIns.id))
      .limit(200),
  );
});

// --- health ---------------------------------------------------------------------------------------

type Check = "working" | "not reachable" | "off";
async function within<T>(ms: number, p: Promise<T>): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

adminToolsRouter.get("/health", async (_req, res) => {
  const database: Check = (await within(2000, db.execute(sql`select 1`))) ? "working" : "not reachable";
  const valkeyCheck: Check = valkeyReady() && (await within(1500, valkey.ping())) === "PONG" ? "working" : "not reachable";
  const arena = await within(
    2000,
    fetch(`${config.ARENA_URL}/api/arena/?EIO=4&transport=polling`).then((r) => r.ok),
  );
  const ai = await within(3000, aiStatus());
  const disk = await statfs(mediaDir).catch(() => null);
  res.json({
    database,
    valkey: valkeyCheck,
    gameServer: arena ? "working" : "not reachable",
    ai: !ai || !ai.enabled ? "off" : !ai.reachable ? "not reachable" : ai.models.chat && ai.models.embed ? "working" : "getting ready",
    disk: disk ? { free: disk.bavail * disk.bsize, total: disk.blocks * disk.bsize } : null,
  });
});

