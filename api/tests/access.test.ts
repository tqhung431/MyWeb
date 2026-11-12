// Stage 20: the Cloudflare Access check that Caddy runs before every request through the tunnel.
// A fake Cloudflare team serves its public keys on port 4994; we sign passes with its private key.
import http from "node:http";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 4994;
const TEAM = `http://127.0.0.1:${PORT}`;
const AUD = "nook-test-audience-tag-0123456789";
process.env.CF_ACCESS_TEAM_DOMAIN = TEAM;
process.env.CF_ACCESS_AUD = AUD;

const { createApp } = await import("../src/app.js");
const { closeAll } = await import("./helpers.js");
const app = createApp();

const team = await generateKeyPair("RS256");
const stranger = await generateKeyPair("RS256"); // someone else's keys
let server: http.Server;

beforeAll(async () => {
  const jwk: JWK = { ...(await exportJWK(team.publicKey)), kid: "team-key", alg: "RS256", use: "sig" };
  server = http.createServer((req, res) => {
    if (req.url === "/cdn-cgi/access/certs") res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [jwk] }));
    else res.writeHead(404).end();
  });
  await new Promise<void>((ok) => server.listen(PORT, "127.0.0.1", ok));
});
afterAll(async () => {
  server.close();
  await closeAll();
});

const pass = (o: { key?: CryptoKey; aud?: string; iss?: string; exp?: string; kid?: string } = {}) =>
  new SignJWT({ email: "linh@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: o.kid ?? "team-key" })
    .setIssuer(o.iss ?? TEAM)
    .setAudience(o.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(o.exp ?? "1h")
    .sign(o.key ?? team.privateKey);

const check = (token?: string) => {
  const r = request(app).get("/internal/access-check");
  return token ? r.set("Cf-Access-Jwt-Assertion", token) : r;
};

describe("Cloudflare Access check (tunnel)", () => {
  it("lets in a valid pass, and says who it is", async () => {
    const res = await check(await pass());
    expect(res.status).toBe(204);
    expect(res.headers["x-nook-access-email"]).toBe("linh@example.com");
  });

  it("refuses no pass, a made-up header, someone else's keys, another app, another team, or an old pass", async () => {
    expect((await check()).status).toBe(403);
    expect((await check("let-me-in")).status).toBe(403);
    expect((await check(await pass({ key: stranger.privateKey }))).status).toBe(403);
    expect((await check(await pass({ aud: "some-other-application-aud" }))).status).toBe(403);
    expect((await check(await pass({ iss: "https://evil.cloudflareaccess.com" }))).status).toBe(403);
    expect((await check(await pass({ exp: "-1m" }))).status).toBe(403);
    const res = await check();
    expect(res.text).toContain("Nook is private");
  });

  it("is not reachable as part of the public API", async () => {
    expect((await request(app).get("/api/internal/access-check")).status).toBe(404);
  });
});
