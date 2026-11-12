// Hobby Hub (Stage 11): groups, each with a board of posts (comments, likes) and a live chat.
//
// Reading is open to everyone on this Nook; writing needs a name (requireUser).
//
// GET    /api/hobby/groups                         all groups, with members / posts / last activity
// POST   /api/hobby/groups   { name, emoji, description }   start a group
// GET    /api/hobby/groups/:slug                   one group
// DELETE /api/hobby/groups/:slug                   delete a group you started
// PUT    /api/hobby/groups/:slug/membership        join      DELETE … leave
// GET    /api/hobby/groups/:slug/posts?before=id   the board, newest first, 20 at a time
// POST   /api/hobby/groups/:slug/posts   { body }  write a post
// DELETE /api/hobby/posts/:id                      delete your post
// PUT    /api/hobby/posts/:id/like                 like      DELETE … unlike
// GET    /api/hobby/posts/:id/comments             a post's comments, oldest first
// POST   /api/hobby/posts/:id/comments   { body }  comment
// DELETE /api/hobby/comments/:id                   delete your comment
// GET    /api/hobby/groups/:slug/messages?before=id   chat history, 50 at a time
// POST   /api/hobby/groups/:slug/messages { body }     send a chat message (everyone in the room sees it at once)
// DELETE /api/hobby/messages/:id                       delete your message
//
// Live (Socket.IO, see realtime/server.ts): browsers on a group's page join the room "group:<slug>"
// and get hobby:message, hobby:message-deleted, hobby:board and hobby:typing there.

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { chatMessages, groupMembers, hobbyGroups, postComments, postLikes, posts, users, type User } from "../db/schema.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { broadcast, groupRoom, publishActivity, toRoom } from "../realtime/emit.js";

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
  return slug || "group";
}

const author = (u: Pick<User, "id" | "name">) => ({ id: u.id, name: u.name });

// Returns true when you weren't a member before.
async function joinGroup(groupId: number, userId: string): Promise<boolean> {
  const added = await db.insert(groupMembers).values({ groupId, userId }).onConflictDoNothing().returning();
  return added.length > 0;
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
  }>(sql`
    select g.id, g.slug, g.name, g.emoji, g.description, g.created_at as "createdAt",
      (select count(*)::int from group_members gm where gm.group_id = g.id) as members,
      (select count(*)::int from posts p where p.group_id = g.id) as posts,
      greatest(
        (select max(p.created_at) from posts p where p.group_id = g.id),
        (select max(c.created_at) from chat_messages c where c.group_id = g.id)
      ) as "lastActivity",
      exists (select 1 from group_members gm where gm.group_id = g.id and gm.user_id = ${me}) as joined,
      coalesce(g.created_by = ${me}, false) as mine
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

  broadcast("hobby:groups");
  await publishActivity("Users", `${req.user!.name} started the group ${group.emoji} ${group.name}`);
});

hobbyRouter.get("/groups/:slug", async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, group.id))
    .orderBy(groupMembers.joinedAt);
  res.json({
    ...group,
    members,
    joined: req.user ? members.some((m) => m.id === req.user!.id) : false,
    mine: req.user !== null && group.createdBy === req.user.id,
  });
});

hobbyRouter.delete("/groups/:slug", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  if (group.createdBy !== req.user!.id) throw new HttpError(403, "Only the person who started this group can delete it");
  await db.delete(hobbyGroups).where(eq(hobbyGroups.id, group.id));
  res.status(204).end();
  broadcast("hobby:groups");
  toRoom(groupRoom(group.slug), "hobby:board", { slug: group.slug, deleted: true });
});

hobbyRouter.put("/groups/:slug/membership", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  await db.insert(groupMembers).values({ groupId: group.id, userId: req.user!.id }).onConflictDoNothing();
  res.json({ joined: true });
  broadcast("hobby:groups");
});

hobbyRouter.delete("/groups/:slug/membership", requireUser, async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, req.user!.id)));
  res.json({ joined: false });
  broadcast("hobby:groups");
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
  const [post] = await db.insert(posts).values({ groupId: group.id, authorId: req.user!.id, body }).returning();
  await joinGroup(group.id, req.user!.id); // writing in a group makes you a member
  res.status(201).json({ ...post, author: author(req.user!), likes: 0, comments: 0, liked: false, mine: true });

  toRoom(groupRoom(group.slug), "hobby:board", { slug: group.slug });
  broadcast("hobby:groups");
  await publishActivity("MessagesSquare", `${req.user!.name} posted in ${group.emoji} ${group.name}`);
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
  if (post.authorId !== req.user!.id) throw new HttpError(403, "You can only delete your own posts");
  await db.delete(posts).where(eq(posts.id, post.id));
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
  if (row.comment.authorId !== req.user!.id) throw new HttpError(403, "You can only delete your own comments");
  await db.delete(postComments).where(eq(postComments.id, id));
  res.status(204).end();
  toRoom(groupRoom(row.slug), "hobby:board", { slug: row.slug, postId: row.comment.postId });
});

// --- chat -------------------------------------------------------------------------------

const CHAT_PAGE = 50;

hobbyRouter.get("/groups/:slug/messages", async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const { before } = beforeQuery.parse(req.query);
  const rows = await db
    .select({ id: chatMessages.id, body: chatMessages.body, createdAt: chatMessages.createdAt, author: { id: users.id, name: users.name } })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorId))
    .where(and(eq(chatMessages.groupId, group.id), before ? lt(chatMessages.id, before) : undefined))
    .orderBy(desc(chatMessages.id))
    .limit(CHAT_PAGE + 1);
  const page = rows.slice(0, CHAT_PAGE).reverse(); // oldest first, like a chat
  res.json({ messages: page.map((m) => ({ ...m, mine: m.author.id === req.user?.id })), more: rows.length > CHAT_PAGE });
});

export const messageBody = z.object({ body: text(1000, "message") });

// 20 messages per 30 seconds: plenty for a chat, too few for a flood.
hobbyRouter.post("/groups/:slug/messages", requireUser, perUser("chat", 30_000, 20), async (req, res) => {
  const group = await groupBySlug(String(req.params.slug));
  const { body } = messageBody.parse(req.body);
  const [m] = await db.insert(chatMessages).values({ groupId: group.id, authorId: req.user!.id, body }).returning();
  if (await joinGroup(group.id, req.user!.id)) broadcast("hobby:groups");
  const message = { id: m.id, body: m.body, createdAt: m.createdAt, author: author(req.user!) };
  res.status(201).json({ ...message, mine: true });
  // Everyone with this group open gets it at once ("mine" is worked out by each browser)
  toRoom(groupRoom(group.slug), "hobby:message", { slug: group.slug, message });
});

hobbyRouter.delete("/messages/:id", requireUser, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const [row] = await db
    .select({ message: chatMessages, slug: hobbyGroups.slug })
    .from(chatMessages)
    .innerJoin(hobbyGroups, eq(hobbyGroups.id, chatMessages.groupId))
    .where(eq(chatMessages.id, id));
  if (!row) throw new HttpError(404, "Message not found");
  if (row.message.authorId !== req.user!.id) throw new HttpError(403, "You can only delete your own messages");
  await db.delete(chatMessages).where(eq(chatMessages.id, id));
  res.status(204).end();
  toRoom(groupRoom(row.slug), "hobby:message-deleted", { slug: row.slug, id });
});
