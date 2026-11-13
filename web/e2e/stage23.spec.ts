// Stage 23 · Ngõ Pháo: start a room, play a match with bots through the game server.
import { expect, test } from "@playwright/test";

test("start a Ngõ Pháo match with bots and play", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
  await page.request.post("/api/me", { data: { name: `Lan ${Math.random().toString(36).slice(2, 7)}` } });
  await page.goto("/arena/alley");
  await page.getByRole("button", { name: "Start a room" }).click();
  await page.waitForURL(/\/arena\/alley\/[A-Z]{4}$/);
  await page.getByRole("radio", { name: "Dragon horns" }).click();
  await page.getByRole("button", { name: "More bots" }).click(); // 3 bots
  await page.getByRole("button", { name: "Start the match" }).click();

  // Four lantern-heads on the scoreboard, and the round clock running once the 3-2-1 is over
  await expect(page.getByText("Round 1")).toBeVisible();
  for (const bot of ["Bé Pháo", "Kẹo Dừa", "Mèo Mướp"]) await expect(page.getByText(bot, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^0:0[1-9]$/)).toBeVisible({ timeout: 10_000 });
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");
  await expect(page.getByText("🧨 1")).toBeVisible(); // your power-ups show under the alley
});
