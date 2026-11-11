import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "@/lib/api/clientId";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("randomUUID", () => {
  it("still works on http://192.168.x.x pages, where crypto.randomUUID is missing", () => {
    const real = globalThis.crypto;
    // Simulate a non-secure page: getRandomValues exists, randomUUID doesn't
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 50 }, () => randomUUID()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
