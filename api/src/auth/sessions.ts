// Server-side sessions: how Nook remembers who you are on this browser.
//
// Stage 11: you only give a name. Nook creates you, makes a random token, stores its hash in
// auth_sessions and gives the token to the browser in an httpOnly cookie. Every request: hash the
// cookie's token, look it up. No password: whoever has the cookie IS you, so it never leaves this
// browser (httpOnly: page JavaScript can't read it). Clearing the browser's data = a new person.

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { CookieOptions, Response } from "express";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { achievements, authSessions, focusSessions, gameScores, songLikes, songPlays, songs, users, type User } from "../db/schema.js";
import { valkey, valkeyReady } from "../valkey/client.js";

export const COOKIE_NAME = "nook_session";
const DAY = 24 * 60 * 60 * 1000;
// As long as data is kept: an active browser keeps renewing it, a forgotten one expires with its data.
const SESSION_DAYS = config.DATA_RETENTION_DAYS;

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the page can't read it, so an XSS bug can't steal it
  sameSite: "lax", // not sent with requests started by other websites (except plain links)
  path: "/",
};

// Secure = "only send over HTTPS". We set it when the visitor actually came over HTTPS
// (https://localhost through Caddy). Plain http://192.168.x.x on your network must still work,
// and browsers refuse Secure cookies there.
const optionsFor = (res: Response): CookieOptions => ({ ...cookieOptions, secure: res.req?.secure ?? false });

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(res: Response, userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString("base64url"); // 256 random bits: impossible to guess
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.insert(authSessions).values({ id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) });
  res.cookie(COOKIE_NAME, token, { ...optionsFor(res), expires: expiresAt });
}

export async function endSession(res: Response, token: string | undefined): Promise<void> {
  if (token) {
    await db.delete(authSessions).where(eq(authSessions.id, hashToken(token)));
    await forget(hashToken(token)); // the cached copy must go too, or the token would live on for a minute
  }
  res.clearCookie(COOKIE_NAME, optionsFor(res));
}

export type PublicUser = Pick<User, "id" | "name" | "createdAt" | "preferences">;

export function publicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, createdAt: user.createdAt, preferences: user.preferences };
}

// Every request from you moves "last seen" forward (at most once an hour, to spare the database).
// Cleanup deletes people whose last seen is older than DATA_RETENTION_DAYS.
const HOUR = 60 * 60 * 1000;
export async function touchLastSeen(user: User): Promise<void> {
  if (Date.now() - new Date(user.lastSeenAt).getTime() < HOUR) return;
  user.lastSeenAt = new Date();
  await db
    .update(users)
    .set({ lastSeenAt: user.lastSeenAt })
    .where(and(eq(users.id, user.id), lt(users.lastSeenAt, new Date(Date.now() - HOUR))));
}

// After changing a user's details, drop this browser's cached copy so the change shows at once.
export async function refreshCachedSession(token: string | undefined): Promise<void> {
  if (token) await forget(hashToken(token));
}

// --- Stage 5: cache "token → user" in Valkey for 60 s --------------------------
// Almost every request asks "who is this?". Without a cache that's a PostgreSQL join each time.
// 60 s is short on purpose: a renamed user shows the new name within a minute,
// and sign-out deletes the copy immediately (see endSession).

const CACHE_SECONDS = 60;
const cacheKey = (id: string) => `auth:session:${id}`;
type CachedSession = { user: User; expiresAt: string };

async function recall(id: string): Promise<{ user: User; expiresAt: Date } | null> {
  if (!valkeyReady()) return null;
  const raw = await valkey.get(cacheKey(id)).catch(() => null);
  if (!raw) return null;
  const c = JSON.parse(raw) as CachedSession;
  // JSON turns dates into strings; turn them back.
  return { user: { ...c.user, createdAt: new Date(c.user.createdAt), lastSeenAt: new Date(c.user.lastSeenAt) }, expiresAt: new Date(c.expiresAt) };
}

async function remember(id: string, user: User, expiresAt: Date): Promise<void> {
  if (!valkeyReady()) return;
  await valkey.set(cacheKey(id), JSON.stringify({ user, expiresAt }), "EX", CACHE_SECONDS).catch(() => {});
}

async function forget(id: string): Promise<void> {
  if (valkeyReady()) await valkey.del(cacheKey(id)).catch(() => {});
}

// Look up who owns this token. Also renews sessions that are past halfway, so active people stay logged in.
// res is optional: a WebSocket connection has no HTTP response to renew the cookie on.
export async function userFromToken(token: string | undefined, res?: Response): Promise<User | null> {
  if (!token) return null;
  const id = hashToken(token);

  let row = await recall(id);
  if (!row) {
    [row] = await db
      .select({ user: users, expiresAt: authSessions.expiresAt })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(and(eq(authSessions.id, id), gt(authSessions.expiresAt, new Date())));
    if (!row) return null;
    await remember(id, row.user, row.expiresAt);
  }
  if (row.expiresAt.getTime() <= Date.now()) return null;

  if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
    await db.update(authSessions).set({ expiresAt }).where(eq(authSessions.id, id));
    await forget(id);
    res?.cookie(COOKIE_NAME, token, { ...optionsFor(res), expires: expiresAt });
  }
  return row.user;
}

// When you pick your name: what this browser did before (as a guest) becomes yours.
// The guest's badges are removed; the worker re-checks badges from the merged history.
export async function claimGuestData(userId: string, clientId: string | undefined): Promise<void> {
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) return;
  await db
    .update(focusSessions)
    .set({ userId })
    .where(and(eq(focusSessions.clientId, clientId), isNull(focusSessions.userId)));
  await db.delete(achievements).where(and(eq(achievements.clientId, clientId), isNull(achievements.userId)));
  // Stage 10: guest high scores join the account too
  await db.update(gameScores).set({ userId }).where(and(eq(gameScores.clientId, clientId), isNull(gameScores.userId)));
  // Songs you added, liked and played
  await db.update(songs).set({ addedByUserId: userId }).where(and(eq(songs.addedByClientId, clientId), isNull(songs.addedByUserId)));
  await db.update(songLikes).set({ owner: `user:${userId}` }).where(eq(songLikes.owner, `client:${clientId}`));
  await db.update(songPlays).set({ owner: `user:${userId}` }).where(eq(songPlays.owner, `client:${clientId}`));
}
