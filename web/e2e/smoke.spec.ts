// Every app's page opens without errors in the browser.
import { expect, test } from "@playwright/test";
import { visit } from "./helpers";

const PAGES = ["/", "/focus", "/music", "/arcade", "/watchlist", "/hobby-hub", "/habits", "/arcade-online", "/games", "/games/van-lo", "/about", "/design"];

for (const path of PAGES) {
  test(`${path} opens`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await visit(page, path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1, h2").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
