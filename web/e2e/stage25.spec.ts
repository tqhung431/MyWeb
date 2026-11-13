// Stage 25 · Chợ Đêm Brawl: two friends pick heroes, get ready, start a run on the game server and fight wave 1.
import { expect, test } from "@playwright/test";
import { pickName } from "./helpers";

test("two friends start a Chợ Đêm Brawl run", async ({ browser }) => {
  const make = async () => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
    const page = await ctx.newPage();
    const name = await pickName(page, "Brawl");
    return { page, name };
  };
  const host = await make();
  const friend = await make();
  await host.page.goto("/arena/brawl");
  await host.page.getByRole("button", { name: "Start a room" }).click();
  await host.page.waitForURL(/\/arena\/brawl\/[A-Z]{4}$/);
  await friend.page.goto(host.page.url());

  // Each picks a different hero; a taken hero can't be picked
  await host.page.getByRole("radio", { name: /The Chef/ }).click();
  await expect(friend.page.getByRole("radio", { name: /The Chef/ })).toBeDisabled();
  await friend.page.getByRole("radio", { name: /Grandma/ }).click();
  await expect(host.page.getByRole("button", { name: "Start the run" })).toBeDisabled();
  await friend.page.getByRole("button", { name: "I'm ready" }).click();
  await host.page.getByRole("button", { name: "Start the run" }).click();

  for (const p of [host.page, friend.page]) {
    await expect(p.getByText("Noodle Lane", { exact: true })).toBeVisible();
    await expect(p.locator("#main").getByText(friend.name)).toBeVisible();
  }
  await expect(host.page.getByText(/^0:0[3-9]$/)).toBeVisible({ timeout: 10_000 });
  await host.page.keyboard.down("KeyD");
  await host.page.waitForTimeout(400);
  await host.page.keyboard.up("KeyD");
  await host.page.keyboard.press("KeyJ");
  await expect(host.page.getByText(/Wave 1/)).toBeVisible();
});
