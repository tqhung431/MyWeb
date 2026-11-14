// Hobby Hub (Stage 11): groups, each with a board of posts (comments, likes) and a live chat.
//
// Reading is open to everyone on this Nook; writing needs a name (requireUser).
//
// GET    /api/hobby/groups                         all groups, with members / posts / last activity
// POST   /api/hobby/groups   { name, emoji, description }   start a group
// GET    /api/hobby/groups/:slug                   one group
// DELETE /api/hobby/groups/:slug                   delete a group you started
// PUT    /api/hobby/groups/:slug/membership        join      DELETE … leave
// PUT    /api/hobby/groups/:slug/read              "I've seen everything here" (unread back to 0)
// GET    /api/hobby/groups/:slug/posts?before=id   the board, newest first, 20 at a time
// POST   /api/hobby/groups/:slug/posts   { body }  write a post
// DELETE /api/hobby/posts/:id                      delete your post
// PUT    /api/hobby/posts/:id/like                 like      DELETE … unlike
// GET    /api/hobby/posts/:id/comments             a post's comments, oldest first
// POST   /api/hobby/posts/:id/comments   { body }  comment
// DELETE /api/hobby/comments/:id                   delete your comment
// GET    /api/hobby/groups/:slug/messages?before=id   chat history, 50 at a time
// POST   /api/hobby/groups/:slug/messages { body, imageId? }  send a chat message (everyone in the room sees it at once)
// DELETE /api/hobby/messages/:id                       delete your message ("Message deleted" stays, Stage 28)
// PATCH  /api/hobby/messages/:id  { body }              edit your message within 10 minutes (Stage 28)
//
// Live (Socket.IO, see realtime/server.ts): browsers on a group's page join the room "group:<slug>"
// and get hobby:message, hobby:message-deleted, hobby:board and hobby:typing there.
//
// Stage 21: joining matters. Only members post, comment and chat (anyone can still read and like);
// joined groups come first with an unread count, and members get "hobby:unread" in their own room
// when something new arrives. Private chats and pictures: routes/messages.ts.

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { chatImages, chatMessages, groupMembers, hobbyGroups, postComments, postLikes, posts, users, type User } from "../db/schema.js";
import { canStillEdit, eraseChatMessage } from "../hobby/erase.js";
import { dropImageIfUnused, imageJson } from "../hobby/images.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { isAdmin, logAdmin } from "../admin.js";
import { rateLimit } from "../middleware/security.js";
import { broadcast, groupRoom, leaveRoom, ownerRoom, toRoom } from "../realtime/emit.js";

export const hobbyRouter = Router();

// --- helpers ------------------------------------------------------------------------

const text = (max: number, what: string) =>
  z
    .string()
    .transform((s) =>
      s
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    )
    .pipe(z.string().min(1, `Write a ${what}`).max(max, `Keep it under ${max} characters`));

const idParam = z.coerce.number().int().positive();
export const beforeQuery = z.object({ before: z.coerce.number().int().positive().optional() });

async function groupBySlug(slug: string) {
  const [group] = await db.select().from(hobbyGroups).where(eq(hobbyGroups.slug, slug));
  if (!group) throw new HttpError(404, "Group not found");
  return group;
}

const perUser = (name: string, windowMs: number, max: number) => rateLimit({ name, windowMs, max, key: (req) => `user:${req.user?.id ?? "none"}` });

// "Board Games & Puzzles" → "board-games-puzzles"; "Nấu ăn" → "nau-an"
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents off
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!slug) return "group";
  return RESERVED.has(slug) ? `${slug}-group` : slug;
}

// Addresses Hobby Hub's own pages use: /hobby-hub/messages is the private chats, not a group
const RESERVED = new Set(["messages", "new", "settings"]);

const author = (u: Pick<User, "id" | "name">) => ({ id: u.id, name: u.name });

async function isMember(groupId: number, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ one: sql`1` })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  return !!row;
}

// Stage 21: writing needs membership. The page shows a "Join" button instead of the box, so this is
// only reached by an old page or a script.
async function requireMember(groupId: number, userId: string, what: string) {
  // Stage 27: a group the admin locked can be read, not written in
  const [g] = await db.select({ locked: hobbyGroups.locked }).from(hobbyGroups).where(eq(hobbyGroups.id, groupId));
  if (g?.locked) throw new HttpError(403, "The admin locked this group: you can read it, but not post or chat");
  if (!(await isMember(groupId, userId))) throw new HttpError(403, `Join this group to ${what}`);
}

// Stage 29: a group is for its members. Others see its name, emoji, description and member count, and a Join
// button; its posts, comments, chat and pictures need membership (anyone can join). The admin can read every group.
async function canRead(req: Request, groupId: number): Promise<boolean> {
  if (req.user && (await isMember(groupId, req.user.id))) return true;
  return isAdmin(req);
}
async function requireReader(req: Request, groupId: number) {
  if (!(await canRead(req, groupId))) throw new HttpError(403, "Join this group to see its posts and chat");
}

// "Something new in this group": each member (except the author) re-counts their unread badge.
async function tellMembers(groupId: number, slug: string, authorId: string) {
  const members = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  for (const m of members) if (m.userId !== authorId) toRoom(ownerRoom({ userId: m.userId, clientId: null }), "hobby:unread", { slug });
}

// --- groups ---------------------------------------------------------------------------

hobbyRouter.get("/groups", async (req, res) => {
  const me = req.user?.id ?? null;
  // Plain SQL with table names written out: inside the small "sub-queries" (one per group),
  // "g.id" must clearly mean the group's id, not the id of a post or member.
  const result = await db.execute<{
    id: number;
    slug: string;
    name: string;
    emoji: string;
    description: string;
    createdAt: string;
    members: number;
    posts: number;
    lastActivity: string | null;
    joined: boolean;
    mine: boolean;
    unread: number;
    locked: boolean;
  }>(sql`
    select g.id, g.slug, g.name, g.emoji, g.description, g.created_at as "createdAt", g.locked,
      (select count(*)::int from group_members gm where gm.group_id = g.id) as members,
      (select count(*)::int from posts p where p.group_id = g.id) as posts,
      greatest(
        (select max(p.created_at) from posts p where p.group_id = g.id),
        (select max(c.created_at) from chat_messages c where c.group_id = g.id)
      ) as "lastActivity",
      exists (select 1 from group_members gm where gm.group_id = g.id and gm.user_id = ${me}) as joined,
      coalesce(g.created_by = ${me}, false) as mine,
      coalesce((
        select (select count(*) from posts p where p.group_id = g.id and p.created_at > gm.last_read_at and p.author_id <> gm.user_id)
             + (select count(*) from chat_messages c where c.group_id = g.id and c.created_at > gm.last_read_at and c.author_id <> gm.user_id)
        from group_members gm where gm.group_id = g.id and gm.user_id = ${me}
      ), 0)::int as unread
    from hobby_groups g
    order by g.created_at, g.id`);
  res.json(result.rows);
});

export const newGroup = z.object({
  name: text(40, "group name"),
  emoji: z
    .string()
    .trim()
    .min(1, "Pick an emoji")
    .max(16)
    .refine((e) => !/[\p{L}\p{N}<>]/u.test(e), "Use an emoji"),
  description: z.string().trim().max(200, "Keep it under 200 characters").default(""),
});

hobbyRouter.post("/groups", requireUser, perUser("group-new", 60 * 60 * 1000, 5), async (req, res) => {
  const input = newGroup.parse(req.body);
  const [same] = await db
    .select({ id: hobbyGroups.id })
    .from(hobbyGroups)
    .where(sql`lower(${hobbyGroups.name}) = lower(${input.name})`);
  if (same) throw new HttpError(409, `There's already a group called “${input.name}”`);

  // A free slug: "cooking", else "cooking-2", "cooking-3"…
  const base = slugify(input.name);
  const used = new Set(
    (
      await db
        .select({ slug: hobbyGroups.slug })
        .from(hobbyGroups)
        .where(sql`${hobbyGroups.slug} like ${`${base}%`}`)
    ).map((r) => r.slug),
  );
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;

  const [group] = await db
    .insert(hobbyGroups)
    .values({ ...input, slug, createdBy: req.user!.id })
    .returning();
  await db.insert(groupMembers).values({ groupId: group.id, userId: req.user!.id }).onConflictDoNothing();
  res.status(201).json(group);

  broadcast("hobby:groups"); // Stage 29: groups are members-only, so nothing about them goes in the public feed
});

hobbyRouter.get("/groups/:slug", async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const all = await db
    .select({ id: users.id, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, group.id))
    .orderBy(groupMembers.joinedAt);
  const joined = req.user ? all.some((m) => m.id === req.user!.id) : false;
  const reader = joined || (await isAdmin(req));
  res.json({
    ...group,
    members: reader ? all : [], // Stage 29: who's in it is for its members too
    memberCount: all.length,
    joined,
    canRead: reader,
    mine: req.user !== null && group.createdBy === req.user.id,
  });
});

hobbyRouter.delete("/groups/:slug", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const admin = group.createdBy !== req.user!.id && (await isAdmin(req)); // Stage 27: the admin can delete any group
  if (group.createdBy !== req.user!.id && !admin) throw new HttpError(403, "Only the person who started this group can delete it");
  await db.delete(hobbyGroups).where(eq(hobbyGroups.id, group.id));
  if (admin) await logAdmin(req, "deleted a group", group.name);
  res.status(204).end();
  broadcast("hobby:groups");
  toRoom(groupRoom(group.slug), "hobby:board", { slug: group.slug, deleted: true });
});

hobbyRouter.put("/groups/:slug/membership", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const added = await db.insert(groupMembers).values({ groupId: group.id, userId: req.user!.id }).onConflictDoNothing().returning();
  res.json({ joined: true });
  broadcast("hobby:groups");
  toRoom(groupRoom(group.slug), "hobby:board", { slug: group.slug, members: true });
  if (added.length) toRoom(ownerRoom({ userId: req.user!.id, clientId: null }), "hobby:unread", { slug: group.slug });
});

hobbyRouter.delete("/groups/:slug/membership", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, req.user!.id)));
  res.json({ joined: false });
  broadcast("hobby:groups");
  toRoom(groupRoom(group.slug), "hobby:board", { slug: group.slug, members: true });
  toRoom(ownerRoom({ userId: req.user!.id, clientId: null }), "hobby:unread", { slug: group.slug });
  leaveRoom(ownerRoom({ userId: req.user!.id, clientId: null }), groupRoom(group.slug)); // Stage 29: no more live posts or chat
});

// Stage 21: the group's page is open → everything in it counts as read
hobbyRouter.put("/groups/:slug/read", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  await db
    .update(groupMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, req.user!.id)));
  res.status(204).end();
  toRoom(ownerRoom({ userId: req.user!.id, clientId: null }), "hobby:unread", { slug: group.slug }); // other tabs
});

// --- posts ----------------------------------------------------------------------------

const PAGE = 20;

function postColumns(me: string | null) {
  return {
    id: posts.id,
    body: posts.body,
    createdAt: posts.createdAt,
    author: { id: users.id, name: users.name },
    likes: sql<number>`(select count(*)::int from ${postLikes} where ${postLikes.postId} = ${posts.id})`,
    comments: sql<number>`(select count(*)::int from ${postComments} where ${postComments.postId} = ${posts.id})`,
    liked: me ? sql<boolean>`exists (select 1 from ${postLikes} where ${postLikes.postId} = ${posts.id} and ${postLikes.userId} = ${me})` : sql<boolean>`false`,
  };
}

hobbyRouter.get("/groups/:slug/posts", async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  await requireReader(req, group.id);
  const { before } = beforeQuery.parse(req.query);
  const rows = await db
    .select(postColumns(req.user?.id ?? null))
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.groupId, group.id), before ? lt(posts.id, before) : undefined))
    .orderBy(desc(posts.id))
    .limit(PAGE + 1); // one extra tells us if there's another page
  res.json({ posts: rows.slice(0, PAGE).map((p) => ({ ...p, mine: p.author.id === req.user?.id })), more: rows.length > PAGE });
});

export const postBody = z.object({ body: text(4000, "post") });

hobbyRouter.post("/groups/:slug/posts", requireUser, perUser("post-new", 10 * 60 * 1000, 10), async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const { body } = postBody.parse(req.body);
  await requireMember(group.id, req.user!.id, "post");
  const [post] = await db.insert(posts).values({ groupId: group.id, authorId: req.user!.id, body }).returning();
  res.status(201).json({ ...post, author: author(req.user!), likes: 0, comments: 0, liked: false, mine: true });

  toRoom(groupRoom(group.slug), "hobby:board", { slug: group.slug });
  broadcast("hobby:groups");
  await tellMembers(group.id, group.slug, req.user!.id);
});

async function postWithGroup(id: number) {
  const [row] = await db
    .select({ post: posts, slug: hobbyGroups.slug })
    .from(posts)
    .innerJoin(hobbyGroups, eq(hobbyGroups.id, posts.groupId))
    .where(eq(posts.id, id));
  if (!row) throw new HttpError(404, "Post not found");
  return row;
}

hobbyRouter.delete("/posts/:id", requireUser, async (req, res) => {
  const { post, slug } = await postWithGroup(idParam.parse(req.params.id));
  const admin = post.authorId !== req.user!.id && (await isAdmin(req));
  if (post.authorId !== req.user!.id && !admin) throw new HttpError(403, "You can only delete your own posts");
  await db.delete(posts).where(eq(posts.id, post.id));
  if (admin) await logAdmin(req, "deleted a post", `${slug}: ${post.body.slice(0, 80)}`);
  res.status(204).end();
  toRoom(groupRoom(slug), "hobby:board", { slug });
  broadcast("hobby:groups");
});

async function likeCount(postId: number) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(postLikes)
    .where(eq(postLikes.postId, postId));
  return n;
}

hobbyRouter.put("/posts/:id/like", requireUser, async (req, res) => {
  const { post, slug } = await postWithGroup(idParam.parse(req.params.id));
  await requireReader(req, post.groupId);
  await db.insert(postLikes).values({ postId: post.id, userId: req.user!.id }).onConflictDoNothing();
  res.json({ liked: true, likes: await likeCount(post.id) });
  toRoom(groupRoom(slug), "hobby:board", { slug, postId: post.id });
});

hobbyRouter.delete("/posts/:id/like", requireUser, async (req, res) => {
  const { post, slug } = await postWithGroup(idParam.parse(req.params.id));
  await db.delete(postLikes).where(and(eq(postLikes.postId, post.id), eq(postLikes.userId, req.user!.id)));
  res.json({ liked: false, likes: await likeCount(post.id) });
  toRoom(groupRoom(slug), "hobby:board", { slug, postId: post.id });
});

// --- comments ---------------------------------------------------------------------------

hobbyRouter.get("/posts/:id/comments", async (req, res) => {
  const { post } = await postWithGroup(idParam.parse(req.params.id));
  await requireReader(req, post.groupId);
  const rows = await db
    .select({ id: postComments.id, body: postComments.body, createdAt: postComments.createdAt, author: { id: users.id, name: users.name } })
    .from(postComments)
    .innerJoin(users, eq(users.id, postComments.authorId))
    .where(eq(postComments.postId, post.id))
    .orderBy(postComments.id)
    .limit(200);
  res.json(rows.map((c) => ({ ...c, mine: c.author.id === req.user?.id })));
});

export const commentBody = z.object({ body: text(1000, "comment") });

hobbyRouter.post("/posts/:id/comments", requireUser, perUser("comment-new", 5 * 60 * 1000, 30), async (req, res) => {
  const { post, slug } = await postWithGroup(idParam.parse(req.params.id));
  const { body } = commentBody.parse(req.body);
  await requireMember(post.groupId, req.user!.id, "comment");
  const [comment] = await db.insert(postComments).values({ postId: post.id, authorId: req.user!.id, body }).returning();
  res.status(201).json({ id: comment.id, body: comment.body, createdAt: comment.createdAt, author: author(req.user!), mine: true });
  toRoom(groupRoom(slug), "hobby:board", { slug, postId: post.id });
});

hobbyRouter.delete("/comments/:id", requireUser, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const [row] = await db
    .select({ comment: postComments, slug: hobbyGroups.slug })
    .from(postComments)
    .innerJoin(posts, eq(posts.id, postComments.postId))
    .innerJoin(hobbyGroups, eq(hobbyGroups.id, posts.groupId))
    .where(eq(postComments.id, id));
  if (!row) throw new HttpError(404, "Comment not found");
  const admin = row.comment.authorId !== req.user!.id && (await isAdmin(req));
  if (row.comment.authorId !== req.user!.id && !admin) throw new HttpError(403, "You can only delete your own comments");
  await db.delete(postComments).where(eq(postComments.id, id));
  if (admin) await logAdmin(req, "deleted a comment", `${row.slug}: ${row.comment.body.slice(0, 80)}`);
  res.status(204).end();
  toRoom(groupRoom(row.slug), "hobby:board", { slug: row.slug, postId: row.comment.postId });
});

// --- chat -------------------------------------------------------------------------------

const CHAT_PAGE = 50;

hobbyRouter.get("/groups/:slug/messages", async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  await requireReader(req, group.id);
  const { before } = beforeQuery.parse(req.query);
  const rows = await db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      deletedBy: chatMessages.deletedBy,
      editedAt: chatMessages.editedAt,
      author: { id: users.id, name: users.name },
      image: { id: chatImages.id, width: chatImages.width, height: chatImages.height },
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .leftJoin(chatImages, eq(chatImages.id, chatMessages.imageId))
    .where(and(eq(chatMessages.groupId, group.id), before ? lt(chatMessages.id, before) : undefined))
    .orderBy(desc(chatMessages.id))
    .limit(CHAT_PAGE + 1);
  const page = rows.slice(0, CHAT_PAGE).reverse(); // oldest first, like a chat
  res.json({
    messages: page.map((m) => ({ ...m, image: imageJson(m.image?.id ? m.image : null), mine: m.author.id === req.user?.id })),
    more: rows.length > CHAT_PAGE,
  });
});

// Stage 21: a message is words, a picture (uploaded first: POST /api/hobby/images), or both
export const messageBody = z
  .object({
    body: z
      .string()
      .default("")
      .transform((s) =>
        s
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
      )
      .pipe(z.string().max(1000, "Keep it under 1000 characters")),
    imageId: z.uuid().optional(),
  })
  .refine((m) => m.body.length > 0 || m.imageId, { message: "Write a message", path: ["body"] });

// The picture must be one this person uploaded
export async function ownImage(imageId: string | undefined, userId: string) {
  if (!imageId) return null;
  const [img] = await db.select().from(chatImages).where(eq(chatImages.id, imageId));
  if (!img || img.uploaderId !== userId) throw new HttpError(400, "Picture not found: send it again");
  return img;
}

// 20 messages per 30 seconds: plenty for a chat, too few for a flood.
hobbyRouter.post("/groups/:slug/messages", requireUser, perUser("chat", 30_000, 20), async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const { body, imageId } = messageBody.parse(req.body);
  await requireMember(group.id, req.user!.id, "chat");
  const img = await ownImage(imageId, req.user!.id);
  const [m] = await db
    .insert(chatMessages)
    .values({ groupId: group.id, authorId: req.user!.id, body, imageId: img?.id ?? null })
    .returning();
  const message = { id: m.id, body: m.body, createdAt: m.createdAt, deletedBy: null, editedAt: null, author: author(req.user!), image: imageJson(img) };
  res.status(201).json({ ...message, mine: true });
  // Everyone with this group open gets it at once ("mine" is worked out by each browser)
  toRoom(groupRoom(group.slug), "hobby:message", { slug: group.slug, message });
  await tellMembers(group.id, group.slug, req.user!.id);
});

hobbyRouter.delete("/messages/:id", requireUser, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const [row] = await db
    .select({ message: chatMessages, slug: hobbyGroups.slug })
    .from(chatMessages)
    .innerJoin(hobbyGroups, eq(hobbyGroups.id, chatMessages.groupId))
    .where(eq(chatMessages.id, id));
  if (!row) throw new HttpError(404, "Message not found");
  const admin = row.message.authorId !== req.user!.id && (await isAdmin(req));
  if (row.message.authorId !== req.user!.id && !admin) throw new HttpError(403, "You can only delete your own messages");
  // Stage 28: "Message deleted" stays in its place; the words and the picture are gone for good
  await eraseChatMessage(id, admin ? "admin" : "author");
  if (admin) await logAdmin(req, "deleted a chat message", `${row.slug}: ${row.message.body.slice(0, 80) || "(a picture)"}`);
  res.status(204).end();
});

// Stage 28: change your own message within 10 minutes; everyone sees "edited"
export const editBody = z.object({
  body: z
    .string()
    .transform((s) => s.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().min(1, "Write a message").max(1000, "Keep it under 1000 characters")),
});

hobbyRouter.patch("/messages/:id", requireUser, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { body } = editBody.parse(req.body);
  const [row] = await db
    .select({ message: chatMessages, slug: hobbyGroups.slug, locked: hobbyGroups.locked })
    .from(chatMessages)
    .innerJoin(hobbyGroups, eq(hobbyGroups.id, chatMessages.groupId))
    .where(eq(chatMessages.id, id));
  if (!row || row.message.deletedBy) throw new HttpError(404, "Message not found");
  if (row.message.authorId !== req.user!.id) throw new HttpError(403, "You can only edit your own messages");
  if (!canStillEdit(row.message.createdAt)) throw new HttpError(409, "Messages can only be edited for 10 minutes");
  if (row.locked) throw new HttpError(403, "The admin locked this group: you can read it, but not post or chat");
  const [m] = await db.update(chatMessages).set({ body, editedAt: new Date() }).where(eq(chatMessages.id, id)).returning();
  res.json({ id: m.id, body: m.body, editedAt: m.editedAt });
  toRoom(groupRoom(row.slug), "hobby:message-edited", { slug: row.slug, id: m.id, body: m.body, editedAt: m.editedAt });
});
