// Mini Arcade high scores (Stage 10). The games run in the browser; this keeps the scores.
//
// GET  /api/arcade/games                          the rules: name, unit, is higher or lower better
// GET  /api/arcade/me                             my best score in each game
// GET  /api/arcade/scores/:game?period=week|all   top 10 (each person's best) + my best and my rank
// POST /api/arcade/scores  { game, score }        save a finished game → is it a new best? my rank?
//
// Who owns a score: the signed-in user, or the guest browser's X-Client-Id (like focus sessions).
// Guest scores move into the account when you sign up or log in.

import { sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { GAME_IDS, GAMES, isBetter, type GameId } from "../arcade/games.js";
import { db } from "../db/client.js";
import { gameScores } from "../db/schema.js";
import { arcadeScores } from "../metrics.js";
import { rateLimit } from "../middleware/security.js";
import { broadcast, displayName, ownerRoom, publishActivity } from "../realtime/emit.js";
import { owner, type Owner } from "./sessions.js";

export const arcadeRouter = Router();

const DAY = 86_400_000;
const PERIODS = { week: 7 * DAY, all: null } as const;
type Period = keyof typeof PERIODS;

// Each person's best score, as SQL: max() when higher is better, min() when lower is better.
const bestOf = (game: GameId): SQL => (GAMES[game].better === "higher" ? sql`max(s.score)` : sql`min(s.score)`);
const order = (game: GameId): SQL => sql.raw(GAMES[game].better === "higher" ? "desc" : "asc");
// One key per person: "user:<id>" or "client:<id>" (the same as their real-time room).
const WHO = sql`coalesce('user:' || s.user_id::text, 'client:' || s.client_id::text)`;

// Signed out, only scores never claimed by an account (as for focus sessions).
function mine(o: Owner): SQL {
  return o.userId !== null ? sql`s.user_id = ${o.userId}` : sql`s.client_id = ${o.clientId} and s.user_id is null`;
}

function since(period: Period): Date {
  const span = PERIODS[period];
  return span ? new Date(Date.now() - span) : new Date(0);
}

type Row = { who: string; name: string | null; best: number };

async function topScores(game: GameId, period: Period, limit = 10): Promise<Row[]> {
  const result = await db.execute<Row>(sql`
    select ${WHO} as who, max(u.name) as name, ${bestOf(game)}::int as best
    from game_scores s left join users u on u.id = s.user_id
    where s.game = ${game} and s.created_at >= ${since(period)}
    group by 1
    order by best ${order(game)}, min(s.created_at) asc
    limit ${limit}`);
  return result.rows;
}

async function myBest(game: GameId, o: Owner, period: Period): Promise<number | null> {
  const result = await db.execute<{ best: number | null }>(sql`
    select ${bestOf(game)}::int as best from game_scores s
    where s.game = ${game} and ${mine(o)} and s.created_at >= ${since(period)}`);
  return result.rows[0]?.best ?? null;
}

// My place = 1 + how many people have a better best than mine.
async function rankOf(game: GameId, best: number, period: Period): Promise<number> {
  const better = GAMES[game].better === "higher" ? sql`t.best > ${best}` : sql`t.best < ${best}`;
  const result = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from (
      select ${WHO} as who, ${bestOf(game)} as best from game_scores s
      where s.game = ${game} and s.created_at >= ${since(period)} group by 1
    ) t where ${better}`);
  return (result.rows[0]?.n ?? 0) + 1;
}

const gameParam = z.enum(GAME_IDS, { message: "Unknown game" });

// --- GET /api/arcade/games ---------------------------------------------------------

arcadeRouter.get("/games", (_req, res) => {
  res.json(GAME_IDS.map((id) => ({ id, ...GAMES[id] })));
});

// --- GET /api/arcade/me -----------------------------------------------------------

arcadeRouter.get("/me", async (req, res) => {
  const o = owner(req);
  const result = await db.execute<{ game: string; high: number; low: number }>(sql`
    select s.game, max(s.score)::int as high, min(s.score)::int as low
    from game_scores s where ${mine(o)} group by s.game`);
  const bests: Partial<Record<GameId, number>> = {};
  for (const row of result.rows) {
    if (row.game in GAMES) bests[row.game as GameId] = GAMES[row.game as GameId].better === "higher" ? row.high : row.low;
  }
  res.json({ bests });
});

// --- GET /api/arcade/scores/:game ----------------------------------------------------

export const boardQuery = z.object({ period: z.enum(["week", "all"]).default("all") });

arcadeRouter.get("/scores/:game", async (req, res) => {
  const game = gameParam.parse(req.params.game);
  const { period } = boardQuery.parse(req.query);
  // Reading the board works without an id too (e.g. a page rendered on the server)
  const o = req.user || req.get("x-client-id") ? owner(req) : null;
  const me = o ? ownerRoom(o) : null;

  const rows = await topScores(game, period);
  const best = o ? await myBest(game, o, period) : null;
  res.json({
    game,
    period,
    top: rows.map((r, i) => ({ rank: i + 1, name: r.who.startsWith("user:") ? displayName(r.name) : "Guest", score: r.best, me: r.who === me })),
    best,
    rank: best === null ? null : await rankOf(game, best, period),
  });
});

// --- POST /api/arcade/scores ---------------------------------------------------------

export const newScore = z
  .object({ game: gameParam, score: z.number().int() })
  .refine((v) => v.score >= GAMES[v.game].min && v.score <= GAMES[v.game].max, { message: "That score isn't possible in this game", path: ["score"] });

// Games are short, but not THAT short: 30 saves a minute per person is plenty.
const saveLimit = rateLimit({
  name: "arcade-save",
  windowMs: 60_000,
  max: 30,
  key: (req) => (req.user ? `user:${req.user.id}` : `client:${req.get("x-client-id") ?? "none"}`),
});

arcadeRouter.post("/scores", saveLimit, async (req, res) => {
  const o = owner(req);
  const { game, score } = newScore.parse(req.body);
  const before = await myBest(game, o, "all");
  await db.insert(gameScores).values({ ...o, game, score });
  arcadeScores.add(1, { game });

  const newBest = isBetter(game, score, before);
  const best = newBest ? score : before!;
  const rank = await rankOf(game, best, "all");
  res.status(201).json({ game, score, best, previousBest: before, newBest, rank });

  broadcast("arcade:changed", { game }); // open leaderboards reload
  // Taking first place is news for everyone's live feed (only when someone else was there to beat)
  if (newBest && rank === 1) {
    const [{ players }] = (
      await db.execute<{ players: number }>(sql`
      select count(distinct ${WHO})::int as players from game_scores s where s.game = ${game}`)
    ).rows;
    if (players > 1) {
      const rule = GAMES[game];
      await publishActivity("Trophy", `${displayName(req.user?.name)} is now #1 in ${rule.name} (${score} ${rule.unit})`);
    }
  }
});
