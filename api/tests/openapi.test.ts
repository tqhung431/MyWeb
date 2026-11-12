// Stage 19: the OpenAPI document lists every route, and its request rules come from the routes' own Zod schemas.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ENDPOINTS } from "../src/openapi.js";
import { closeAll } from "./helpers.js";

const app = createApp();
afterAll(closeAll);

const src = path.join(import.meta.dirname, "../src");

// Every "xRouter.get('/path'" in src/routes, with the prefix app.ts mounts that router on
function routesInCode() {
  const appTs = readFileSync(path.join(src, "app.ts"), "utf8");
  const mounts = Object.fromEntries([...appTs.matchAll(/app\.use\("([^"]+)", (\w+Router)\)/g)].map((m) => [m[2], m[1]]));
  const found: string[] = [];
  for (const file of readdirSync(path.join(src, "routes"))) {
    const code = readFileSync(path.join(src, "routes", file), "utf8");
    for (const m of code.matchAll(/(\w+Router)\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      const prefix = mounts[m[1]];
      if (!prefix) continue;
      const p = (prefix + (m[3] === "/" ? "" : m[3])).replace(/:(\w+)/g, "{$1}");
      found.push(`${m[2]} ${p}`);
    }
  }
  return found;
}

describe("OpenAPI", () => {
  it("lists every route in src/routes, and nothing that doesn't exist", () => {
    const code = routesInCode()
      .filter((r) => r.split(" ")[1].startsWith("/api/"))
      .sort(); // /internal/* is for Caddy only, not part of the public API
    const documented = ENDPOINTS.filter((e) => e.path.startsWith("/api/"))
      .map((e) => `${e.method} ${e.path}`)
      .sort();
    expect(code.length).toBeGreaterThanOrEqual(70);
    expect(documented).toEqual(code);
  });

  it("is served as JSON, with request bodies taken from the Zod rules", async () => {
    const res = await request(app).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    const pickName = res.body.paths["/api/me"].post.requestBody.content["application/json"].schema;
    expect(pickName.required).toEqual(["name"]);
    expect(pickName.properties.name).toMatchObject({ type: "string" });
    const score = res.body.paths["/api/arcade/scores"].post.requestBody.content["application/json"].schema;
    expect(score.properties.game.enum).toContain("worm");
    const charts = res.body.paths["/api/songs"].get.parameters.map((p: { name: string }) => p.name);
    expect(charts).toEqual(expect.arrayContaining(["period", "genre", "q", "limit", "offset"]));
    expect(res.body.paths["/api/habits"].get.security).toEqual([{ session: [] }]);
  });
});
