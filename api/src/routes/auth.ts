// POST /api/auth/register   create an account and sign in
// POST /api/auth/login      sign in with email + password
// POST /api/auth/logout     sign out (deletes the session)
// GET  /api/auth/me         who am I? → { user } or { user: null }
//
// Accounts are optional: everything in Nook works as a guest. An account only adds
// "your history on every device".

import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { burnTime, hashPassword, verifyPassword } from "../auth/password.js";
import { claimAnonymousSessions, COOKIE_NAME, endSession, publicUser, startSession } from "../auth/sessions.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { enqueue } from "../jobs/queue.js";
import { displayName, publishActivity } from "../realtime/emit.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { timeZoneOf } from "./sessions.js";

export const authRouter = Router();

const email = z
  .email({ message: "Enter a valid email" })
  .max(254)
  .transform((e) => e.trim().toLowerCase());
const password = z.string().min(8, "Use at least 8 characters").max(128);

const registerBody = z.object({ email, password, name: z.string().trim().min(1, "Enter your name").max(60) });
const loginBody = z.object({ email, password: z.string().min(1).max(128) });

// Two limits per 15 minutes:
// - per email (10 by default): stops password guessing against one account
// - for everyone together (30× that): a safety net against floods from scripts.
//   We can't count per visitor IP yet (see middleware/security.ts), and a per-IP limit
//   would make everyone on the network share one counter.
const WINDOW = 15 * 60 * 1000;
const perEmailLimit = rateLimit({
  name: "auth-email",
  windowMs: WINDOW,
  max: config.AUTH_RATE_LIMIT,
  key: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
});
const overallLimit = rateLimit({ name: "auth-all", windowMs: WINDOW, max: config.AUTH_RATE_LIMIT * 30, key: () => "all" });
// Stage 7: behind Caddy (TRUST_PROXY set), req.ip is the visitor's real IP, so we can limit per IP again.
const perIpLimit = rateLimit({ name: "auth-ip", windowMs: WINDOW, max: config.AUTH_RATE_LIMIT * 3, key: (req) => req.ip ?? "?" });
const limits = config.TRUST_PROXY === false ? [overallLimit, perEmailLimit] : [overallLimit, perIpLimit, perEmailLimit];

authRouter.post("/register", ...limits, async (req, res) => {
  const input = registerBody.parse(req.body);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (existing) throw new HttpError(409, "That email already has an account. Try signing in.");

  const [user] = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) })
    .returning();

  await startSession(res, user.id, req.get("user-agent"));
  await claimAnonymousSessions(user.id, req.get("x-client-id"));
  res.status(201).json({ user: publicUser(user) });

  await publishActivity("UserPlus", `${displayName(user.name)} joined Nook`);
  // Stage 5: slow or optional work happens in the background worker.
  await enqueue("welcome-email", { userId: user.id });
  await enqueue("achievements", { userId: user.id, clientId: null, timeZone: timeZoneOf(req) });
});

authRouter.post("/login", ...limits, async (req, res) => {
  const input = loginBody.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, input.email));

  let ok = false;
  if (user?.passwordHash) ok = await verifyPassword(input.password, user.passwordHash);
  else await burnTime(input.password); // take the same time, so timing doesn't reveal the email is unknown

  // Same message for "no such email" and "wrong password": don't tell attackers which emails exist.
  if (!user || !ok) throw new HttpError(401, "Wrong email or password");

  await startSession(res, user.id, req.get("user-agent"));
  await claimAnonymousSessions(user.id, req.get("x-client-id"));
  res.json({ user: publicUser(user) });
  await enqueue("achievements", { userId: user.id, clientId: null, timeZone: timeZoneOf(req) });
});

authRouter.post("/logout", async (req, res) => {
  await endSession(res, req.cookies?.[COOKIE_NAME]);
  res.status(204).end(); // 204 No Content
});

authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});
