// Nook Games (Stage 16): cloud saves, so a game continues on another device.
//
// GET    /api/games/saves               your saves (game, summary, updatedAt; no data)
// GET    /api/games/saves/:game         one save, with its data
// PUT    /api/games/saves/:game  { version, data, summary }   save (replaces the old one)
// DELETE /api/games/saves/:game         start over
//
// The browser also keeps a save of its own; it loads whichever is newer.
// A save is just JSON to the API: the game checks its shape when loading. We only limit its size.

import { and, desc, eq } from "drizzle-orm";
import express, { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { gameSaves } from "../db/schema.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";

export const gamesRouter = Router();

export const MAX_SAVE_BYTES = 200_000;
export const GAMES = ["van-lo"] as const;

// A save is bigger than the 10 KB the rest of the API allows, so this router reads JSON itself
// (it's mounted before the app-wide parser in app.ts).
export const gamesJson = express.json({ limit: MAX_SAVE_BYTES });

const gameParam = z.enum(GAMES);
const saveBody = z.object({
  version: z.number().int().min(1).max(1000),
  data: z.record(z.string(), z.unknown()),
  summary: z.string().trim().max(120).default(""),
});

// Saving happens often while playing, but not more than every couple of seconds
const saveLimit = rateLimit({ name: "game-save", windowMs: 60_000, max: 40, key: (req) => `user:${req.user?.id ?? req.ip}` });

gamesRouter.get("/saves", requireUser, async (req, res) => {
  const rows = await db
    .select({ game: gameSaves.game, version: gameSaves.version, summary: gameSaves.summary, updatedAt: gameSaves.updatedAt })
    .from(gameSaves)
    .where(eq(gameSaves.userId, req.user!.id))
    .orderBy(desc(gameSaves.updatedAt));
  res.json(rows);
});

gamesRouter.get("/saves/:game", requireUser, async (req, res) => {
  const game = gameParam.parse(req.params.game);
  const [row] = await db
    .select()
    .from(gameSaves)
    .where(and(eq(gameSaves.userId, req.user!.id), eq(gameSaves.game, game)));
  if (!row) throw new HttpError(404, "No save yet");
  res.json({ game: row.game, version: row.version, summary: row.summary, data: row.data, updatedAt: row.updatedAt });
});

gamesRouter.put("/saves/:game", requireUser, saveLimit, async (req, res) => {
  const game = gameParam.parse(req.params.game);
  const body = saveBody.parse(req.body);
  const values = { userId: req.user!.id, game, version: body.version, data: body.data, summary: body.summary, updatedAt: new Date() };
  await db
    .insert(gameSaves)
    .values(values)
    .onConflictDoUpdate({
      target: [gameSaves.userId, gameSaves.game],
      set: { version: values.version, data: values.data, summary: values.summary, updatedAt: values.updatedAt },
    });
  res.json({ ok: true, updatedAt: values.updatedAt });
});

gamesRouter.delete("/saves/:game", requireUser, async (req, res) => {
  const game = gameParam.parse(req.params.game);
  await db.delete(gameSaves).where(and(eq(gameSaves.userId, req.user!.id), eq(gameSaves.game, game)));
  res.status(204).end();
});
