// Stage 21: private chats in Hobby Hub, pictures in chats, and the unread badge.
//
// GET    /api/hobby/unread                       { messages, groups }: the Hobby Hub badge (0s for guests)
// GET    /api/hobby/people?q=                    people with a name, to start a private chat with
// GET    /api/hobby/dms                          your private chats: the other person, last message, unread
// GET    /api/hobby/dms/:userId?before=id        one private chat, 50 messages at a time, oldest first
// POST   /api/hobby/dms/:userId  { body, imageId? }   send
// PUT    /api/hobby/dms/:userId/read             "I've read this chat"
// DELETE /api/hobby/dms/messages/:id             delete your message ("Message deleted" stays, Stage 28)
// PATCH  /api/hobby/dms/messages/:id  { body }   edit your message within 10 minutes (Stage 28)
// POST   /api/hobby/images   (multipart: file)   upload a picture, then send its id with a message
// GET    /api/hobby/images/:id                   a picture, for the people who may see it
//
// Who can read a private chat through Nook: only the two people in it. (Whoever runs the Nook PC can
// read its database: README says so.) Live: "dm:message", "dm:deleted", "dm:read" and "dm:typing" go
// to each person's own room (user:<id>), so every tab and device they have open gets them.

import { createReadStream } from "node:fs";
import { and, desc, eq, ilike, isNull, lt, ne, or, sql } from "drizzle-orm";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { db } from "../db/client.js";
import { chatImages, directMessages, users } from "../db/schema.js";
import { imageJson, imagePath, inspectImage, MAX_IMAGE_MB, saveImage } from "../hobby/images.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { notifyOwner } from "../realtime/emit.js";
import { canStillEdit, eraseDirectMessage } from "../hobby/erase.js";
import { beforeQuery, editBody, messageBody, ownImage } from "./hobby.js";

export const messagesRouter = Router();

const perUser = (name: string, windowMs: number, max: number) => rateLimit({ name, windowMs, max, key: (req) => `user:${req.user?.id ?? "none"}` });
const toUser = (userId: string, event: string, payload: unknown) => notifyOwner({ userId, clientId: null }, event, payload);
const userIdParam = z.uuid({ message: "Unknown person" });
const PAGE = 50;

async function otherPerson(id: string, me: string) {
  const parsed = userIdParam.safeParse(id);
  if (!parsed.success) throw new HttpError(404, "Person not found");
  if (parsed.data === me) throw new HttpError(400, "That's you");
  const [person] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, parsed.data));
  if (!person) throw new HttpError(404, "Person not found");
  return person;
}

// Messages between a and b, either direction
const between = (a: string, b: string) =>
  or(and(eq(directMessages.senderId, a), eq(directMessages.recipientId, b)), and(eq(directMessages.senderId, b), eq(directMessages.recipientId, a)));

// --- the badge ---------------------------------------------------------------------------

messagesRouter.get("/unread", async (req, res) => {
  if (!req.user) return void res.json({ messages: 0, groups: 0 });
  const me = req.user.id;
  const [row] = (
    await db.execute<{ messages: number; groups: number }>(sql`
      select
        (select count(*)::int from direct_messages where recipient_id = ${me} and read_at is null and deleted_by is null) as messages,
        (select coalesce(sum(
            (select count(*) from posts p where p.group_id = gm.group_id and p.created_at > gm.last_read_at and p.author_id <> ${me})
          + (select count(*) from chat_messages c where c.group_id = gm.group_id and c.created_at > gm.last_read_at and c.author_id <> ${me})
         ), 0)::int from group_members gm where gm.user_id = ${me}) as groups`)
  ).rows;
  res.json(row);
});

// --- people ------------------------------------------------------------------------------

export const peopleQuery = z.object({ q: z.string().trim().max(40).default("") });

messagesRouter.get("/people", requireUser, async (req, res) => {
  const { q } = peopleQuery.parse(req.query);
  const rows = await db
    .select({ id: users.id, name: users.name, lastSeenAt: users.lastSeenAt })
    .from(users)
    .where(and(ne(users.id, req.user!.id), q ? ilike(users.name, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`) : undefined))
    .orderBy(desc(users.lastSeenAt))
    .limit(30);
  res.json(rows);
});

// --- private chats -----------------------------------------------------------------------

messagesRouter.get("/dms", requireUser, async (req, res) => {
  const me = req.user!.id;
  // One row per person you've talked with: the newest message between you, and how many you haven't read
  const rows = (
    await db.execute<{
      id: string;
      name: string;
      lastBody: string;
      lastImage: boolean;
      lastDeleted: boolean;
      lastMine: boolean;
      lastAt: string;
      unread: number;
    }>(sql`
      with mine as (
        select case when sender_id = ${me} then recipient_id else sender_id end as other, *
        from direct_messages where sender_id = ${me} or recipient_id = ${me}
      ), latest as (
        select distinct on (other) other, body, image_id, sender_id, created_at, deleted_by from mine order by other, id desc
      )
      select u.id, u.name, l.body as "lastBody", l.image_id is not null as "lastImage", l.deleted_by is not null as "lastDeleted", l.sender_id = ${me} as "lastMine",
        l.created_at as "lastAt",
        (select count(*)::int from direct_messages d where d.sender_id = u.id and d.recipient_id = ${me} and d.read_at is null and d.deleted_by is null) as unread
      from latest l join users u on u.id = l.other
      order by l.created_at desc`)
  ).rows;
  res.json(rows);
});

messagesRouter.get("/dms/:userId", requireUser, async (req, res) => {
  const me = req.user!.id;
  const person = await otherPerson(String(req.params.userId), me);
  const { before } = beforeQuery.parse(req.query);
  const rows = await db
    .select({
      id: directMessages.id,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      deletedBy: directMessages.deletedBy,
      editedAt: directMessages.editedAt,
      senderId: directMessages.senderId,
      image: { id: chatImages.id, width: chatImages.width, height: chatImages.height },
    })
    .from(directMessages)
    .leftJoin(chatImages, eq(chatImages.id, directMessages.imageId))
    .where(and(between(me, person.id), before ? lt(directMessages.id, before) : undefined))
    .orderBy(desc(directMessages.id))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE).reverse();
  res.json({
    person,
    messages: page.map(({ senderId, image, ...m }) => ({ ...m, image: imageJson(image?.id ? image : null), mine: senderId === me })),
    more: rows.length > PAGE,
  });
});

// Same speed limit as group chat: 20 messages per 30 seconds
messagesRouter.post("/dms/:userId", requireUser, perUser("dm", 30_000, 20), async (req, res) => {
  const me = req.user!;
  const person = await otherPerson(String(req.params.userId), me.id);
  const { body, imageId } = messageBody.parse(req.body);
  const img = await ownImage(imageId, me.id);
  const [m] = await db
    .insert(directMessages)
    .values({ senderId: me.id, recipientId: person.id, body, imageId: img?.id ?? null })
    .returning();
  const message = { id: m.id, body: m.body, createdAt: m.createdAt, readAt: null, deletedBy: null, editedAt: null, image: imageJson(img) };
  res.status(201).json({ ...message, mine: true });
  // Both people's tabs: the sender's other tabs show it too
  toUser(person.id, "dm:message", { from: { id: me.id, name: me.name }, with: me.id, message: { ...message, mine: false } });
  toUser(me.id, "dm:message", { from: { id: me.id, name: me.name }, with: person.id, message: { ...message, mine: true } });
});

messagesRouter.put("/dms/:userId/read", requireUser, async (req, res) => {
  const me = req.user!.id;
  const person = await otherPerson(String(req.params.userId), me);
  const read = await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(and(eq(directMessages.senderId, person.id), eq(directMessages.recipientId, me), isNull(directMessages.readAt)))
    .returning({ id: directMessages.id });
  res.status(204).end();
  toUser(me, "dm:read", { with: person.id, by: me }); // my other tabs: badge down
  if (read.length) toUser(person.id, "dm:read", { with: me, by: me }); // they see "Seen"
});

messagesRouter.delete("/dms/messages/:id", requireUser, async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [m] = await db.select().from(directMessages).where(eq(directMessages.id, id));
  if (!m || (m.senderId !== req.user!.id && m.recipientId !== req.user!.id)) throw new HttpError(404, "Message not found");
  if (m.senderId !== req.user!.id) throw new HttpError(403, "You can only delete your own messages");
  await eraseDirectMessage(id, "author"); // Stage 28: "Message deleted" stays in its place
  res.status(204).end();
});

// Stage 28: change your own message within 10 minutes
messagesRouter.patch("/dms/messages/:id", requireUser, async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { body } = editBody.parse(req.body);
  const [m] = await db.select().from(directMessages).where(eq(directMessages.id, id));
  if (!m || m.deletedBy || (m.senderId !== req.user!.id && m.recipientId !== req.user!.id)) throw new HttpError(404, "Message not found");
  if (m.senderId !== req.user!.id) throw new HttpError(403, "You can only edit your own messages");
  if (!canStillEdit(m.createdAt)) throw new HttpError(409, "Messages can only be edited for 10 minutes");
  const [e] = await db.update(directMessages).set({ body, editedAt: new Date() }).where(eq(directMessages.id, id)).returning();
  res.json({ id: e.id, body: e.body, editedAt: e.editedAt });
  toUser(m.senderId, "dm:edited", { with: m.recipientId, id, body: e.body, editedAt: e.editedAt });
  toUser(m.recipientId, "dm:edited", { with: m.senderId, id, body: e.body, editedAt: e.editedAt });
});

// --- pictures ----------------------------------------------------------------------------

// Pictures are small (the browser shrinks them first), so they're read into memory, not a temp file.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1, fields: 0 } }).single("file");

// 60 pictures per 10 minutes per person
messagesRouter.post(
  "/images",
  requireUser,
  perUser("chat-image", 10 * 60 * 1000, 60),
  (req, res, next) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        return next(
          new HttpError(err.code === "LIMIT_FILE_SIZE" ? 413 : 400, err.code === "LIMIT_FILE_SIZE" ? `Pictures can be up to ${MAX_IMAGE_MB} MB` : err.message),
        );
      }
      next(err);
    });
  },
  async (req, res) => {
    if (!req.file) throw new HttpError(400, "Choose a picture");
    const info = inspectImage(req.file.buffer);
    if (!info) throw new HttpError(415, "That isn't a picture Nook can show (JPEG, PNG, WebP or GIF)");
    const img = await saveImage(req.user!.id, req.file.buffer, info);
    res.status(201).json(imageJson(img));
  },
);

messagesRouter.get("/images/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(404, "Picture not found");
  const me = req.user?.id ?? null;
  // Who may see it: anyone if it's in a group chat (those are open to read), the two people if it's in a
  // private chat, and always the person who uploaded it.
  const [img] = (
    await db.execute<{ id: string; type: string; bytes: number }>(sql`
      select i.id, i.type, i.bytes from chat_images i
      where i.id = ${id.data} and (
        i.uploader_id = ${me}
        or exists (select 1 from chat_messages c where c.image_id = i.id)
        or exists (select 1 from direct_messages d where d.image_id = i.id and (d.sender_id = ${me} or d.recipient_id = ${me}))
      )`)
  ).rows;
  if (!img) throw new HttpError(404, "Picture not found");
  res.set({
    "Content-Type": img.type,
    "Content-Length": String(img.bytes),
    // A picture never changes (a new one gets a new id); "private" keeps shared caches from storing it
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  createReadStream(imagePath(img.id, img.type))
    .on("error", () => res.destroy())
    .pipe(res);
});
