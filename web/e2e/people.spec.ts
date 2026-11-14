// Picking a name, then using apps that need one.
import { expect, test } from "@playwright/test";
import { pickName, visit } from "./helpers";

test("pick a name on the account page", async ({ page }) => {
  await visit(page, "/account");
  const name = `Tester ${Math.random().toString(36).slice(2, 7)}`;
  const main = page.locator("main");
  await main.getByRole("textbox", { name: "Your name" }).fill(name);
  await main.getByLabel("PIN", { exact: true }).fill("2468");
  await main.getByLabel("PIN again").fill("2468");
  await main.getByRole("button", { name: "Let's go" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
});

test("add a habit", async ({ page }) => {
  await pickName(page);
  await visit(page, "/habits");
  await page
    .getByRole("button", { name: /new habit/i })
    .first()
    .click();
  const habit = `Stretch ${Math.random().toString(36).slice(2, 6)}`;
  await page.getByRole("textbox", { name: "Habit" }).fill(habit);
  await page.getByRole("button", { name: "Add habit" }).click();
  await expect(page.getByText(habit).first()).toBeVisible();
});

test("post in a Hobby Hub group", async ({ page }) => {
  await pickName(page);
  // A group of our own, so the test doesn't depend on what's already there
  const res = await page.request.post("/api/hobby/groups", {
    data: { name: `Robots ${Math.random().toString(36).slice(2, 6)}`, emoji: "🤖", description: "Made by the end-to-end tests" },
  });
  expect(res.ok()).toBe(true);
  const group = (await res.json()) as { slug: string };
  await visit(page, `/hobby-hub/${group.slug}`);
  const post = `Hello from the robots ${Math.random().toString(36).slice(2, 6)}`;
  await page.getByLabel("New post").fill(post);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(post)).toBeVisible();
});
