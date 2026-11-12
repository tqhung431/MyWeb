// Stage 22: the parts of Nook Arena that are plain web requests. Playing itself happens on the game server
// (src/arena/server.ts, Socket.IO on /api/arena). These paths must NOT start with /api/arena: Caddy sends those
// to the game server.
//
// Admin (Nook TV):
// GET    /api/admin                 { enabled, isAdmin }   is there an admin passcode, and am I the admin here?
// POST   /api/admin   { passcode }  become the admin on this browser
// DELETE /api/admin                 stop being the admin on this browser
//
// Nook TV (YouTube, chosen by the admin; everyone watches):
// GET    /api/tv                    the shelves
// POST   /api/tv      { url, shelf }          add a video or playlist (admin)
// PATCH  /api/tv/:id  { title?, shelf?, position? }   (admin)
// DELETE /api/tv/:id                (admin)
//
// Chess:
// GET    /api/chess/games           recent games (?mine=1: only mine)
// GET    /api/chess/games/:id       one game, with its moves (PGN) for the replay
// GET    /api/chess/leaderboard     ratings (Elo), live games only
// POST   /api/chess/nook  { pgn, level, color }   save a finished game against Nook (the computer)

import { timingSafeEqual } from "node:crypto";
import { asc, desc, eq, or } from "drizzle-orm";
import { Router, type Request } from "express";
import { Chess } from "chess.js";
import { z } from "zod";
import { COOKIE_NAME, isAdminToken, setAdminToken } from "../auth/sessions.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { arenaRatings, chessGames, tvVideos, users } from "../db/schema.js";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";

export const adminRouter = Router();
export const tvRouter = Router();
export const chessRouter = Router();

// --- admin -------------------------------------------------------------------------------------

export const passcodeBody = z.object({ passcode: z.string().min(1, "Enter the passcode").max(200) });

function samePasscode(given: string, real: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

const adminTries = rateLimit({ name: "admin-passcode", windowMs: 15 * 60_000, max: 10, key: (req) => `admin:${req.ip}` });

adminRouter.get("/", async (req, res) => {
  res.json({ enabled: config.ADMIN_PASSCODE !== "", isAdmin: req.user ? await isAdminToken(req.cookies?.[COOKIE_NAME]) : false });
});

adminRouter.post("/", requireUser, adminTries, async (req, res) => {
  const { passcode } = passcodeBody.parse(req.body);
  if (!config.ADMIN_PASSCODE) throw new HttpError(403, "There's no admin passcode on this Nook");
  if (!samePasscode(passcode, config.ADMIN_PASSCODE)) throw new HttpError(403, "That passcode isn't right");
  await setAdminToken(req.cookies[COOKIE_NAME], true);
  res.json({ enabled: true, isAdmin: true });
});

adminRouter.delete("/", requireUser, async (req, res) => {
  await setAdminToken(req.cookies[COOKIE_NAME], false);
  res.json({ enabled: config.ADMIN_PASSCODE !== "", isAdmin: false });
});

async function requireAdmin(req: Request) {
  if (!req.user || !(await isAdminToken(req.cookies?.[COOKIE_NAME]))) throw new HttpError(403, "Only the admin can do this");
}

// --- Nook TV -----------------------------------------------------------------------------------

// The YouTube links people paste: watch?v=, youtu.be/, shorts/, embed/, live/, and playlists (list=)
export function parseYouTube(raw: string): { kind: "video" | "playlist"; youtubeId: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  if (!["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return null;
  const id = /^[\w-]{11}$/;
  const list = url.searchParams.get("list");
  let video: string | null = null;
  if (host === "youtu.be") video = url.pathname.slice(1).split("/")[0];
  else if (url.pathname === "/watch") video = url.searchParams.get("v");
  else {
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    if (m) video = m[1];
  }
  if (video && id.test(video)) return { kind: "video", youtubeId: video };
  if (list && /^[\w-]{10,64}$/.test(list)) return { kind: "playlist", youtubeId: list };
  return null;
}

// The title, from YouTube's public oEmbed (no key needed). If YouTube can't be reached, a plain name.
async function youTubeTitle(kind: "video" | "playlist", youtubeId: string): Promise<string | null> {
  const page = kind === "video" ? `https://www.youtube.com/watch?v=${youtubeId}` : `https://www.youtube.com/playlist?list=${youtubeId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page)}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: unknown };
    return typeof body.title === "string" ? body.title.slice(0, 200) : null;
  } catch {
    return null;
  }
}

const shelf = z.string().trim().min(1, "Pick a shelf").max(40);
export const tvBody = z.object({ url: z.string().trim().min(1, "Paste a YouTube link").max(500), shelf, title: z.string().trim().min(1).max(200).optional() });
export const tvEdits = z.object({ title: z.string().trim().min(1).max(200), shelf, position: z.number().int().min(0).max(10_000) }).partial();

tvRouter.get("/", async (_req, res) => {
  const rows = await db
    .select({ id: tvVideos.id, kind: tvVideos.kind, youtubeId: tvVideos.youtubeId, title: tvVideos.title, shelf: tvVideos.shelf, position: tvVideos.position })
    .from(tvVideos)
    .orderBy(asc(tvVideos.shelf), asc(tvVideos.position), asc(tvVideos.id));
  const shelves: { name: string; videos: typeof rows }[] = [];
  for (const r of rows) {
    let s = shelves.find((x) => x.name === r.shelf);
    if (!s) shelves.push((s = { name: r.shelf, videos: [] }));
    s.videos.push(r);
  }
  res.json({ shelves });
});

tvRouter.post("/", requireUser, async (req, res) => {
  await requireAdmin(req);
  const body = tvBody.parse(req.body);
  const yt = parseYouTube(body.url);
  if (!yt) throw new HttpError(400, "That isn't a YouTube video or playlist link");
  const title = body.title ?? (await youTubeTitle(yt.kind, yt.youtubeId)) ?? (yt.kind === "video" ? "YouTube video" : "YouTube playlist");
  const [last] = await db.select({ position: tvVideos.position }).from(tvVideos).where(eq(tvVideos.shelf, body.shelf)).orderBy(desc(tvVideos.position)).limit(1);
  const [row] = await db
    .insert(tvVideos)
    .values({ ...yt, title, shelf: body.shelf, position: (last?.position ?? -1) + 1, addedBy: req.user!.id })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new HttpError(409, "That video is already on Nook TV");
  res.status(201).json(row);
});

const idParam = z.coerce.number().int().positive();

tvRouter.patch("/:id", requireUser, async (req, res) => {
  await requireAdmin(req);
  const id = idParam.parse(req.params.id);
  const edits = tvEdits.parse(req.body);
  const [row] = await db.update(tvVideos).set(edits).where(eq(tvVideos.id, id)).returning();
  if (!row) throw new HttpError(404, "Video not found");
  res.json(row);
});

tvRouter.delete("/:id", requireUser, async (req, res) => {
  await requireAdmin(req);
  const id = idParam.parse(req.params.id);
  await db.delete(tvVideos).where(eq(tvVideos.id, id));
  res.status(204).end();
});

// --- chess -------------------------------------------------------------------------------------

export const chessListQuery = z.object({ mine: z.enum(["0", "1"]).optional() });

chessRouter.get("/games", async (req, res) => {
  const q = chessListQuery.parse(req.query);
  const me = req.user?.id;
  const rows = await db
    .select({
      id: chessGames.id,
      whiteName: chessGames.whiteName,
      blackName: chessGames.blackName,
      mode: chessGames.mode,
      nookLevel: chessGames.nookLevel,
      timeControl: chessGames.timeControl,
      result: chessGames.result,
      reason: chessGames.reason,
      endedAt: chessGames.endedAt,
    })
    .from(chessGames)
    .where(q.mine === "1" && me ? or(eq(chessGames.whiteId, me), eq(chessGames.blackId, me)) : q.mine === "1" ? eq(chessGames.id, -1) : undefined)
    .orderBy(desc(chessGames.endedAt))
    .limit(30);
  res.json(rows);
});

chessRouter.get("/games/:id", async (req, res) => {
  const id = idParam.parse(req.params.id);
  const [row] = await db.select().from(chessGames).where(eq(chessGames.id, id));
  if (!row) throw new HttpError(404, "Game not found");
  const { whiteId, blackId, ...game } = row;
  res.json({ ...game, mine: !!req.user && (whiteId === req.user.id || blackId === req.user.id) });
});

chessRouter.get("/leaderboard", async (req, res) => {
  const rows = await db
    .select({ userId: arenaRatings.userId, name: users.name, rating: arenaRatings.rating, games: arenaRatings.games, wins: arenaRatings.wins, draws: arenaRatings.draws, losses: arenaRatings.losses })
    .from(arenaRatings)
    .innerJoin(users, eq(users.id, arenaRatings.userId))
    .where(eq(arenaRatings.game, "chess"))
    .orderBy(desc(arenaRatings.rating), desc(arenaRatings.games))
    .limit(20);
  res.json(rows.map(({ userId, ...r }, i) => ({ rank: i + 1, ...r, me: userId === req.user?.id })));
});

export const nookGameBody = z.object({
  pgn: z.string().min(1).max(20_000),
  level: z.number().int().min(1).max(4),
  color: z.enum(["w", "b"]),
  resigned: z.boolean().default(false),
});

const nookSaves = rateLimit({ name: "chess-nook", windowMs: 60_000, max: 10, key: (req) => `user:${req.user?.id ?? req.ip}` });

// A game against Nook (the computer, played in the browser). The moves are checked here; it doesn't change ratings.
chessRouter.post("/nook", requireUser, nookSaves, async (req, res) => {
  const body = nookGameBody.parse(req.body);
  const chess = new Chess();
  try {
    chess.loadPgn(body.pgn);
  } catch {
    throw new HttpError(400, "Those moves aren't a valid chess game");
  }
  let result: "1-0" | "0-1" | "1/2-1/2";
  let reason: string;
  const loser = body.color === "w" ? "0-1" : "1-0";
  if (chess.isCheckmate()) [result, reason] = [chess.turn() === "w" ? "0-1" : "1-0", "checkmate"];
  else if (chess.isDraw()) [result, reason] = ["1/2-1/2", chess.isStalemate() ? "stalemate" : "draw"];
  else if (body.resigned) [result, reason] = [loser, "resign"];
  else throw new HttpError(400, "That game isn't over yet");
  const me = req.user!;
  const nook = `Nook (${body.level})`;
  const white = body.color === "w";
  const [row] = await db
    .insert(chessGames)
    .values({
      whiteId: white ? me.id : null,
      blackId: white ? null : me.id,
      whiteName: white ? me.name : nook,
      blackName: white ? nook : me.name,
      mode: "nook",
      nookLevel: body.level,
      timeControl: "none",
      pgn: chess.pgn(),
      result,
      reason,
    })
    .returning({ id: chessGames.id });
  res.status(201).json({ id: row.id, result, reason });
});
