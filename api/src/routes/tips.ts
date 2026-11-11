// GET /api/tips          → all tips (short form)
// GET /api/tips/:slug    → one tip, or 404

import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { tips } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";

export const tipsRouter = Router();

tipsRouter.get("/", async (_req, res) => {
  const rows = await db
    .select({ slug: tips.slug, title: tips.title, summary: tips.summary, minutes: tips.minutes })
    .from(tips)
    .orderBy(asc(tips.id));
  res.json(rows);
});

const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,60}$/) });

tipsRouter.get("/:slug", async (req, res) => {
  const { slug } = slugParam.parse(req.params);
  const [tip] = await db.select().from(tips).where(eq(tips.slug, slug));
  if (!tip) throw new HttpError(404, "Tip not found");
  res.json(tip);
});
