// Guards for the app registry: a new app can't be half-added by mistake.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPS, isActive } from "@/lib/apps";

describe("app registry", () => {
  it("has unique ids and links", () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
    expect(new Set(APPS.map((a) => a.href)).size).toBe(APPS.length);
  });

  it.each(APPS.filter((a) => a.status === "live"))("live app $name has a page for every link", (app) => {
    for (const href of [app.href, ...(app.links ?? []).map((l) => l.href)]) {
      expect(existsSync(`app${href}/page.tsx`), `missing app${href}/page.tsx`).toBe(true);
    }
  });
});

describe("isActive", () => {
  it("matches the app and its sub-pages, but Home only exactly", () => {
    expect(isActive("/chill/tips/x", "/chill")).toBe(true);
    expect(isActive("/chillout", "/chill")).toBe(false);
    expect(isActive("/chill", "/")).toBe(false);
    expect(isActive("/", "/")).toBe(true);
  });
});
