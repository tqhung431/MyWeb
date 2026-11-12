// The Free-time Companion (Stage 9).
//
// GET  /api/companion/status   is the AI on, reachable, are the models downloaded, how much is indexed
// POST /api/companion/chat     { messages: [{ role, content }, …] }  → a STREAM (Server-Sent Events):
//
//   event: sources   data: [ {kind:"song", title, audioUrl, …}, {kind:"tip", …} ]   (sent first)
//   event: token     data: {"t":"Try "}                                             (many, as it's written)
//   event: done      data: {}
//   event: error     data: {"message":"…"}
//
// Why stream? A small model on a normal PC writes maybe 10–40 words a second. Showing words as they
// arrive feels fast; waiting for the whole answer would feel broken.

import { Router } from "express";
import { z } from "zod";
import { buildMessages, toSources } from "../ai/companion.js";
import { knowledgeCount, search } from "../ai/knowledge.js";
import { AiUnavailable, aiEnabled, aiStatus, chatStream } from "../ai/ollama.js";
import { config } from "../config.js";
import { enqueue } from "../jobs/queue.js";
import { HttpError } from "../middleware/errors.js";
import { rateLimit } from "../middleware/security.js";
import { ownerRoom } from "../realtime/emit.js";
import { owner } from "./sessions.js";

export const companionRouter = Router();

companionRouter.get("/status", async (_req, res) => {
  const status = await aiStatus();
  const ready = status.reachable && status.models.chat && status.models.embed;
  const indexed = status.reachable ? await knowledgeCount() : 0;
  // Models just finished downloading and nothing is indexed yet: let the worker do it now.
  if (ready && indexed === 0) void enqueue("reindex", {}).catch(() => {});
  res.json({ ...status, ready, chatModel: config.AI_CHAT_MODEL, embedModel: config.AI_EMBED_MODEL, indexed });
});

export const chatBody = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20) // the last 20 messages are plenty of context for a small model
    .refine((m) => m[m.length - 1].role === "user", "The last message must be yours"),
});

// A small model still takes real work from your PC: 20 questions a minute per person is generous.
const chatLimit = rateLimit({ name: "companion", windowMs: 60_000, max: 20, key: (req) => ownerRoom(owner(req)) });

companionRouter.post("/chat", chatLimit, async (req, res) => {
  if (!aiEnabled()) throw new HttpError(503, "The Companion is off on this Nook (no Ollama configured)");
  const { messages } = chatBody.parse(req.body);
  const o = owner(req);

  // 1. Find the Nook items closest in meaning to the question (before streaming starts,
  //    so problems like "model not downloaded" can still be a normal 503 answer).
  let found;
  try {
    found = await search(messages[messages.length - 1].content);
  } catch (error) {
    if (error instanceof AiUnavailable) throw new HttpError(503, error.message);
    throw error;
  }
  const sources = await toSources(found);
  const prompt = await buildMessages({ history: messages, found, owner: o, user: req.user });

  // 2. Stream: headers now, then events as they come
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform", // no-transform: proxies mustn't compress/buffer it
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("sources", sources);

  // Closing the tab or pressing Stop ends the request: stop the model too, so it doesn't work for nobody.
  const stop = new AbortController();
  res.on("close", () => stop.abort());

  try {
    for await (const piece of chatStream(prompt, stop.signal)) send("token", { t: piece });
    send("done", {});
  } catch (error) {
    if (!stop.signal.aborted) send("error", { message: error instanceof AiUnavailable ? error.message : "The Companion stopped unexpectedly" });
  }
  res.end();
});
