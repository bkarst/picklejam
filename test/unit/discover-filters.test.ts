import { describe, it, expect } from "vitest";
import {
  activityApplies,
  activeDiscoverFilterCount,
  EMPTY_DISCOVER_FILTERS,
  filterDiscoverItems,
  itemMatchesFilters,
  matchesNameQuery,
  sizeNoun,
  type DiscoverEntityType,
  type DiscoverItem,
} from "@/lib/search/discover-filters";

function item(over: Partial<DiscoverItem> = {}): DiscoverItem {
  return {
    type: "groups",
    id: "g1",
    name: "Test",
    url: "/groups/g1",
    cityKey: "us#kansas#lawrence",
    cityLabel: "Lawrence, KS",
    size: 10,
    avgDupr: 3.8,
    gamesLastMonth: 4,
    ...over,
  };
}

describe("itemMatchesFilters", () => {
  it("passes when no filters are set", () => {
    expect(itemMatchesFilters(item(), EMPTY_DISCOVER_FILTERS)).toBe(true);
  });

  it("filters by minimum size", () => {
    expect(itemMatchesFilters(item({ size: 8 }), { ...EMPTY_DISCOVER_FILTERS, minSize: 16 })).toBe(false);
    expect(itemMatchesFilters(item({ size: 20 }), { ...EMPTY_DISCOVER_FILTERS, minSize: 16 })).toBe(true);
  });

  it("filters by minimum average DUPR", () => {
    expect(itemMatchesFilters(item({ avgDupr: 3.2 }), { ...EMPTY_DISCOVER_FILTERS, minAvgDupr: 3.5 })).toBe(false);
    expect(itemMatchesFilters(item({ avgDupr: 4.1 }), { ...EMPTY_DISCOVER_FILTERS, minAvgDupr: 3.5 })).toBe(true);
  });

  it("excludes items with no rated players when a DUPR floor is set", () => {
    expect(
      itemMatchesFilters(item({ avgDupr: undefined }), { ...EMPTY_DISCOVER_FILTERS, minAvgDupr: 3.0 }),
    ).toBe(false);
    // ...but keeps them when no DUPR floor is set.
    expect(itemMatchesFilters(item({ avgDupr: undefined }), EMPTY_DISCOVER_FILTERS)).toBe(true);
  });

  it("filters by activity for types that have it", () => {
    expect(
      itemMatchesFilters(item({ gamesLastMonth: 2 }), { ...EMPTY_DISCOVER_FILTERS, minGamesLastMonth: 4 }),
    ).toBe(false);
    expect(
      itemMatchesFilters(item({ gamesLastMonth: 8 }), { ...EMPTY_DISCOVER_FILTERS, minGamesLastMonth: 4 }),
    ).toBe(true);
  });

  it("ignores the activity filter for tournaments (one-off events)", () => {
    const tourney = item({ type: "tournaments", gamesLastMonth: undefined });
    expect(itemMatchesFilters(tourney, { ...EMPTY_DISCOVER_FILTERS, minGamesLastMonth: 8 })).toBe(true);
  });
});

describe("filterDiscoverItems", () => {
  it("keeps only matching items", () => {
    const items = [item({ id: "a", size: 4 }), item({ id: "b", size: 30 }), item({ id: "c", size: 12 })];
    const out = filterDiscoverItems(items, { ...EMPTY_DISCOVER_FILTERS, minSize: 10 });
    expect(out.map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("matchesNameQuery", () => {
  it("matches everything on an empty/whitespace query", () => {
    expect(matchesNameQuery(item({ name: "Lawrence Dinkers Club" }), "")).toBe(true);
    expect(matchesNameQuery(item({ name: "Lawrence Dinkers Club" }), "   ")).toBe(true);
  });

  it("is a case-insensitive substring match on the name", () => {
    const it0 = item({ name: "Lawrence Dinkers Club" });
    expect(matchesNameQuery(it0, "dinkers")).toBe(true);
    expect(matchesNameQuery(it0, "LAWRENCE")).toBe(true);
    expect(matchesNameQuery(it0, "  club ")).toBe(true);
    expect(matchesNameQuery(it0, "aces")).toBe(false);
  });
});

describe("activeDiscoverFilterCount", () => {
  it("counts non-default facets, skipping activity where it doesn't apply", () => {
    const f = { minSize: 8, minAvgDupr: 3.5, minGamesLastMonth: 4 };
    expect(activeDiscoverFilterCount(f, "groups")).toBe(3);
    expect(activeDiscoverFilterCount(f, "tournaments")).toBe(2); // activity not counted
    expect(activeDiscoverFilterCount(EMPTY_DISCOVER_FILTERS, "groups")).toBe(0);
  });
});

describe("helpers", () => {
  it("activityApplies is false only for tournaments", () => {
    const types: DiscoverEntityType[] = ["groups", "leagues", "ladders", "tournaments"];
    expect(types.map(activityApplies)).toEqual([true, true, true, false]);
  });

  it("sizeNoun reads naturally", () => {
    expect(sizeNoun("groups", 1)).toBe("member");
    expect(sizeNoun("groups", 5)).toBe("members");
    expect(sizeNoun("ladders", 3)).toBe("players");
  });
});
