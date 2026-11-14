// On a phone: the tab bar works, and no page is wider than the screen, even with long names around.
import { expect, test } from "@playwright/test";
import { pickName, visit } from "./helpers";

const LONG = "Extraordinarily-long-group-name-without-any-spaces-at-all";

test("phone: tab bar to Messages, arcade game fits", async ({ page }) => {
  await visit(page, "/");
  await page.getByRole("navigation").getByRole("link", { name: "Messages" }).last().click(); // Stage 28: Messages took Music's place
  await expect(page).toHaveURL(/\/messages/);
  await visit(page, "/arcade/pancakes");
  await page.getByRole("button", { name: "Play" }).click();
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0); // no sideways scrolling
});

// Stage 19 fix: Home's live feed made the page wider than the phone when someone had a long group name,
// so the page slid sideways and taps landed on the wrong thing.
test("phone: no sideways scrolling with long names in the live feed", async ({ page }) => {
  await pickName(page, "Long");
  const res = await page.request.post("/api/hobby/groups", {
    data: { name: `${LONG.slice(0, 33)}-${Math.random().toString(36).slice(2, 7)}`, emoji: "📏", description: "x" },
  });
  expect(res.ok()).toBe(true);
  for (const path of ["/", "/hobby-hub", "/messages", "/arcade", "/habits", "/music", "/watchlist", "/games"]) {
    await visit(page, path);
    await page.waitForTimeout(400);
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(extra, `${path} is wider than the screen`).toBeLessThanOrEqual(0);
  }
});
