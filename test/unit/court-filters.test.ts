import { describe, it, expect } from "vitest";
import {
  activeFilterCount,
  courtMatchesFilters,
  EMPTY_FILTERS,
  filterCourts,
  type CourtFilters,
  type FilterableCourt,
} from "@/lib/search/court-filters";

/** A fully-featured court; individual tests override the fields they exercise. */
function court(over: Partial<FilterableCourt> = {}): FilterableCourt {
  return {
    totalCourts: 4,
    indoorCourts: 0,
    outdoorCourts: 4,
    lighted: false,
    dedicated: false,
    hasReservations: false,
    access: "free",
    facilityType: "public",
    amenities: [],
    surface: ["asphalt"],
    ...over,
  };
}

const f = (over: Partial<CourtFilters> = {}): CourtFilters => ({ ...EMPTY_FILTERS, ...over });

describe("court-filters", () => {
  it("empty filters match everything", () => {
    expect(courtMatchesFilters(court(), EMPTY_FILTERS)).toBe(true);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it("Number is a minimum-total-courts floor", () => {
    expect(courtMatchesFilters(court({ totalCourts: 4 }), f({ minCourts: 4 }))).toBe(true);
    expect(courtMatchesFilters(court({ totalCourts: 3 }), f({ minCourts: 4 }))).toBe(false);
    expect(courtMatchesFilters(court({ totalCourts: 1 }), f({ minCourts: 0 }))).toBe(true);
  });

  it("Type: indoor/outdoor/lighted/dedicated/reservable predicates", () => {
    expect(courtMatchesFilters(court({ indoorCourts: 2 }), f({ types: ["indoor"] }))).toBe(true);
    expect(courtMatchesFilters(court({ indoorCourts: 0 }), f({ types: ["indoor"] }))).toBe(false);
    expect(courtMatchesFilters(court({ lighted: true }), f({ types: ["lighted"] }))).toBe(true);
    expect(courtMatchesFilters(court({ dedicated: true }), f({ types: ["dedicated"] }))).toBe(true);
    expect(courtMatchesFilters(court({ hasReservations: true }), f({ types: ["reservable"] }))).toBe(true);
    expect(courtMatchesFilters(court({ hasReservations: false }), f({ types: ["reservable"] }))).toBe(false);
  });

  it("within a facet is OR (any selected type matches)", () => {
    const c = court({ indoorCourts: 0, outdoorCourts: 4, lighted: true });
    expect(courtMatchesFilters(c, f({ types: ["indoor", "lighted"] }))).toBe(true); // lighted wins
  });

  it("across facets is AND (must satisfy every active facet)", () => {
    const c = court({ indoorCourts: 2, lighted: false });
    expect(courtMatchesFilters(c, f({ types: ["indoor"], surfaces: ["clay"] }))).toBe(false);
    expect(
      courtMatchesFilters(court({ indoorCourts: 2, surface: ["clay"] }), f({ types: ["indoor"], surfaces: ["clay"] })),
    ).toBe(true);
  });

  it("Access maps public/private via facilityType (not the cost field)", () => {
    expect(courtMatchesFilters(court({ facilityType: "public" }), f({ access: ["public"] }))).toBe(true);
    expect(courtMatchesFilters(court({ facilityType: "school" }), f({ access: ["public"] }))).toBe(true);
    expect(courtMatchesFilters(court({ facilityType: "private" }), f({ access: ["public"] }))).toBe(false);
    expect(courtMatchesFilters(court({ facilityType: "club" }), f({ access: ["private"] }))).toBe(true);
    // A free-to-play *private* facility must not be considered public (cost ≠ type).
    expect(
      courtMatchesFilters(court({ facilityType: "private", access: "free" }), f({ access: ["public"] })),
    ).toBe(false);
    // Null facility type matches neither public nor private.
    expect(courtMatchesFilters(court({ facilityType: null }), f({ access: ["public"] }))).toBe(false);
  });

  it("Amenities match by normalized seed tokens (spaces or hyphens)", () => {
    expect(
      courtMatchesFilters(court({ amenities: ["Wheelchair Accessible"] }), f({ amenities: ["wheelchair"] })),
    ).toBe(true);
    expect(courtMatchesFilters(court({ amenities: ["locker rooms"] }), f({ amenities: ["locker-rooms"] }))).toBe(true);
    expect(courtMatchesFilters(court({ amenities: ["pro shop"] }), f({ amenities: ["pro-shop"] }))).toBe(true);
    expect(courtMatchesFilters(court({ amenities: [] }), f({ amenities: ["restrooms"] }))).toBe(false);
  });

  it("Amenity 'lighted' also honors the derived lighted boolean", () => {
    expect(courtMatchesFilters(court({ lighted: true, amenities: [] }), f({ amenities: ["lighted"] }))).toBe(true);
  });

  it("Surface matches case-insensitively", () => {
    expect(courtMatchesFilters(court({ surface: ["Hard"] }), f({ surfaces: ["hard"] }))).toBe(true);
    expect(courtMatchesFilters(court({ surface: ["wood"] }), f({ surfaces: ["clay"] }))).toBe(false);
  });

  it("activeFilterCount sums active facets", () => {
    expect(activeFilterCount(f({ minCourts: 4, types: ["indoor", "lighted"], surfaces: ["clay"] }))).toBe(4);
  });

  it("filterCourts returns only matching courts", () => {
    const courts = [
      court({ totalCourts: 2, surface: ["clay"] }),
      court({ totalCourts: 8, surface: ["wood"] }),
      court({ totalCourts: 10, surface: ["clay"] }),
    ];
    const out = filterCourts(courts, f({ minCourts: 6, surfaces: ["clay"] }));
    expect(out).toHaveLength(1);
    expect(out[0].totalCourts).toBe(10);
  });
});
