// Stage 20: with no Cloudflare Access settings, the tunnel check refuses everyone ("fail closed").
import request from "supertest";
import { afterAll, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeAll } from "./helpers.js";

const app = createApp();
afterAll(closeAll);

it("refuses every tunnel request until Access is set up", async () => {
  delete process.env.CF_ACCESS_TEAM_DOMAIN;
  const res = await request(app).get("/internal/access-check").set("Cf-Access-Jwt-Assertion", "anything");
  expect(res.status).toBe(403);
  expect(res.text).toContain("hasn't finished setting up");
});
