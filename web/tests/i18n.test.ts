// Stage 21: every text the website shows must have a Vietnamese version in lib/i18n/vi.json.
// It finds t("…"), tx("…"), tNow("…") and getT())("…") in the code, the same way a person would search.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeT, pickLang, translate } from "@/lib/i18n/core";
import vi from "@/lib/i18n/vi.json";

const root = path.join(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".next", "e2e", "tests", "public", "van-lo"]); // Vân Lộ has its own vi/en texts (Stage 16)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (SKIP.has(name)) return [];
    if (statSync(full).isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

export function textsInCode(): Map<string, string> {
  const found = new Map<string, string>(); // text → first file
  const pattern = /(?:\bt|\btx|\btNow|getT\(\)\))\(\s*"((?:[^"\\]|\\.)*)"/g;
  for (const file of ["app", "features", "components", "lib"].flatMap((d) => files(path.join(root, d)))) {
    for (const m of readFileSync(file, "utf8").matchAll(pattern)) {
      const text = JSON.parse(`"${m[1]}"`) as string;
      if (!found.has(text)) found.set(text, path.relative(root, file));
    }
  }
  return found;
}

describe("translations", () => {
  it("has Vietnamese for every text in the code", () => {
    const texts = textsInCode();
    expect(texts.size).toBeGreaterThan(500);
    const missing = [...texts].filter(([text]) => !(text in vi)).map(([text, file]) => `${file}: ${text}`);
    expect(missing).toEqual([]);
  });

  it("keeps every {name} in the Vietnamese text", () => {
    const wrong = Object.entries(vi as Record<string, string>).filter(([en, v]) => {
      const keys = (s: string) =>
        [...s.matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort()
          .join(",");
      return keys(en) !== keys(v) || !v.trim();
    });
    expect(wrong).toEqual([]);
  });

  it("fills in values and falls back to English", () => {
    const t = makeT(vi);
    expect(t("Message {name}", { name: "Mai" })).toBe(translate(vi, "Message {name}", { name: "Mai" }));
    expect(makeT({})("Message {name}", { name: "Mai" })).toBe("Message Mai");
    expect(t("A text nobody wrote")).toBe("A text nobody wrote");
  });

  it("picks the cookie first, then the browser's languages", () => {
    expect(pickLang("vi", "en-US")).toBe("vi");
    expect(pickLang(undefined, "vi-VN,vi;q=0.9,en;q=0.8")).toBe("vi");
    expect(pickLang(undefined, "fr-FR,en;q=0.5")).toBe("en");
    expect(pickLang("xx", undefined)).toBe("en");
  });
});
