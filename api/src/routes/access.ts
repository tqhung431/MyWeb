// GET /internal/access-check: asked by Caddy (forward_auth) before every request that comes through the
// Cloudflare tunnel (Stage 20). 204 = let it through; 403 = a short page saying why not.
// Not under /api, and Caddy only sends /api/* to the API, so browsers can't call it directly.

import { Router } from "express";
import { checkAccessPass } from "../access/cloudflare.js";

export const accessRouter = Router();

const WHY: Record<string, string> = {
  "not-configured": "Nook's owner hasn't finished setting up Cloudflare Access (CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD in .env).",
  "no-pass": "This address is protected by Cloudflare Access, but the request didn't come with a pass.",
  "bad-pass": "Your Cloudflare Access pass isn't valid for this Nook. Try signing in again.",
};

accessRouter.get("/access-check", async (req, res) => {
  const result = await checkAccessPass(req.get("cf-access-jwt-assertion"));
  if (result.ok) {
    if (result.email) res.set("X-Nook-Access-Email", result.email);
    return res.status(204).end();
  }
  res.status(403).type("text/plain; charset=utf-8").send(`Nook is private.\n\n${WHY[result.reason]}\n`);
});
