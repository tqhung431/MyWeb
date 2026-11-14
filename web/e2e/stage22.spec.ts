// Stage 22: two people play a live chess game through the game server (Caddy → arena), and Nook (the computer)
// answers a move in the browser.
import { expect, test, type Page } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 7);
const move = async (page: Page, from: string, to: string) => {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
};

test("two people play a live chess game to checkmate", async ({ browser, baseURL }) => {
  const [white, black] = await Promise.all(
    ["Wen", "Bao"].map(async (n) => {
      const ctx = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
      await ctx.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
      await ctx.request.post("/api/me", { data: { name: `${n} ${unique()}`, pin: "2468" } });
      return { ctx, page: await ctx.newPage() };
    }),
  );
  await white.page.goto("/arena/chess");
  await white.page.getByRole("combobox", { name: "Your colour" }).click();
  await white.page.getByRole("option", { name: "White" }).click();
  await white.page.getByRole("button", { name: "Start a live game" }).click();
  await white.page.waitForURL(/\/arena\/chess\/[A-Z]{4}$/);
  await black.page.goto(new URL(white.page.url()).pathname);
  await expect(white.page.getByRole("button", { name: "Resign" })).toBeVisible();

  // Fool's mate, from the other side: 1. f3 e5 2. g4 Qh4#
  await move(white.page, "f2", "f3");
  await expect(black.page.locator('[data-square="f3"]')).toHaveAttribute("aria-label", /white pawn/);
  await move(black.page, "e7", "e5");
  await expect(white.page.locator('[data-square="e5"]')).toHaveAttribute("aria-label", /black pawn/);
  await move(white.page, "g2", "g4");
  await expect(black.page.locator('[data-square="g4"]')).toHaveAttribute("aria-label", /white pawn/);
  await move(black.page, "d8", "h4");
  await expect(white.page.getByText(/wins · checkmate/)).toBeVisible();
  await expect(black.page.getByText(/wins · checkmate/)).toBeVisible();
  await Promise.all([white.ctx.close(), black.ctx.close()]);
});

test("Nook answers your move", async ({ page }) => {
  await page.goto("/arena/chess/nook?level=1&color=w");
  await move(page, "e2", "e4");
  await expect(page.locator("ol button")).toHaveCount(2, { timeout: 15_000 }); // 1. e4 and Nook's reply
  await expect(page.getByText("White to move")).toBeVisible();
});
