// Vân Lộ: make a cultivator, enter a secret realm, walk.
import { expect, test } from "@playwright/test";
import { visit } from "./helpers";

// Stage 21: a new game starts in Nook's language, which a Vietnamese browser picks (these tests click Vietnamese words)
test.use({ locale: "vi-VN" });

test("start Vân Lộ and walk in a secret realm", async ({ page }) => {
  await visit(page, "/games/van-lo");
  await page.getByRole("radio", { name: /Kiếm tu/ }).click();
  await page.getByRole("textbox", { name: "Đạo hiệu" }).fill("Thử Nghiệm");
  await page.getByRole("button", { name: "Trắc linh căn" }).click(); // test the spiritual root
  await page.getByRole("button", { name: "Vào động phủ" }).click(); // into your cave home
  await page.getByRole("button", { name: "Bí cảnh", exact: true }).click();
  await page.getByRole("button", { name: "Vào bí cảnh" }).first().click();
  const map = page.getByRole("img", { name: /Game map/ });
  await expect(map).toBeVisible();
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Space"]) await page.keyboard.press(key);
  await expect(page.getByRole("meter", { name: "Sinh lực" })).toBeVisible();
});

// Fix after Stage 19: letting go of a held arrow key must stop the walking (it used to go on until a wall).
test("holding an arrow walks; letting go stops", async ({ page }) => {
  await visit(page, "/games/van-lo");
  await page.getByRole("textbox", { name: "Đạo hiệu" }).fill("Thử Giữ Phím");
  await page.getByRole("button", { name: "Trắc linh căn" }).click();
  await page.getByRole("button", { name: "Vào động phủ" }).click();
  await page.getByRole("button", { name: "Bí cảnh", exact: true }).click();
  await page.getByRole("button", { name: "Vào bí cảnh" }).first().click();
  await expect(page.getByRole("img", { name: /Game map/ })).toBeVisible();
  const pos = () => page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("nook.vanlo.save") ?? "{}").run?.pos ?? null));
  // The direction with the longest open corridor (from the map in the save), so a wall can't hide the bug
  const KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as const;
  const key = await page.evaluate((dirs) => {
    const r = JSON.parse(localStorage.getItem("nook.vanlo.save") ?? "{}").run;
    const open = (x: number, y: number) =>
      r.floor.tiles[y * r.floor.w + x] === "." && !r.floor.enemies.some((e: { pos: { x: number; y: number } }) => e.pos.x === x && e.pos.y === y);
    let best = "ArrowRight";
    let bestRun = -1;
    for (const [k, [dx, dy]] of Object.entries(dirs)) {
      let n = 0;
      while (open(r.pos.x + dx * (n + 1), r.pos.y + dy * (n + 1))) n++;
      if (n > bestRun) [best, bestRun] = [k, n];
    }
    return best;
  }, KEYS);
  await page.keyboard.down(key);
  await page.waitForTimeout(160); // one or two steps
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
  const released = await pos();
  await page.waitForTimeout(500); // with the bug it walks ~3 more tiles in this time
  expect(await pos(), `kept walking (${key}) after the key was released`).toBe(released);
});
