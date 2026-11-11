// GET /api/achievements → every badge, with earnedAt (or null) for you (signed in or guest).
// The badges themselves are written by the background worker (src/jobs/handlers.ts).

import { and, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { ACHIEVEMENTS } from "../achievements.js";
import { db } from "../db/client.js";
import { achievements } from "../db/schema.js";
import { owner } from "./sessions.js";

export const achievementsRouter = Router();

achievementsRouter.get("/", async (req, res) => {
  const o = owner(req);
  const where =
    o.userId !== null
      ? eq(achievements.userId, o.userId)
      : and(eq(achievements.clientId, o.clientId), isNull(achievements.userId));

  const rows = await db.select({ code: achievements.code, earnedAt: achievements.earnedAt }).from(achievements).where(where);
  const earned = new Map(rows.map((r) => [r.code, r.earnedAt]));

  res.json(
    ACHIEVEMENTS.map(({ code, title, description, icon }) => ({
      code,
      title,
      description,
      icon,
      earnedAt: earned.get(code) ?? null,
    })),
  );
});
