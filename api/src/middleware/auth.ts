// Runs on every request: "who is this?" → req.user (or null).

import type { RequestHandler } from "express";
import { COOKIE_NAME, userFromToken } from "../auth/sessions.js";
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
  next();
};

// Put this before routes that only logged-in people may use.
export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, "Please sign in");
  next();
};
