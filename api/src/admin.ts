// Stage 27: who is the admin, and the admin log.
//
// Being admin belongs to a browser that typed the passcode in .env (never to a name: a name is easy to claim),
// and ends after 12 hours (auth/sessions.ts). Everything the admin does is written to admin_log.

import type { Request } from "express";
import { COOKIE_NAME, isAdminToken } from "./auth/sessions.js";
import { config } from "./config.js";
import { db } from "./db/client.js";
import { adminLog } from "./db/schema.js";
import { HttpError } from "./middleware/errors.js";

export const MIN_PASSCODE = 16;

/** Why admin can't be used right now (null = it can) */
export function adminProblem(req: Request): "off" | "short" | "https" | null {
  if (!config.ADMIN_PASSCODE) return "off";
  if (config.ADMIN_PASSCODE.length < MIN_PASSCODE) return "short";
  // On the home network over plain http, the passcode would travel unencrypted: only over https
  if (config.ADMIN_REQUIRE_HTTPS && !req.secure && !["localhost", "127.0.0.1", "::1"].includes(req.hostname)) return "https";
  return null;
}

export async function isAdmin(req: Request): Promise<boolean> {
  if (!req.user || !config.ADMIN_PASSCODE || config.ADMIN_PASSCODE.length < MIN_PASSCODE) return false;
  return isAdminToken(req.cookies?.[COOKIE_NAME]);
}
export async function requireAdmin(req: Request): Promise<void> {
  if (!(await isAdmin(req))) throw new HttpError(403, "Only the admin can do this");
}

export async function logAdmin(req: Request, action: string, detail = ""): Promise<void> {
  await db.insert(adminLog).values({ byUserId: req.user?.id ?? null, byName: req.user?.name ?? "a guest", action, detail: detail.slice(0, 300) });
}
