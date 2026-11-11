// Turns every error into a clear JSON answer with the right HTTP status code.

import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

// Throw this from a route to send a specific status, e.g. new HttpError(404, "Tip not found").
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    // 400 Bad Request: the client sent data in the wrong shape
    res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "That's too big to send" });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Body is not valid JSON" });
    return;
  }
  // Anything else is our bug: log the details, but don't leak them to the client.
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
