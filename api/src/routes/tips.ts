// GET /api/tips          → all tips (short form)
// GET /api/tips/:slug    → one tip, or 404
//
// Stage 5: answers come from the Valkey cache when possible (see X-Cache: HIT / MISS in DevTools).

import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { tips } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { cached } from "../valkey/cache.js";

const TTL = 300; // seconds: tips rarely change

export const tipsRouter = Router();

tipsRouter.get("/", async (_req, res) => {
  const { value, hit } = await cached("tips:list", TTL, () =>
    db
      .select({ slug: tips.slug, title: tips.title, summary: tips.summary, minutes: tips.minutes })
      .from(tips)
      .orderBy(asc(tips.id)),
  );
  res.set("X-Cache", hit ? "HIT" : "MISS").json(value);
});

const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,60}$/) });

tipsRouter.get("/:slug", async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const { value: tip, hit } = await cached(`tips:${slug}`, TTL, async () => {
    const [row] = await db.select().from(tips).where(eq(tips.slug, slug));
    return row ?? null; // "no such tip" is cached too, so repeated bad links don't hit the database
  });
  if (!tip) throw new HttpError(404, "Tip not found");
  res.set("X-Cache", hit ? "HIT" : "MISS").json(tip);
});
