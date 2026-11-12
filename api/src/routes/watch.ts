// WatchList (Stage 12): find TV shows and anime, keep your list, see what others on Nook watch.
//
// GET    /api/watch/search?q=frieren&type=all|tv|anime   search TVmaze + Jikan (cached a day)
// GET    /api/watch/list?status=watching                 your list (needs a name)
// PUT    /api/watch/list/:source/:externalId  { status, stars?, note?, episodesSeen? }   add or update
// DELETE /api/watch/list/:titleId                         remove from your list
// GET    /api/watch/popular                              most watched on Nook (30 days) + latest updates
// GET    /api/watch/titles/:id                           one title, with everyone's ratings and notes

import { and, desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { users, WATCH_STATUSES, watchEntries, watchTitles } from "../db/schema.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { broadcast, publishActivity } from "../realtime/emit.js";
import { lookUp, search, SourceDown, type Source, type Title } from "../watch/sources.js";

export const watchRouter = Router();

const sourceParam = z.enum(["tv", "anime"]);
const externalIdParam = z.string().regex(/^\d{1,10}$/, "Unknown title");

// --- search -------------------------------------------------------------------------------

export const searchQuery = z.object({
  q: z.string().trim().min(2, "Type at least 2 letters").max(80),
  type: z.enum(["all", "tv", "anime"]).default("all"),
});

// Searches cost the free sources something: 30 a minute per person is plenty for typing.
const searchLimit = rateLimit({
  name: "watch-search",
  windowMs: 60_000,
  max: 30,
  key: (req) => (req.user ? `user:${req.user.id}` : `client:${req.get("x-client-id") ?? req.ip ?? "?"}`),
});

watchRouter.get("/search", searchLimit, async (req, res) => {
  const { q, type } = searchQuery.parse(req.query);
  const sources: Source[] = type === "all" ? ["tv", "anime"] : [type];
  const { results, unavailable } = await search(q, sources);
  if (results.length === 0 && unavailable.length === sources.length) {
    throw new HttpError(503, "Can't reach the TV and anime websites right now. Is this PC online?");
  }
  // What's already on your list
  const mine = new Map<string, { status: string; titleId: number }>();
  if (req.user) {
    const rows = await db
      .select({ source: watchTitles.source, externalId: watchTitles.externalId, status: watchEntries.status, titleId: watchTitles.id })
      .from(watchEntries)
      .innerJoin(watchTitles, eq(watchTitles.id, watchEntries.titleId))
      .where(eq(watchEntries.userId, req.user.id));
    for (const r of rows) mine.set(`${r.source}:${r.externalId}`, { status: r.status, titleId: r.titleId });
  }
  res.json({ results: results.map((t) => ({ ...t, mine: mine.get(`${t.source}:${t.externalId}`) ?? null })), unavailable });
});

// --- your list ------------------------------------------------------------------------------

const entryColumns = {
  titleId: watchTitles.id,
  source: watchTitles.source,
  externalId: watchTitles.externalId,
  title: watchTitles.title,
  originalTitle: watchTitles.originalTitle,
  year: watchTitles.year,
  kind: watchTitles.kind,
  imageUrl: watchTitles.imageUrl,
  genres: watchTitles.genres,
  episodes: watchTitles.episodes,
  status: watchEntries.status,
  stars: watchEntries.stars,
  note: watchEntries.note,
  episodesSeen: watchEntries.episodesSeen,
  updatedAt: watchEntries.updatedAt,
};

watchRouter.get("/list", requireUser, async (req, res) => {
  const status = z
    .enum(WATCH_STATUSES)
    .optional()
    .parse(req.query.status || undefined);
  const rows = await db
    .select(entryColumns)
    .from(watchEntries)
    .innerJoin(watchTitles, eq(watchTitles.id, watchEntries.titleId))
    .where(and(eq(watchEntries.userId, req.user!.id), status ? eq(watchEntries.status, status) : undefined))
    .orderBy(desc(watchEntries.updatedAt));
  res.json(rows);
});

export const entryBody = z.object({
  status: z.enum(WATCH_STATUSES),
  stars: z.number().int().min(1).max(5).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  episodesSeen: z.number().int().min(0).max(100_000).nullable().optional(),
});

// Keep our own copy of the title (first save, or refresh it when it's more than a week old)
async function saveTitle(t: Title): Promise<number> {
  const values = {
    source: t.source,
    externalId: t.externalId,
    title: t.title,
    originalTitle: t.originalTitle,
    year: t.year,
    kind: t.kind,
    imageUrl: t.imageUrl,
    summary: t.summary,
    genres: t.genres,
    rating: t.rating,
    episodes: t.episodes,
    url: t.url,
    fetchedAt: new Date(),
  };
  const [row] = await db
    .insert(watchTitles)
    .values(values)
    .onConflictDoUpdate({ target: [watchTitles.source, watchTitles.externalId], set: values })
    .returning({ id: watchTitles.id });
  return row.id;
}

const STATUS_WORDS = { want: "wants to watch", watching: "is watching", done: "finished", dropped: "stopped watching" } as const;

watchRouter.put("/list/:source/:externalId", requireUser, async (req, res) => {
  const source = sourceParam.parse(req.params.source);
  const externalId = externalIdParam.parse(req.params.externalId);
  const input = entryBody.parse(req.body);

  // Our copy if we have a recent one; otherwise ask the source (the browser's copy isn't trusted)
  const [known] = await db
    .select({ id: watchTitles.id, title: watchTitles.title, fetchedAt: watchTitles.fetchedAt })
    .from(watchTitles)
    .where(and(eq(watchTitles.source, source), eq(watchTitles.externalId, externalId)));
  let titleId = known?.id;
  let name = known?.title;
  if (!known || Date.now() - known.fetchedAt.getTime() > 7 * 86_400_000) {
    try {
      const t = await lookUp(source, externalId);
      titleId = await saveTitle(t);
      name = t.title;
    } catch (error) {
      if (!(error instanceof SourceDown) || !known) {
        if (error instanceof SourceDown) throw new HttpError(503, "Can't reach the TV and anime websites right now. Try again in a minute.");
        throw error;
      }
      // the source is down but we have an older copy: use it
    }
  }

  const [before] = await db
    .select({ status: watchEntries.status })
    .from(watchEntries)
    .where(and(eq(watchEntries.userId, req.user!.id), eq(watchEntries.titleId, titleId!)));
  const values = {
    status: input.status,
    ...(input.stars !== undefined && { stars: input.stars }),
    ...(input.note !== undefined && { note: input.note }),
    ...(input.episodesSeen !== undefined && { episodesSeen: input.episodesSeen }),
    updatedAt: new Date(),
  };
  await db
    .insert(watchEntries)
    .values({ userId: req.user!.id, titleId: titleId!, ...values })
    .onConflictDoUpdate({ target: [watchEntries.userId, watchEntries.titleId], set: values });

  const [entry] = await db
    .select(entryColumns)
    .from(watchEntries)
    .innerJoin(watchTitles, eq(watchTitles.id, watchEntries.titleId))
    .where(and(eq(watchEntries.userId, req.user!.id), eq(watchEntries.titleId, titleId!)));
  res.json(entry);

  broadcast("watch:changed");
  // Only status changes make the live feed (not every star or note)
  if (before?.status !== input.status) {
    const stars = input.stars ? ` ${"★".repeat(input.stars)}` : "";
    await publishActivity("Clapperboard", `${req.user!.name} ${STATUS_WORDS[input.status]} “${name}”${input.status === "done" ? stars : ""}`);
  }
});

watchRouter.delete("/list/:titleId", requireUser, async (req, res) => {
  const titleId = z.coerce.number().int().positive().parse(req.params.titleId);
  await db.delete(watchEntries).where(and(eq(watchEntries.userId, req.user!.id), eq(watchEntries.titleId, titleId)));
  res.status(204).end();
  broadcast("watch:changed");
});

// --- on Nook ----------------------------------------------------------------------------------

watchRouter.get("/popular", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const popular = await db.execute<{
    titleId: number;
    title: string;
    kind: string;
    year: number | null;
    imageUrl: string | null;
    people: number;
    watching: number;
    avgStars: number | null;
    names: string[];
  }>(sql`
    select t.id as "titleId", t.title, t.kind, t.year, t.image_url as "imageUrl",
      count(*)::int as people,
      count(*) filter (where e.status = 'watching')::int as watching,
      round(avg(e.stars)::numeric, 1)::float as "avgStars",
      (array_agg(u.name order by e.updated_at desc))[1:3] as names
    from watch_entries e
    join watch_titles t on t.id = e.title_id
    join users u on u.id = e.user_id
    where e.updated_at >= ${since}
    group by t.id
    order by people desc, max(e.updated_at) desc
    limit 12`);
  const latest = await db
    .select({
      name: users.name,
      status: watchEntries.status,
      stars: watchEntries.stars,
      updatedAt: watchEntries.updatedAt,
      titleId: watchTitles.id,
      title: watchTitles.title,
      imageUrl: watchTitles.imageUrl,
    })
    .from(watchEntries)
    .innerJoin(watchTitles, eq(watchTitles.id, watchEntries.titleId))
    .innerJoin(users, eq(users.id, watchEntries.userId))
    .orderBy(desc(watchEntries.updatedAt))
    .limit(12);
  res.json({ popular: popular.rows, latest });
});

watchRouter.get("/titles/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [title] = await db.select().from(watchTitles).where(eq(watchTitles.id, id));
  if (!title) throw new HttpError(404, "Title not found");
  const people = await db
    .select({
      id: users.id,
      name: users.name,
      status: watchEntries.status,
      stars: watchEntries.stars,
      note: watchEntries.note,
      updatedAt: watchEntries.updatedAt,
    })
    .from(watchEntries)
    .innerJoin(users, eq(users.id, watchEntries.userId))
    .where(eq(watchEntries.titleId, id))
    .orderBy(desc(watchEntries.updatedAt));
  const mine = req.user ? (people.find((p) => p.id === req.user!.id) ?? null) : null;
  res.json({ title, people: people.map(({ id: _, ...p }) => p), mine: mine && { ...mine, id: undefined } });
});
