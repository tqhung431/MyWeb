// Stage 21: Settings → Vietnamese, and a private chat between two people.
import { expect, test } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 7);

test("Settings switches Nook to Vietnamese and back", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("radio", { name: /Tiếng Việt/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await page.getByRole("radio", { name: /English/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("two people chat privately; a third can't see it", async ({ browser, baseURL }) => {
  const people = await Promise.all(
    ["Lan", "Minh", "Tú"].map(async (n) => {
      const ctx = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
      const res = await ctx.request.post("/api/me", { data: { name: `${n} ${unique()}`, pin: "2468" } });
      return { ctx, id: (await res.json()).user.id as string };
    }),
  );
  const [lan, minh, tu] = people;
  const text = `secret ${unique()}`;

  const page = await lan.ctx.newPage();
  await page.goto(`/messages/${minh.id}`);
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.keyboard.press("Enter");
  await expect(page.getByText(text)).toBeVisible();

  const other = await minh.ctx.newPage();
  await other.goto(`/messages/${lan.id}`);
  await expect(other.getByText(text).last()).toBeVisible();
  await expect(page.getByText("Seen")).toBeVisible(); // Lan sees that Minh read it

  const outsider = await tu.ctx.request.get(`/api/hobby/dms/${lan.id}`);
  expect(JSON.stringify(await outsider.json())).not.toContain(text);
  await Promise.all(people.map((p) => p.ctx.close()));
});
