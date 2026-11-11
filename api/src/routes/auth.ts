// POST /api/auth/register   create an account and sign in
// POST /api/auth/login      sign in with email + password
// POST /api/auth/logout     sign out (deletes the session)
// GET  /api/auth/me         who am I? → { user } or { user: null }
// GET  /api/auth/providers  which sign-in methods are switched on

import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { burnTime, hashPassword, verifyPassword } from "../auth/password.js";
import { claimAnonymousSessions, COOKIE_NAME, endSession, publicUser, startSession } from "../auth/sessions.js";
import { config, githubEnabled } from "../config.js";
import { db } from "../db/client.js";
import { oauthAccounts, users } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { githubRouter } from "./github.js";

export const authRouter = Router();

const email = z
  .email({ message: "Enter a valid email" })
  .max(254)
  .transform((e) => e.trim().toLowerCase());
const password = z.string().min(8, "Use at least 8 characters").max(128);

const registerBody = z.object({ email, password, name: z.string().trim().min(1, "Enter your name").max(60) });
const loginBody = z.object({ email, password: z.string().min(1).max(128) });

// Two limits, both "10 tries per 15 minutes" (configurable):
// - per IP: slows down one machine trying many accounts
// - per email: protects each account even if an attacker fakes or rotates IPs.
//   (Through the Next.js proxy the API can't fully trust the IP yet; see docs/stage-4.md.)
const WINDOW = 15 * 60 * 1000;
const authLimit = rateLimit({ windowMs: WINDOW, max: config.AUTH_RATE_LIMIT });
const perEmailLimit = rateLimit({
  windowMs: WINDOW,
  max: config.AUTH_RATE_LIMIT,
  key: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

authRouter.post("/register", authLimit, async (req, res) => {
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
});

authRouter.post("/login", authLimit, perEmailLimit, async (req, res) => {
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
});

authRouter.post("/logout", async (req, res) => {
  await endSession(res, req.cookies?.[COOKIE_NAME]);
  res.status(204).end(); // 204 No Content
});

authRouter.get("/me", async (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const linked = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, req.user.id));
  res.json({
    user: publicUser(req.user),
    methods: { password: req.user.passwordHash !== null, providers: linked.map((l) => l.provider) },
  });
});

authRouter.get("/providers", (_req, res) => {
  res.json({ password: true, github: githubEnabled });
});

authRouter.use("/github", githubRouter);
