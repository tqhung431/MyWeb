// Stage 24 · Giữ Làng: a solo game runs in the browser; calling the first wave early pays coins.
import { expect, test } from "@playwright/test";

test("play Giữ Làng alone: call the first wave early", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
  await page.goto("/arena/village");
  await page.getByRole("radio", { name: /Terraces/ }).click();
  await page.getByRole("link", { name: "Play alone" }).click();
  await expect(page.getByText("Wave 1/30")).toBeVisible();
  await expect(page.getByText("20/20")).toBeVisible();
  await page.getByRole("button", { name: /Next wave in/ }).click();
  await expect(page.getByText(/\d+ spirits left/)).toBeVisible();
  // ~29 seconds skipped = ~29 coins on top of the 160 to start with
  await expect(page.getByText(/^\s*1[89]\d\s*$/)).toBeVisible();
});
