// Stage 29: a Hobby Hub group's posts and chat are for its members; Chill Corner is now Focus Room (/focus);
// Settings only says whether admin is on.
import { expect, test } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 6);

test("a group is members-only: join to read, leave and it's hidden again", async ({ browser, baseURL }) => {
  const make = async (name: string) => {
    const ctx = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
    await ctx.request.post("/api/me", { data: { name: `${name} ${unique()}`, pin: "2468" } });
    return ctx;
  };
  const owner = await make("Owner");
  const res = await owner.request.post("/api/hobby/groups", { data: { name: `Secret garden ${unique()}`, emoji: "🌷" } });
  const { slug } = (await res.json()) as { slug: string };
  const post = `Tulips are up ${unique()}`;
  await owner.request.post(`/api/hobby/groups/${slug}/posts`, { data: { body: post } });

  const visitor = await make("Visitor");
  const page = await visitor.newPage();
  await page.goto(`/hobby-hub/${slug}`);
  await expect(page.getByText("Posts and chat are for members")).toBeVisible();
  await expect(page.getByText(post)).toHaveCount(0);
  await expect(page.getByText("1 member")).toBeVisible();

  await page.getByRole("button", { name: /^Join Secret garden/ }).click();
  await expect(page.getByText(post)).toBeVisible();

  await page.getByRole("button", { name: "Leave" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Leave" }).click();
  await expect(page.getByText("Posts and chat are for members")).toBeVisible();
  await expect(page.getByText(post)).toHaveCount(0);
  await Promise.all([owner.close(), visitor.close()]);
});

test("Chill Corner is now Focus Room, and the old address still works", async ({ page }) => {
  await page.goto("/chill/tips");
  await expect(page).toHaveURL(/\/focus\/tips$/);
  await expect(page.getByRole("heading", { level: 1, name: "Focus Room" })).toBeVisible();
});
