import { describe, expect, it } from "vitest";
import { ago } from "@/features/realtime/LiveNow";

describe("ago", () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  it("says how long ago, in plain words", () => {
    expect(ago("2026-11-11T11:59:50Z", now)).toBe("just now");
    expect(ago("2026-11-11T11:57:00Z", now)).toBe("3 min ago");
    expect(ago("2026-11-11T09:00:00Z", now)).toBe("3 h ago");
    expect(ago("2026-11-09T12:00:00Z", now)).toBe("2 d ago");
  });
});
