// Stage 20: checking Cloudflare Access passes.
//
// With the "tunnel" profile, Nook has a public web address. Cloudflare Access stands in front of it and only lets
// in the people you listed (it emails them a one-time code). When it lets someone in, it adds a signed pass to
// every request: the Cf-Access-Jwt-Assertion header, a JWT signed with your team's keys.
//
// Caddy asks GET /internal/access-check before passing any tunnel request on ("forward_auth"), and we check the
// pass here: signed by your team's keys (fetched from Cloudflare and cached), for your Access application (AUD),
// not expired. Anything else is refused. So if Access were ever switched off or misconfigured, Nook stays
// closed instead of open to the whole internet ("fail closed"). A header someone types in themselves has no valid
// signature, so it doesn't help them.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

type Result = { ok: true; email?: string } | { ok: false; reason: string };

let keys: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;
function keySet(team: string) {
  const url = new URL("/cdn-cgi/access/certs", team).toString();
  if (keys?.url !== url) keys = { url, set: createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000, cacheMaxAge: 60 * 60 * 1000 }) };
  return keys.set;
}

export async function checkAccessPass(token: string | undefined): Promise<Result> {
  const team = config.CF_ACCESS_TEAM_DOMAIN;
  const aud = config.CF_ACCESS_AUD;
  if (!team || !aud) return { ok: false, reason: "not-configured" };
  if (!token) return { ok: false, reason: "no-pass" };
  try {
    const { payload } = await jwtVerify(token, keySet(team), { issuer: team.replace(/\/$/, ""), audience: aud, algorithms: ["RS256"] });
    return { ok: true, email: (payload as JWTPayload & { email?: string }).email };
  } catch {
    return { ok: false, reason: "bad-pass" };
  }
}
