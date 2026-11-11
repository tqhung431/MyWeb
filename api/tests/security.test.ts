import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/errors.js";
import { rateLimit } from "../src/middleware/security.js";

describe("rateLimit", () => {
  it("allows `max` requests per window, then answers 429 with Retry-After", async () => {
    const app = express();
    app.get("/", rateLimit({ windowMs: 60_000, max: 3, key: () => "test" }), (_req, res) => {
      res.send("ok");
    });
    app.use(errorHandler);

    for (let i = 0; i < 3; i++) expect((await request(app).get("/")).status).toBe(200);
    const blocked = await request(app).get("/");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("rateLimit with a custom key", () => {
  it("counts each key separately (e.g. per email)", async () => {
    const app = express();
    app.use(express.json());
    app.post("/", rateLimit({ windowMs: 60_000, max: 1, key: (req) => req.body.email }), (_req, res) => {
      res.send("ok");
    });
    app.use(errorHandler);

    expect((await request(app).post("/").send({ email: "a@x.io" })).status).toBe(200);
    expect((await request(app).post("/").send({ email: "a@x.io" })).status).toBe(429);
    expect((await request(app).post("/").send({ email: "b@x.io" })).status).toBe(200);
  });
});
