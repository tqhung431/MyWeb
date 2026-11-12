// Vân Lộ: make a cultivator, enter a secret realm, walk.
import { expect, test } from "@playwright/test";
import { visit } from "./helpers";

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
