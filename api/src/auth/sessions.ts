// Server-side login sessions.
//
// Login = create a random token, store its hash in auth_sessions, give the token to the
// browser in an httpOnly cookie. Every request: hash the cookie's token, look it up.
// Logout = delete the row. The token is useless from that moment on.

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { CookieOptions, Response } from "express";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { authSessions, focusSessions, users, type User } from "../db/schema.js";

export const COOKIE_NAME = "myweb_session";
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the page can't read it, so an XSS bug can't steal it
  sameSite: "lax", // not sent with requests started by other websites (except plain links)
  secure: config.NODE_ENV === "production", // HTTPS only in production
  path: "/",
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(res: Response, userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString("base64url"); // 256 random bits: impossible to guess
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.insert(authSessions).values({ id: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, expires: expiresAt });
}

export async function endSession(res: Response, token: string | undefined): Promise<void> {
  if (token) await db.delete(authSessions).where(eq(authSessions.id, hashToken(token)));
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export type PublicUser = Pick<User, "id" | "email" | "name" | "createdAt">;

export function publicUser(user: User): PublicUser {
  // Never send password_hash to the browser.
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

// Look up who owns this token. Also renews sessions that are past halfway, so active people stay logged in.
export async function userFromToken(token: string | undefined, res: Response): Promise<User | null> {
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({ user: users, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, id), gt(authSessions.expiresAt, new Date())));
  if (!row) return null;

  if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
    await db.update(authSessions).set({ expiresAt }).where(eq(authSessions.id, id));
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, expires: expiresAt });
  }
  return row.user;
}

// After sign-up or login: move this browser's anonymous focus sessions into the account.
export async function claimAnonymousSessions(userId: string, clientId: string | undefined): Promise<void> {
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) return;
  await db
    .update(focusSessions)
    .set({ userId })
    .where(and(eq(focusSessions.clientId, clientId), isNull(focusSessions.userId)));
}
