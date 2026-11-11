// Arcade Online (Stage 14). Playing happens over Socket.IO (arcade-online/rooms.ts); these are the read-only bits.
//
// GET /api/arcade-online/rooms                       open rooms (to join from the lobby)
// GET /api/arcade-online/leaderboard?period=week|all  wins and points per person
// GET /api/arcade-online/categories                  quiz categories and how many questions each has

import { sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { openRooms } from "../arcade-online/rooms.js";
import { CATEGORY_LABEL, QUESTIONS } from "../arcade-online/questions.js";
import { db } from "../db/client.js";

export const arcadeOnlineRouter = Router();

arcadeOnlineRouter.get("/rooms", (_req, res) => {
  res.json(openRooms());
});

arcadeOnlineRouter.get("/categories", (_req, res) => {
  res.json([
    { id: "mixed", label: "Mixed", questions: QUESTIONS.length },
    ...Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label, questions: QUESTIONS.filter((q) => q.category === id).length })),
  ]);
});

arcadeOnlineRouter.get("/leaderboard", async (req, res) => {
  const { period } = z.object({ period: z.enum(["week", "all"]).default("all") }).parse(req.query);
  const since = period === "week" ? new Date(Date.now() - 7 * 86_400_000) : new Date(0);
  const me = req.user?.id ?? null;
  const result = await db.execute<{ name: string; games: number; wins: number; points: number; best: number; me: boolean }>(sql`
    select u.name, count(*)::int as games,
      count(*) filter (where p.place = 1 and p.players > 1)::int as wins,
      sum(p.score)::int as points, max(p.score)::int as best,
      coalesce(u.id = ${me}, false) as me
    from online_game_players p
    join online_games g on g.id = p.game_id
    join users u on u.id = p.user_id
    where g.finished_at >= ${since}
    group by u.id
    order by wins desc, points desc
    limit 20`);
  res.json(result.rows);
});
