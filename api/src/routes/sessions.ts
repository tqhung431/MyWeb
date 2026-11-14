// POST /api/sessions          → save a finished timer session
// GET  /api/sessions/summary  → focus sessions per day, for the last N days
//
// Who owns a session?
//   - signed in  → the user (req.user, from the login cookie)
//   - signed out → the browser's anonymous X-Client-Id (a random UUID, like Stage 3)

import { and, eq, gte, isNull, type SQL } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { focusSessions } from "../db/schema.js";
import { enqueue } from "../jobs/queue.js";
import { focusSessionsSaved } from "../metrics.js";
import { rateLimit } from "../middleware/security.js";

export const sessionsRouter = Router();

export type Owner = { userId: string; clientId: null } | { userId: null; clientId: string };

export function owner(req: Request): Owner {
  if (req.user) return { userId: req.user.id, clientId: null };
  const clientId = z.uuid({ message: "Sign in, or send an X-Client-Id header (UUID)" }).parse(req.get("x-client-id"));
  return { userId: null, clientId };
}

// Signed out, only show sessions that were never claimed by an account.
// Otherwise, after you log out on a shared computer, the next person would see your history.
function ownedBy(o: Owner): SQL {
  if (o.userId !== null) return eq(focusSessions.userId, o.userId);
  return and(eq(focusSessions.clientId, o.clientId), isNull(focusSessions.userId))!;
}

// --- POST /api/sessions ------------------------------------------------------

export const newSession = z.object({
  mode: z.enum(["focus", "short", "long"]),
  minutes: z.number().int().min(1).max(120),
});

// 30 saves a minute per user or browser (not per IP: everyone on the network shares one IP here).
const saveLimit = rateLimit({
  name: "session-save",
  windowMs: 60_000,
  max: 30,
  key: (req) => (req.user ? `user:${req.user.id}` : `client:${req.get("x-client-id") ?? "none"}`),
});

sessionsRouter.post("/", saveLimit, async (req, res) => {
  const o = owner(req);
  const input = newSession.parse(req.body); // throws → 400 with details
  const [saved] = await db
    .insert(focusSessions)
    .values({ ...o, ...input })
    .returning();
  res.status(201).json(saved); // 201 Created: the visitor doesn't wait for anything below

  if (input.mode === "focus") {
    focusSessionsSaved.add(1, { signed_in: o.userId !== null });
    // Stage 28: focus sessions are private (they used to go to everyone's live feed)
    // Stage 5: badges are checked later by the worker, not here.
    await enqueue("achievements", { ...o, timeZone: timeZoneOf(req) });
  }
});

// --- GET /api/sessions/summary?tz=Asia/Ho_Chi_Minh&days=7 --------------------

// The browser's time zone, sent as X-Time-Zone (e.g. "Asia/Ho_Chi_Minh"). Used for "today" and badges.
export function timeZoneOf(req: Request): string {
  const tz = req.get("x-time-zone");
  return tz && isTimeZone(tz) ? tz : "UTC";
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const summaryQuery = z.object({
  tz: z.string().refine(isTimeZone, "Unknown time zone").default("UTC"),
  days: z.coerce.number().int().min(1).max(31).default(7),
});

sessionsRouter.get("/summary", async (req, res) => {
  const o = owner(req);
  const { tz, days } = summaryQuery.parse(req.query);

  // "Today" depends on where you are, so dates are computed in the caller's time zone.
  // en-CA formats dates as YYYY-MM-DD.
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  const now = Date.now();
  const keys = Array.from({ length: days }, (_, i) => dayOf.format(now - (days - 1 - i) * 86_400_000));

  const since = new Date(now - (days + 1) * 86_400_000); // a little extra, filtered below
  const rows = await db
    .select({ minutes: focusSessions.minutes, completedAt: focusSessions.completedAt })
    .from(focusSessions)
    .where(and(ownedBy(o), eq(focusSessions.mode, "focus"), gte(focusSessions.completedAt, since)));

  const byDay = new Map(keys.map((k) => [k, { date: k, sessions: 0, minutes: 0 }]));
  for (const row of rows) {
    const day = byDay.get(dayOf.format(row.completedAt));
    if (day) {
      day.sessions += 1;
      day.minutes += row.minutes;
    }
  }

  const list = [...byDay.values()];
  res.json({
    timeZone: tz,
    today: list[list.length - 1],
    days: list,
    total: list.reduce((sum, d) => sum + d.sessions, 0),
  });
});
