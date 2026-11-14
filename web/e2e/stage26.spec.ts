// Stage 26 · Mầm Thú: start an adventure, walk the island, look at your team, save and come back.
import { expect, test } from "@playwright/test";

test("start Mầm Thú, walk, open the team, save and continue", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
  await page.goto("/arena/sprout");
  await page.getByRole("button", { name: "Start your adventure" }).click();
  await page.getByRole("radio", { name: /Than Hồng/ }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("· Fishing Village")).toBeVisible();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(600);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("t");
  await expect(page.getByText("Your sproutlings")).toBeVisible();
  await expect(page.getByText("Fights #1")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Save and leave" }).click();
  await expect(page.getByRole("button", { name: /Continue: Làng Chài/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nook.sprout.save") ?? "null"));
  expect(saved.team[0].species).toBe("thanHong");
  expect(saved.x).toBeGreaterThan(2); // walked right from the start
});
