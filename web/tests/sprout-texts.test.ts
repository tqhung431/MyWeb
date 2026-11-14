// Stage 26 · Mầm Thú: the island's words (shared with the API's tests, so they can't use tx()) all have Vietnamese.
import { describe, expect, it } from "vitest";
import { AREAS } from "@/features/arena/sprout/island";
import vi from "@/lib/i18n/vi.json";

describe("Mầm Thú island texts", () => {
  it("has Vietnamese for every area name, keeper line and villager line", () => {
    const texts = AREAS.flatMap((a) => [a.en, a.keeper.title, a.keeper.before, a.keeper.after, ...a.villagers.flatMap((v) => v.lines)]);
    expect(texts.filter((x) => !(x in vi))).toEqual([]);
  });
});
