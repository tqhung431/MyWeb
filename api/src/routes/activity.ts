// GET /api/activity → the last 20 things that happened (newest first), for the live feed.
// New events arrive over the WebSocket; this is for pages rendered on the server.

import { Router } from "express";
import { recentActivity } from "../realtime/emit.js";

export const activityRouter = Router();

activityRouter.get("/", async (_req, res) => {
  res.json(await recentActivity());
});
