// Habit & Reading Tracker (Stage 13). Everything here is yours only (needs a name).
//
// Habits
//   GET    /api/habits?weeks=12              your habits, the days you did them, streaks, this week
//   POST   /api/habits  { name, emoji, color?, perWeek?, reminderTime? }
//   PATCH  /api/habits/:id  { …same, all optional }
//   DELETE /api/habits/:id
//   PUT    /api/habits/:id/days/:day  { done }   tick or untick a day (today or up to 30 days back)
// Reading
//   GET    /api/books                         your books
//   POST   /api/books  { title, author?, totalPages?, status? }
//   PATCH  /api/books/:id  { title?, author?, totalPages?, status?, currentPage? }
//   DELETE /api/books/:id
//   POST   /api/books/:id/pages  { pages, day? }   "I read 20 pages" (adds up per day, moves your place on)
//   GET    /api/books/stats?days=30            pages per day, this week, this year
//
// "Today" is the browser's time zone (X-Time-Zone header).

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { BOOK_STATUSES, books, habitDays, habits, readingLog } from "../db/schema.js";
import { addDays, countInWeek, dayStreak, isDay, todayIn, weekStreak } from "../habits/days.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { publishActivity } from "../realtime/emit.js";
import { timeZoneOf } from "./sessions.js";

export const habitsRouter = Router();
export const booksRouter = Router();
habitsRouter.use(requireUser);
booksRouter.use(requireUser);

const idParam = z.coerce.number().int().positive();
export const COLORS = ["violet", "rose", "amber", "emerald", "sky", "fuchsia"] as const;

// --- habits -----------------------------------------------------------------------------------

export const habitFields = z.object({
  name: z.string().trim().min(1, "Give it a name").max(40),
  emoji: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .refine((e) => !/[\p{L}\p{N}<>]/u.test(e), "Use an emoji"),
  color: z.enum(COLORS).default("violet"),
  perWeek: z.number().int().min(1).max(7).default(7),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 20:30")
    .nullable()
    .default(null),
});

export const habitsQuery = z.object({ weeks: z.coerce.number().int().min(1).max(53).default(12) });
export const dayBody = z.object({ done: z.boolean() });

async function ownHabit(req: Request) {
  const id = idParam.parse(req.params.id);
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, req.user!.id)));
  if (!habit) throw new HttpError(404, "Habit not found");
  return habit;
}

habitsRouter.get("/", async (req, res) => {
  const { weeks } = habitsQuery.parse(req.query);
  const today = todayIn(timeZoneOf(req));
  // enough history for the chart, and for streaks up to a year
  const since = addDays(today, -Math.max(weeks * 7, 400));
  const list = await db.select().from(habits).where(eq(habits.userId, req.user!.id)).orderBy(habits.createdAt, habits.id);
  const rows = list.length
    ? await db
        .select({ habitId: habitDays.habitId, day: habitDays.day })
        .from(habitDays)
        .innerJoin(habits, eq(habits.id, habitDays.habitId))
        .where(and(eq(habits.userId, req.user!.id), gte(habitDays.day, since)))
    : [];
  const chartFrom = addDays(today, -(weeks * 7 - 1));
  res.json({
    today,
    habits: list.map((h) => {
      const done = new Set(rows.filter((r) => r.habitId === h.id).map((r) => r.day));
      return {
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        perWeek: h.perWeek,
        reminderTime: h.reminderTime,
        doneToday: done.has(today),
        days: [...done].filter((d) => d >= chartFrom).sort(),
        streak: h.perWeek === 7 ? { count: dayStreak(done, today), unit: "day" } : { count: weekStreak(done, today, h.perWeek), unit: "week" },
        thisWeek: countInWeek(done, today),
      };
    }),
  });
});

habitsRouter.post("/", async (req, res) => {
  const input = habitFields.parse(req.body);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(habits)
    .where(eq(habits.userId, req.user!.id));
  if (n >= 30) throw new HttpError(400, "That's 30 habits already. Maybe archive a few?");
  const [habit] = await db
    .insert(habits)
    .values({ ...input, userId: req.user!.id, timeZone: timeZoneOf(req) })
    .returning();
  res.status(201).json(habit);
});

habitsRouter.patch("/:id", async (req, res) => {
  const habit = await ownHabit(req);
  const changes = habitFields.partial().parse(req.body);
  const [updated] = await db
    .update(habits)
    .set({ ...changes, timeZone: timeZoneOf(req), ...(changes.reminderTime !== undefined && { lastRemindedOn: null }) })
    .where(eq(habits.id, habit.id))
    .returning();
  res.json(updated);
});

habitsRouter.delete("/:id", async (req, res) => {
  const habit = await ownHabit(req);
  await db.delete(habits).where(eq(habits.id, habit.id));
  res.status(204).end();
});

habitsRouter.put("/:id/days/:day", async (req, res) => {
  const habit = await ownHabit(req);
  const day = String(req.params.day);
  const { done } = dayBody.parse(req.body);
  const today = todayIn(timeZoneOf(req));
  // A day too early or in the future isn't allowed; the browser may be a day ahead of us around midnight
  if (!isDay(day) || day > addDays(today, 1) || day < addDays(today, -30)) throw new HttpError(400, "You can tick today or up to 30 days back");
  if (done) await db.insert(habitDays).values({ habitId: habit.id, day }).onConflictDoNothing();
  else await db.delete(habitDays).where(and(eq(habitDays.habitId, habit.id), eq(habitDays.day, day)));

  const all = new Set((await db.select({ day: habitDays.day }).from(habitDays).where(eq(habitDays.habitId, habit.id))).map((r) => r.day));
  const streak = habit.perWeek === 7 ? { count: dayStreak(all, today), unit: "day" } : { count: weekStreak(all, today, habit.perWeek), unit: "week" };
  res.json({ day, done, streak, thisWeek: countInWeek(all, today) });

  // Round numbers are worth telling everyone
  if (done && day === today && [7, 30, 100, 365].includes(streak.count) && streak.unit === "day") {
    await publishActivity("Flame", `${req.user!.name} kept “${habit.name}” going for ${streak.count} days in a row`);
  }
});

// --- books --------------------------------------------------------------------------------------

export const bookFields = z.object({
  title: z.string().trim().min(1, "Give the book a title").max(200),
  author: z.string().trim().max(120).default(""),
  totalPages: z.number().int().min(1).max(20_000).nullable().default(null),
  status: z.enum(BOOK_STATUSES).default("reading"),
});

export const bookEdits = bookFields.partial().extend({ currentPage: z.number().int().min(0).max(20_000).optional() });
export const statsQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });
export const pagesBody = z.object({ pages: z.number().int().min(1).max(2000), day: z.string().refine(isDay).optional() });

async function ownBook(req: Request) {
  const id = idParam.parse(req.params.id);
  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, req.user!.id)));
  if (!book) throw new HttpError(404, "Book not found");
  return book;
}

booksRouter.get("/", async (req, res) => {
  const list = await db.select().from(books).where(eq(books.userId, req.user!.id)).orderBy(desc(books.updatedAt));
  res.json(list);
});

booksRouter.post("/", async (req, res) => {
  const input = bookFields.parse(req.body);
  const today = todayIn(timeZoneOf(req));
  const [book] = await db
    .insert(books)
    .values({ ...input, userId: req.user!.id, startedOn: input.status === "want" ? null : today, finishedOn: input.status === "finished" ? today : null })
    .returning();
  res.status(201).json(book);
});

booksRouter.patch("/:id", async (req, res) => {
  const book = await ownBook(req);
  const changes = bookEdits.parse(req.body);
  const today = todayIn(timeZoneOf(req));
  const status = changes.status ?? book.status;
  const [updated] = await db
    .update(books)
    .set({
      ...changes,
      startedOn: status !== "want" ? (book.startedOn ?? today) : book.startedOn,
      finishedOn: status === "finished" ? (book.finishedOn ?? today) : null,
      ...(status === "finished" && book.totalPages && changes.currentPage === undefined && { currentPage: book.totalPages }),
      updatedAt: new Date(),
    })
    .where(eq(books.id, book.id))
    .returning();
  res.json(updated);
  if (changes.status === "finished" && book.status !== "finished") {
    await publishActivity("BookOpen", `${req.user!.name} finished reading “${book.title}”`);
  }
});

booksRouter.delete("/:id", async (req, res) => {
  const book = await ownBook(req);
  await db.delete(books).where(eq(books.id, book.id));
  res.status(204).end();
});

booksRouter.post("/:id/pages", async (req, res) => {
  const book = await ownBook(req);
  const today = todayIn(timeZoneOf(req));
  const input = pagesBody.parse(req.body);
  const day = input.day ?? today;
  if (day > addDays(today, 1) || day < addDays(today, -30)) throw new HttpError(400, "Log today or up to 30 days back");

  await db
    .insert(readingLog)
    .values({ bookId: book.id, userId: req.user!.id, day, pages: input.pages })
    .onConflictDoUpdate({ target: [readingLog.bookId, readingLog.day], set: { pages: sql`${readingLog.pages} + ${input.pages}` } });
  const currentPage = book.totalPages ? Math.min(book.totalPages, book.currentPage + input.pages) : book.currentPage + input.pages;
  const finished = book.totalPages !== null && currentPage >= book.totalPages;
  const [updated] = await db
    .update(books)
    .set({
      currentPage,
      status: finished ? "finished" : book.status === "want" ? "reading" : book.status,
      startedOn: book.startedOn ?? day,
      finishedOn: finished ? (book.finishedOn ?? day) : book.finishedOn,
      updatedAt: new Date(),
    })
    .where(eq(books.id, book.id))
    .returning();
  res.json(updated);
  if (finished && book.status !== "finished") await publishActivity("BookOpen", `${req.user!.name} finished reading “${book.title}”`);
});

booksRouter.get("/stats", async (req, res) => {
  const { days } = statsQuery.parse(req.query);
  const today = todayIn(timeZoneOf(req));
  const from = addDays(today, -(days - 1));
  const rows = await db
    .select({ day: readingLog.day, pages: sql<number>`sum(${readingLog.pages})::int` })
    .from(readingLog)
    .where(and(eq(readingLog.userId, req.user!.id), gte(readingLog.day, addDays(today, -366))))
    .groupBy(readingLog.day);
  const byDay = new Map(rows.map((r) => [r.day, r.pages]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    return { day, pages: byDay.get(day) ?? 0 };
  });
  const sum = (from: string) => rows.filter((r) => r.day >= from && r.day <= today).reduce((n, r) => n + r.pages, 0);
  const [{ finished }] = await db
    .select({ finished: sql<number>`count(*)::int` })
    .from(books)
    .where(and(eq(books.userId, req.user!.id), eq(books.status, "finished"), gte(books.finishedOn, `${today.slice(0, 4)}-01-01`)));
  res.json({
    today,
    series,
    week: sum(addDays(today, -6)),
    month: sum(addDays(today, -29)),
    year: sum(`${today.slice(0, 4)}-01-01`),
    finishedThisYear: finished,
  });
});
