// POST /api/sessions          → save a finished timer session
// GET  /api/sessions/summary  → focus sessions per day, for the last N days
//
// Every request names its browser with the X-Client-Id header (a random UUID).

import { and, eq, gte } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { focusSessions } from "../db/schema.js";

export const sessionsRouter = Router();

function clientId(req: Request): string {
  return z.uuid({ message: "X-Client-Id header must be a UUID" }).parse(req.get("x-client-id"));
}

// --- POST /api/sessions ------------------------------------------------------

const newSession = z.object({
  mode: z.enum(["focus", "short", "long"]),
  minutes: z.number().int().min(1).max(120),
});

sessionsRouter.post("/", async (req, res) => {
  const id = clientId(req);
  const input = newSession.parse(req.body); // throws → 400 with details
  const [saved] = await db
    .insert(focusSessions)
    .values({ clientId: id, ...input })
    .returning();
  res.status(201).json(saved); // 201 Created
});

// --- GET /api/sessions/summary?tz=Asia/Ho_Chi_Minh&days=7 --------------------

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const summaryQuery = z.object({
  tz: z.string().refine(isTimeZone, "Unknown time zone").default("UTC"),
  days: z.coerce.number().int().min(1).max(31).default(7),
});

sessionsRouter.get("/summary", async (req, res) => {
  const id = clientId(req);
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
    .where(and(eq(focusSessions.clientId, id), eq(focusSessions.mode, "focus"), gte(focusSessions.completedAt, since)));

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
