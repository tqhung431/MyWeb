// Runs on every request: "who is this?" → req.user (or null).

import type { RequestHandler } from "express";
import { COOKIE_NAME, touchLastSeen, userFromToken } from "../auth/sessions.js";
import type { User } from "../db/schema.js";
import { HttpError } from "./errors.js";

declare global {
  namespace Express {
    interface Request {
      user: User | null;
    }
  }
}

export const loadUser: RequestHandler = async (req, res, next) => {
  req.user = await userFromToken(req.cookies?.[COOKIE_NAME], res);
  if (req.user) await touchLastSeen(req.user);
  next();
};

// Put this before routes that need to know your name (posting, chatting…).
export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, "Pick a name first");
  next();
};

// Stage 27: someone the admin paused can still read everything, but can't post, chat or change things, until then.
// Their own account stays theirs: /api/me (PIN, devices, delete me) and signing in still work.
export const blockPaused: RequestHandler = (req, _res, next) => {
  const until = req.user?.pausedUntil ? new Date(req.user.pausedUntil) : null;
  if (until && until.getTime() > Date.now() && req.method !== "GET" && req.method !== "HEAD" && !req.path.startsWith("/api/me")) {
    throw new HttpError(403, "The admin paused you for now. You can still read everything.");
  }
  next();
};
