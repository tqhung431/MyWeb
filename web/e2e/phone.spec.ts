// On a phone: the tab bar works and the arcade fits the screen.
import { expect, test } from "@playwright/test";
import { visit } from "./helpers";

test("phone: tab bar to Music, arcade game fits", async ({ page }) => {
  await visit(page, "/");
  await page.getByRole("navigation").getByRole("link", { name: "Music" }).last().click();
  await expect(page).toHaveURL(/\/music/);
  await visit(page, "/arcade/pancakes");
  await page.getByRole("button", { name: "Play" }).click();
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0); // no sideways scrolling
});
