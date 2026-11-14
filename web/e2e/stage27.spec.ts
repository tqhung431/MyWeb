// Stage 27: a name you can get back. Pick a name with a PIN, then sign in on a second browser with the PIN,
// and on a third with a code made on the first.
import { expect, test } from "@playwright/test";

test("a name with a PIN works on another device, by PIN or by code", async ({ browser }) => {
  const name = `Pin ${Math.random().toString(36).slice(2, 7)}`;
  const open = async () => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
    return ctx.newPage();
  };

  // 1. a new name, with a PIN, on the You page
  const first = await open();
  await first.goto("/account");
  const main = first.locator("main");
  await main.getByRole("textbox", { name: "Your name" }).fill(name);
  await main.getByLabel("PIN", { exact: true }).fill("4826");
  await main.getByLabel("PIN again").fill("4826");
  await main.getByRole("button", { name: "Let's go" }).click();
  await expect(first.getByText(name).first()).toBeVisible();

  // 2. a second browser: name + PIN
  const second = await open();
  await second.goto("/account");
  await second.locator("main").getByRole("button", { name: "I have a name" }).click();
  await second.locator("main").getByRole("textbox", { name: "Name" }).fill(name.toUpperCase());
  await second.locator("main").getByLabel("PIN", { exact: true }).fill("4826");
  await second.locator("main").getByRole("button", { name: "Sign in" }).click();
  await expect(second.getByText(name).first()).toBeVisible();

  // 3. a code made in Settings → Your devices
  await first.goto("/settings");
  await first.getByRole("button", { name: "Sign in another device" }).click();
  const code = (await first.locator("#devices p.font-mono").textContent())!.trim();
  const third = await open();
  await third.goto("/account");
  await third.locator("main").getByRole("button", { name: "I have a code" }).click();
  await third.locator("main").getByLabel("Sign-in code").fill(code);
  await third.locator("main").getByRole("button", { name: "Sign in" }).click();
  await expect(third.getByText(name).first()).toBeVisible();

  // the first browser now lists three devices
  await first.reload();
  await expect(first.locator("#devices li")).toHaveCount(3);
});
