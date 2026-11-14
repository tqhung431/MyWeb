// /api/arena belongs to the game server. If it reaches the API, Caddy is still running its settings from before
// Stage 22: say so (the Arena page shows the one command that fixes it) instead of a bare 404.
import request from "supertest";
import { afterAll, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeAll } from "./helpers.js";

const app = createApp();
afterAll(closeAll);

it("explains an old Caddy when /api/arena reaches the API", async () => {
  for (const path of ["/api/arena?EIO=4&transport=polling", "/api/arena/?EIO=4&transport=polling"]) {
    const res = await request(app).get(path);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("old-caddy");
    expect(res.body.error).toContain("docker compose up -d --force-recreate caddy");
  }
});
