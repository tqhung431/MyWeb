// "Continue with GitHub" — OAuth 2.0 Authorization Code flow.
//
// GET /api/auth/github           → sends the browser to GitHub's "Authorize MyWeb?" page
// GET /api/auth/github/callback  ← GitHub sends the browser back here with a one-time code
//
// We never see the person's GitHub password. GitHub tells us who they are, and we create
// (or find) a MyWeb account and start our own session, exactly like a password login.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router, type Response } from "express";
import { z } from "zod";
import { claimAnonymousSessions, startSession } from "../auth/sessions.js";
import { config, githubEnabled } from "../config.js";
import { db } from "../db/client.js";
import { oauthAccounts, users, type User } from "../db/schema.js";
import { rateLimit } from "../middleware/security.js";

export const githubRouter = Router();

const STATE_COOKIE = "myweb_oauth";
const callbackUrl = `${config.PUBLIC_URL}/api/auth/github/callback`;

const tempCookie = {
  httpOnly: true,
  sameSite: "lax" as const, // must be lax: GitHub's redirect back is a top-level navigation
  secure: config.NODE_ENV === "production",
  path: "/api/auth/github",
  maxAge: 10 * 60 * 1000, // the login must finish within 10 minutes
};

const fail = (res: Response, reason: string) => res.redirect(`/login?error=${encodeURIComponent(reason)}`);

// Only allow returning to our own pages ("/chill"), never "https://evil.example".
const safeNext = (next: unknown) => (typeof next === "string" && /^\/(?!\/)/.test(next) ? next : "/");

// Step 1: send the browser to GitHub.
githubRouter.get("/", rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  if (!githubEnabled) return fail(res, "github_off");

  // state: a random value we check on the way back, so nobody can trick a browser into
  //        finishing a login it never started (login CSRF).
  // PKCE:  a secret (verifier) whose hash (challenge) goes to GitHub now; the secret itself
  //        is only sent when trading the code, so a stolen code alone is useless.
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  res.cookie(
    STATE_COOKIE,
    JSON.stringify({ state, verifier, next: safeNext(req.query.next), clientId: req.query.clientId }),
    tempCookie,
  );

  const url = new URL(config.GITHUB_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.GITHUB_CLIENT_ID!,
    redirect_uri: callbackUrl,
    scope: "read:user user:email", // ask only for what we need
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    allow_signup: "true",
  }).toString();
  res.redirect(url.toString());
});

const saved = z.object({ state: z.string(), verifier: z.string(), next: z.string(), clientId: z.string().optional() });
const ghUser = z.object({ id: z.number(), login: z.string(), name: z.string().nullable(), avatar_url: z.string().nullable() });
const ghEmails = z.array(z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }));

// Step 2: GitHub sends the browser back with ?code=...&state=...
githubRouter.get("/callback", async (req, res) => {
  if (!githubEnabled) return fail(res, "github_off");

  let stored: z.infer<typeof saved>;
  try {
    stored = saved.parse(JSON.parse(req.cookies?.[STATE_COOKIE] ?? ""));
  } catch {
    return fail(res, "github_expired");
  }
  res.clearCookie(STATE_COOKIE, { ...tempCookie, maxAge: undefined });

  const { code, state } = req.query;
  if (typeof code !== "string" || typeof state !== "string" || !sameString(state, stored.state)) {
    return fail(res, "github_state");
  }

  let profile: z.infer<typeof ghUser>;
  let email: string | undefined;
  try {
    // Step 3: trade the one-time code (+ PKCE secret) for an access token. Server to server.
    const tokenRes = await fetch(config.GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET, // the secret never leaves the server
        code,
        redirect_uri: callbackUrl,
        code_verifier: stored.verifier,
      }),
    });
    const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!token.access_token) return fail(res, "github_token");

    // Step 4: ask GitHub who this is.
    const gh = async (path: string) => {
      const r = await fetch(`${config.GITHUB_API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "MyWeb" },
      });
      if (!r.ok) throw new Error(`GitHub ${path} answered ${r.status}`);
      return r.json();
    };
    profile = ghUser.parse(await gh("/user"));
    email = ghEmails.parse(await gh("/user/emails")).find((e) => e.primary && e.verified)?.email.toLowerCase();
  } catch (error) {
    console.error("GitHub login failed:", error); // GitHub down, or an unexpected answer
    return fail(res, "github_failed");
  }
  if (!email) return fail(res, "github_email");

  // Step 5: find or create the MyWeb user, then log in like any other user.
  const user = await findOrCreateUser(String(profile.id), email, profile.name ?? profile.login, profile.avatar_url);
  await startSession(res, user.id, req.get("user-agent"));
  await claimAnonymousSessions(user.id, stored.clientId);
  res.redirect(stored.next);
});

async function findOrCreateUser(githubId: string, email: string, name: string, avatarUrl: string | null): Promise<User> {
  return db.transaction(async (tx) => {
    // 1. This GitHub account was linked before → that user.
    const [linked] = await tx
      .select({ user: users })
      .from(oauthAccounts)
      .innerJoin(users, eq(users.id, oauthAccounts.userId))
      .where(and(eq(oauthAccounts.provider, "github"), eq(oauthAccounts.providerUserId, githubId)));
    if (linked) return linked.user;

    // 2. Same verified email as an existing account → link GitHub to it.
    //    3. Otherwise → new account without a password.
    let [user] = await tx.select().from(users).where(eq(users.email, email));
    if (!user) [user] = await tx.insert(users).values({ email, name, avatarUrl }).returning();
    else if (!user.avatarUrl && avatarUrl) [user] = await tx.update(users).set({ avatarUrl }).where(eq(users.id, user.id)).returning();

    await tx.insert(oauthAccounts).values({ provider: "github", providerUserId: githubId, userId: user.id });
    return user;
  });
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
