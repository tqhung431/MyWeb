// Stage 11: names can be in any language and include emoji.
import { describe, expect, it } from "vitest";
import { initials } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/time";

describe("initials", () => {
  it("takes whole characters, never half an emoji", () => {
    expect(initials("Linh Tran")).toBe("LT");
    expect(initials("Mai 🌸")).toBe("M🌸");
    expect(initials("👵🏽")).toBe("👵🏽");
    expect(initials("Bà Ngoại")).toBe("BN");
    expect(initials("dad")).toBe("DA");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  it("says how long ago in plain words", () => {
    expect(timeAgo("2026-11-11T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-11-11T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-11T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-10T09:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-11-08T12:00:00Z", now)).toBe("3 days ago");
  });
});
