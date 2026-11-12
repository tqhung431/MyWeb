// Nook Games (Stage 16): cloud saves, so a game continues on another device.
//
// GET    /api/games/saves               your saves (game, summary, updatedAt; no data)
// GET    /api/games/saves/:game         one save, with its data
// PUT    /api/games/saves/:game  { version, data, summary }   save (replaces the old one)
// DELETE /api/games/saves/:game         start over
// GET    /api/games/leaderboard/:game   Stage 18: the highest cultivators on Nook (public)
//
// The browser also keeps a save of its own; it loads whichever is newer.
// A save is just JSON to the API: the game checks its shape when loading. We only limit its size.

import { and, asc, desc, eq, gt } from "drizzle-orm";
import express, { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { gameSaves, users } from "../db/schema.js";
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
export const saveBody = z.object({
  version: z.number().int().min(1).max(1000),
  data: z.record(z.string(), z.unknown()),
  summary: z.string().trim().max(120).default(""),
  // Stage 18: what the leaderboard shows. The game sends it; a player could fake it, which is fine on a home network.
  board: z
    .object({
      path: z.string().trim().max(20),
      level: z.number().int().min(0).max(100),
      kills: z.number().int().min(0).max(10_000_000),
    })
    .optional(),
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
  const values = {
    userId: req.user!.id,
    game,
    version: body.version,
    data: body.data,
    summary: body.summary,
    path: body.board?.path ?? "",
    level: body.board?.level ?? 0,
    kills: body.board?.kills ?? 0,
    updatedAt: new Date(),
  };
  await db
    .insert(gameSaves)
    .values(values)
    .onConflictDoUpdate({
      target: [gameSaves.userId, gameSaves.game],
      set: {
        version: values.version,
        data: values.data,
        summary: values.summary,
        path: values.path,
        level: values.level,
        kills: values.kills,
        updatedAt: values.updatedAt,
      },
    });
  res.json({ ok: true, updatedAt: values.updatedAt });
});

gamesRouter.delete("/saves/:game", requireUser, async (req, res) => {
  const game = gameParam.parse(req.params.game);
  await db.delete(gameSaves).where(and(eq(gameSaves.userId, req.user!.id), eq(gameSaves.game, game)));
  res.status(204).end();
});

// Highest realm first; on the same level, more enemies defeated; then whoever got there first
gamesRouter.get("/leaderboard/:game", async (req, res) => {
  const game = gameParam.parse(req.params.game);
  const rows = await db
    .select({ userId: gameSaves.userId, name: users.name, path: gameSaves.path, level: gameSaves.level, kills: gameSaves.kills, summary: gameSaves.summary })
    .from(gameSaves)
    .innerJoin(users, eq(users.id, gameSaves.userId))
    .where(and(eq(gameSaves.game, game), gt(gameSaves.level, 0)))
    .orderBy(desc(gameSaves.level), desc(gameSaves.kills), asc(gameSaves.updatedAt))
    .limit(20);
  res.json(rows.map(({ userId, ...r }, i) => ({ rank: i + 1, ...r, me: userId === req.user?.id })));
});
