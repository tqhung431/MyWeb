// PUT /api/me/preferences → save personal settings to your account (signed in only),
// so they follow you to every PC and phone. Guests keep settings in their browser.

import { eq, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { COOKIE_NAME, publicUser, refreshCachedSession } from "../auth/sessions.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { requireUser } from "../middleware/auth.js";

export const meRouter = Router();

const preferences = z.object({
  timer: z
    .object({
      focus: z.number().int().min(1).max(120),
      short: z.number().int().min(1).max(60),
      long: z.number().int().min(1).max(60),
    })
    .optional(),
});

meRouter.put("/preferences", requireUser, async (req, res) => {
  const changes = preferences.parse(req.body);
  // "||" merges JSON objects in PostgreSQL: keys we send replace old ones, others stay.
  const [user] = await db
    .update(users)
    .set({ preferences: sql`${users.preferences} || ${JSON.stringify(changes)}::jsonb` })
    .where(eq(users.id, req.user!.id))
    .returning();
  await refreshCachedSession(req.cookies?.[COOKIE_NAME]);
  res.json({ user: publicUser(user) });
});
