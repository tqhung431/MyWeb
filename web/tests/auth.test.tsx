import { describe, expect, it } from "vitest";
import { initials } from "@/components/ui/Avatar";
import { safeNext } from "@/features/auth/AuthPage";

describe("initials", () => {
  it("uses first and last name, or the first two letters", () => {
    expect(initials("Quoc Hung Tran")).toBe("QT");
    expect(initials("alice")).toBe("AL");
    expect(initials("  ")).toBe("?");
  });
});

describe("safeNext", () => {
  it("only allows pages on our own site", () => {
    expect(safeNext("/chill")).toBe("/chill");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
