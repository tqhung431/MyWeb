// Stage 19: Lighthouse on every app page of a running Nook, phone settings (Lighthouse's default:
// a mid-range phone on a slow 4G connection). Fails if any score is under the minimum.
//
//   BASE_URL=http://localhost:3000 npm run lighthouse          (a production build: `npm run build && npm start` in web/)
//   MIN=90 PAGES=/,/music npm run lighthouse
//   MIN_PERF=85 …   a separate minimum for performance (CI machines are shared, so their timing varies)
//
// Scores go to the terminal and to report/lighthouse.md. Dev mode (`npm run dev`) is much slower: measure a build.
import { mkdirSync, writeFileSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MIN = Number(process.env.MIN ?? 90);
const MIN_PERF = Number(process.env.MIN_PERF ?? MIN);
const PAGES = (process.env.PAGES ?? "/,/chill,/music,/arcade,/arcade/worm,/watchlist,/hobby-hub,/habits,/arcade-online,/arena,/tv,/games,/games/van-lo,/companion,/about")
  .split(",")
  .map((p) => p.trim());
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const rows = [];
let failed = false;
for (const path of PAGES) {
  // A fresh browser for every page, so one page can't slow down (or crash) the next
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH,
    chromeFlags: ["--headless=new", "--no-sandbox", "--no-proxy-server", "--ignore-certificate-errors"],
  });
  try {
    const result = await lighthouse(`${BASE}${path}`, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: CATEGORIES });
    const lhr = result.lhr;
    const scores = CATEGORIES.map((c) => Math.round((lhr.categories[c]?.score ?? 0) * 100));
    const low = scores.some((s, i) => s < (CATEGORIES[i] === "performance" ? MIN_PERF : MIN));
    failed ||= low;
    // What to fix first: the failing audits with the biggest weight
    const hints = CATEGORIES.flatMap((c) =>
      (lhr.categories[c]?.auditRefs ?? [])
        .filter((r) => r.weight > 0 && (lhr.audits[r.id]?.score ?? 1) < 0.9)
        .map((r) => `${c}: ${lhr.audits[r.id].title}${lhr.audits[r.id].displayValue ? ` (${lhr.audits[r.id].displayValue})` : ""}`),
    );
    rows.push({ path, scores, hints, lcp: lhr.audits["largest-contentful-paint"]?.displayValue, tbt: lhr.audits["total-blocking-time"]?.displayValue });
    console.log(`${low ? "✗" : "✓"} ${path.padEnd(18)} ${scores.map((s) => String(s).padStart(4)).join("")}   LCP ${rows.at(-1).lcp}  TBT ${rows.at(-1).tbt}`);
    if (low) for (const h of hints.slice(0, 6)) console.log(`    · ${h}`);
  } catch (e) {
    failed = true;
    console.log(`✗ ${path.padEnd(18)} Lighthouse couldn't measure it: ${e.message}`);
  } finally {
    await chrome.kill();
  }
}

mkdirSync("report", { recursive: true });
const md = [
  `# Lighthouse (phone settings) · ${new Date().toISOString().slice(0, 10)}`,
  "",
  "| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.path} | ${r.scores.join(" | ")} | ${r.lcp} | ${r.tbt} |`),
].join("\n");
writeFileSync("report/lighthouse.md", md + "\n");
console.log(`\nMinimum ${MIN} (performance ${MIN_PERF}) in every category: ${failed ? "NOT met" : "met"}`);
process.exit(failed ? 1 : 0);
