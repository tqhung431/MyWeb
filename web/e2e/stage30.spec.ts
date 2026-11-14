// Stage 30: one Games app (every game once, one Leaderboards page, old addresses still work), and every game page
// speaks English when Nook is in English: no Vietnamese letters left on screen (dish names allowed).
import { expect, test } from "@playwright/test";

const VIETNAMESE = /[ăâđêôơưĂÂĐÊÔƠƯàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/;
// Food from the Night Market stays as it is (like "sushi" in English)
const ALLOWED = ["Bánh mì", "bánh mì", "Bánh xèo", "bánh xèo", "Cà phê sữa đá", "cà phê", "Chè", "chè"];

const PAGES = [
  "/games",
  "/games/adventures",
  "/games/leaderboards",
  "/games/van-lo",
  "/arcade",
  "/arcade-online",
  "/arena",
  "/arena/chess",
  "/arena/alley",
  "/arena/village",
  "/arena/brawl",
  "/arena/sprout",
];

for (const path of PAGES) {
  test(`${path} has no Vietnamese words in English`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(800); // client parts (saves, leaderboards) fill in
    let text = await page.locator("main").innerText();
    for (const ok of ALLOWED) text = text.split(ok).join("");
    const bad = text.split("\n").filter((line) => VIETNAMESE.test(line));
    expect(bad, `Vietnamese on ${path}`).toEqual([]);
  });
}

test("one Games entry in the menu; its tabs reach every game", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/games");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const old of ["Mini Arcade", "Arcade Online", "Nook Arena", "Nook Games"]) await expect(nav.getByText(old, { exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "page");
  const tabs = page.getByRole("navigation", { name: "Games sections" });
  await tabs.getByRole("link", { name: "Together" }).click();
  await expect(page).toHaveURL(/\/arena$/);
  await expect(nav.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "page"); // still the Games app
  await page.getByRole("link", { name: /Firecracker Alley/ }).first().click();
  await expect(page.getByRole("heading", { name: "Firecracker Alley" })).toBeVisible();
});

test("old leaderboard addresses open the one Leaderboards page", async ({ page }) => {
  await page.goto("/arcade-online/leaderboard");
  await expect(page).toHaveURL(/\/games\/leaderboards#quiz$/);
  await expect(page.getByRole("tab", { name: "Quiz Party" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Chess" }).click();
  await expect(page).toHaveURL(/#chess$/);
});

test("Listen Together lives in Music now", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/arena/listen");
  await expect(page.getByRole("navigation", { name: "Music sections" }).getByRole("link", { name: "Listen Together" })).toHaveAttribute("aria-current", "page");
});
