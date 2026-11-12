// Mini Arcade: play Hungry Worm until it crashes, and see the score saved.
import { expect, test } from "@playwright/test";
import { visit } from "./helpers";

test("Hungry Worm: countdown, play, crash, score saved", async ({ page }) => {
  await visit(page, "/arcade/worm");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByText("3", { exact: true })).toBeVisible(); // the countdown
  await expect(page.getByRole("img", { name: /Hungry Worm board/ })).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("ArrowUp"); // straight into the top wall
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText(/#\d+ on Nook/)).toBeVisible();
  // Space plays again
  await page.keyboard.press("Space");
  await expect(page.getByText("3", { exact: true })).toBeVisible();
});

test("the lobby lists six games", async ({ page }) => {
  await visit(page, "/arcade");
  await expect(page.locator('a[href^="/arcade/"]').filter({ hasText: /./ })).toHaveCount(6 + 1); // 6 games + the Leaderboards tab
});
