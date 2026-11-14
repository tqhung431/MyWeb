// Server-side sessions: how Nook remembers who you are on this browser.
//
// Stage 11: you only give a name. Nook creates you, makes a random token, stores its hash in
// auth_sessions and gives the token to the browser in an httpOnly cookie. Every request: hash the
// cookie's token, look it up. No password: whoever has the cookie IS you, so it never leaves this
// browser (httpOnly: page JavaScript can't read it). Clearing the browser's data = a new person.

import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import type { CookieOptions, Response } from "express";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { achievements, authSessions, focusSessions, gameScores, signInCodes, songLikes, songPlays, songs, users, type User } from "../db/schema.js";
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

export type PublicUser = Pick<User, "id" | "name" | "createdAt" | "preferences"> & { hasPin: boolean; pausedUntil: Date | null };

export function publicUser(user: User): PublicUser {
  const paused = user.pausedUntil && new Date(user.pausedUntil).getTime() > Date.now() ? new Date(user.pausedUntil) : null;
  return { id: user.id, name: user.name, createdAt: user.createdAt, preferences: user.preferences, hasPin: !!user.pinHash, pausedUntil: paused };
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
  const u = c.user;
  return {
    user: { ...u, createdAt: new Date(u.createdAt), lastSeenAt: new Date(u.lastSeenAt), pausedUntil: u.pausedUntil ? new Date(u.pausedUntil) : null, pinLockedUntil: u.pinLockedUntil ? new Date(u.pinLockedUntil) : null },
    expiresAt: new Date(c.expiresAt),
  };
}

async function remember(id: string, user: User, expiresAt: Date): Promise<void> {
  if (!valkeyReady()) return;
  // the PIN's hash never goes into the cache: only whether there is one
  const safe = { ...user, pinHash: user.pinHash ? "set" : null };
  await valkey.set(cacheKey(id), JSON.stringify({ user: safe, expiresAt }), "EX", CACHE_SECONDS).catch(() => {});
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
  // Stage 27: the Devices list shows when each browser was last used (written at most once an hour)
  if (Date.now() - new Date(row.user.lastSeenAt).getTime() >= HOUR) await db.update(authSessions).set({ lastUsedAt: new Date() }).where(eq(authSessions.id, id));

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

// Stage 22: the admin flag lives on the session (this browser), set by typing the admin passcode.
// Stage 27: it ends after ADMIN_HOURS; then the passcode is needed again.
export const ADMIN_HOURS = 12;
export async function isAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [row] = await db
    .select({ isAdmin: authSessions.isAdmin, adminUntil: authSessions.adminUntil })
    .from(authSessions)
    .where(and(eq(authSessions.id, hashToken(token)), gt(authSessions.expiresAt, new Date())));
  return !!row?.isAdmin && !!row.adminUntil && row.adminUntil.getTime() > Date.now();
}

export async function setAdminToken(token: string, on: boolean): Promise<void> {
  await db
    .update(authSessions)
    .set({ isAdmin: on, adminUntil: on ? new Date(Date.now() + ADMIN_HOURS * HOUR) : null })
    .where(eq(authSessions.id, hashToken(token)));
}

// --- Stage 27: PINs ----------------------------------------------------------------------------
// A PIN is short, so it's stored as a slow, salted hash (scrypt): even with a copy of the database, trying all
// million six-digit PINs takes a long time. Guessing through Nook is stopped after 10 wrong tries (routes/me.ts).

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const PIN_RE = /^\d{4,6}$/;
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}
export async function checkPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const got = await scrypt(pin, Buffer.from(salt, "base64url"), 32);
  const want = Buffer.from(hash, "base64url");
  return got.length === want.length && timingSafeEqual(got, want);
}

// --- Stage 27: your devices --------------------------------------------------------------------
// Each signed-in browser is one row in auth_sessions. Its public id is the first 12 characters of the token's hash.

export const deviceId = (sessionId: string) => sessionId.slice(0, 12);
export const currentSessionId = (token: string | undefined) => (token ? hashToken(token) : null);

export async function devicesOf(userId: string, token: string | undefined) {
  const current = currentSessionId(token);
  const rows = await db
    .select({ id: authSessions.id, userAgent: authSessions.userAgent, createdAt: authSessions.createdAt, lastUsedAt: authSessions.lastUsedAt })
    .from(authSessions)
    .where(and(eq(authSessions.userId, userId), gt(authSessions.expiresAt, new Date())))
    .orderBy(desc(authSessions.lastUsedAt));
  return rows.map((r) => ({ id: deviceId(r.id), userAgent: r.userAgent ?? "", createdAt: r.createdAt, lastUsedAt: r.lastUsedAt, current: r.id === current }));
}

/** Sign out one device (by its public id), every other device, or everything */
export async function endSessionsOf(userId: string, which: { deviceId?: string; except?: string | null }): Promise<number> {
  const rows = await db.select({ id: authSessions.id }).from(authSessions).where(eq(authSessions.userId, userId));
  const gone = rows.filter((r) => (which.deviceId ? deviceId(r.id) === which.deviceId : r.id !== which.except));
  for (const r of gone) {
    await db.delete(authSessions).where(eq(authSessions.id, r.id));
    await forget(r.id);
  }
  return gone.length;
}
/** After a change to the person (PIN, pause, rename by the admin): every browser of theirs sees it at once */
export async function forgetAllOf(userId: string): Promise<void> {
  const rows = await db.select({ id: authSessions.id }).from(authSessions).where(eq(authSessions.userId, userId));
  for (const r of rows) await forget(r.id);
}

// --- Stage 27: one-time sign-in codes ------------------------------------------------------------
// Easy to read out or type on a phone: no 0/O, 1/I/L. Only the hash is stored; a code works once.

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_MINUTES = { device: 5, claim: 24 * 60 } as const;
export async function makeSignInCode(userId: string, kind: "device" | "claim"): Promise<{ code: string; expiresAt: Date }> {
  const code = Array.from({ length: kind === "claim" ? 8 : 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join("");
  const expiresAt = new Date(Date.now() + CODE_MINUTES[kind] * 60_000);
  // one live code of each kind per person
  await db.delete(signInCodes).where(and(eq(signInCodes.userId, userId), eq(signInCodes.kind, kind)));
  await db.insert(signInCodes).values({ id: hashToken(code), userId, kind, expiresAt });
  return { code, expiresAt };
}
export async function useSignInCode(code: string): Promise<{ userId: string; kind: "device" | "claim" } | null> {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [row] = await db
    .delete(signInCodes)
    .where(and(eq(signInCodes.id, hashToken(clean)), gt(signInCodes.expiresAt, new Date())))
    .returning();
  return row ? { userId: row.userId, kind: row.kind } : null;
}

