// Stage 28: Messages is its own app; a message's menu edits it ("edited") and deletes it with 5 seconds to Undo,
// then both people see "Message deleted"; Settings → Privacy has "Share my milestones".
import { expect, test } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 7);

test("edit and delete a private message from its menu, with Undo", async ({ browser, baseURL }) => {
  const people = await Promise.all(
    ["Lan", "Minh"].map(async (n) => {
      const ctx = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
      const res = await ctx.request.post("/api/me", { data: { name: `${n} ${unique()}`, pin: "2468" } });
      return { ctx, id: (await res.json()).user.id as string };
    }),
  );
  const [lan, minh] = people;
  const page = await lan.ctx.newPage();
  // the chat window (the chat list on the left shows the last message too)
  const chatOf = (p: typeof page) => p.getByRole("region", { name: /^Chat with/ });
  // the old address still works
  await page.goto(`/hobby-hub/messages/${minh.id}`);
  await expect(page).toHaveURL(new RegExp(`/messages/${minh.id}$`));
  const typo = `helo ${unique()}`;
  await page.getByRole("textbox", { name: "Message" }).fill(typo);
  await page.keyboard.press("Enter");
  await expect(chatOf(page).getByText(typo)).toBeVisible();

  const other = await minh.ctx.newPage();
  await other.goto(`/messages/${lan.id}`);
  await expect(chatOf(other).getByText(typo)).toBeVisible();

  // Edit
  await page.getByRole("button", { name: "Message options" }).last().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByText("Editing your message")).toBeVisible();
  const fixed = typo.replace("helo", "hello");
  await page.getByRole("textbox", { name: "Message" }).fill(fixed);
  await page.keyboard.press("Enter");
  await expect(chatOf(page).getByText(fixed)).toBeVisible();
  await expect(chatOf(other).getByText(fixed)).toBeVisible(); // live, on the other phone too
  await expect(chatOf(other).getByText("edited")).toBeVisible();

  // Delete, then Undo
  await page.getByRole("button", { name: "Message options" }).last().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(chatOf(page).getByText("Message deleted")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(chatOf(page).getByText(fixed)).toBeVisible();

  // Delete for real: after 5 seconds both see "Message deleted"
  await page.getByRole("button", { name: "Message options" }).last().click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(chatOf(other).getByText("Message deleted")).toBeVisible({ timeout: 10_000 });
  await expect(chatOf(other).getByText(fixed)).toHaveCount(0);
  await Promise.all(people.map((p) => p.ctx.close()));
});

test("Settings → Privacy: share my milestones", async ({ page }) => {
  await page.request.post("/api/me", { data: { name: `Priv ${unique()}`, pin: "2468" } });
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: /Share my milestones/ });
  await expect(toggle).not.toBeChecked();
  await toggle.click({ force: true });
  await expect(toggle).toBeChecked();
  const me = await (await page.request.get("/api/me")).json();
  expect(me.user.preferences.shareMilestones).toBe(true);
});
