import { describe, it, expect, vi } from "vitest";

/**
 * L22 — `getSearchIndex` dedupes concurrent builds, but the in-flight slot was NOT keyed by
 * country: a `getSearchIndex("ca")` racing a `getSearchIndex("us")` build received the US
 * promise and thus the US index. Keying the in-flight (and cache) maps by country fixes it.
 *
 * The mocked `query` returns country-specific chunk data derived from the `SEARCHIDX#<country>`
 * partition key, so each country resolves to a distinguishable index.
 */
vi.mock("@/lib/db/client", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: vi.fn(async (opts: any) => {
    const country = String(opts.pk).replace("SEARCHIDX#", "");
    const prefix = String(opts.skBeginsWith ?? "");
    if (prefix.startsWith("COURTS")) {
      return { items: [{ data: JSON.stringify([{ id: `court-${country}`, name: country }]) }], lastKey: undefined };
    }
    if (prefix.startsWith("CITIES")) {
      return { items: [{ data: JSON.stringify([{ key: `${country}#c`, name: country, loc: 1 }]) }], lastKey: undefined };
    }
    return { items: [], lastKey: undefined };
  }),
  batchWrite: vi.fn(),
  deleteItem: vi.fn(),
}));

const { getSearchIndex } = await import("@/lib/search/index-store");

describe("getSearchIndex in-flight dedupe is per-country (L22)", () => {
  it("concurrent us + ca builds each resolve to their OWN country's index", async () => {
    // Both calls start before either build resolves → they share the in-flight window.
    const [us, ca] = await Promise.all([getSearchIndex("us"), getSearchIndex("ca")]);
    expect(us.courts[0].id).toBe("court-us");
    // Pre-fix: the ca caller received the in-flight US build → "court-us".
    expect(ca.courts[0].id).toBe("court-ca");
  });

  it("same-country concurrent calls still dedupe to one build", async () => {
    const [a, b] = await Promise.all([getSearchIndex("gb"), getSearchIndex("gb")]);
    expect(a).toBe(b); // one shared promise/result for the same country
    expect(a.courts[0].id).toBe("court-gb");
  });
});
