import { expect, type Page } from "@playwright/test";

// Each test is a new person: a fresh browser with no cookies. "Not now" on the name prompt, unless we want a name.
export async function visit(page: Page, path: string) {
  await page.addInitScript(() => sessionStorage.setItem("nook.namePrompt.later", "1"));
  await page.goto(path, { waitUntil: "load" });
}

// Pick a name through the API (sets the nook_session cookie for this browser)
export async function pickName(page: Page, prefix = "E2E") {
  const name = `${prefix} ${Math.random().toString(36).slice(2, 8)}`;
  const res = await page.request.post("/api/me", { data: { name, pin: "2468" } });
  expect(res.ok()).toBe(true);
  return name;
}
