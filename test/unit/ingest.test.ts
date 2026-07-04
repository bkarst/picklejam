import { describe, it, expect } from "vitest";
import {
  mapSeedCourtToItem,
  parseOpenPlay,
  deriveDedicated,
  computePopularityRank,
  type SeedCourt,
} from "@/lib/ingest/map";
import { titleize } from "@/lib/ingest/pipeline";

const seed: SeedCourt = {
  id: "abc-123",
  title: "Riverside Pickleball Courts",
  address: "1 River Rd, Lawrence, KS",
  lat: 38.97,
  lng: -95.29,
  phone: "7851234567",
  url: "https://x.example",
  access: "free",
  facility_type: "public",
  indoor_courts: 0,
  outdoor_courts: 4,
  total_courts: 4,
  has_pickleball: true,
  surface: ["concrete"],
  lines: "permanent",
  nets: "permanent",
  amenities: ["lighted", "restrooms", "water"],
  description: "A great riverside facility with four dedicated courts and lights.",
  schedule_details: "Mon-Fri 9:00 AM - 11:00 AM; Sat, Sun 1-3pm",
  country_slug: "us",
  state_slug: "kansas",
  city_slug: "lawrence",
  slug: "riverside-pickleball-courts",
  is_hidden: false,
  is_deleted: false,
  updated_at: "2025-04-21T10:15:08.854Z",
};

describe("seed mappers (§9.8)", () => {
  it("deriveDedicated: permanent nets AND lines only (N8)", () => {
    expect(deriveDedicated("permanent", "permanent")).toBe(true);
    expect(deriveDedicated("temporary", "permanent")).toBe(false);
    expect(deriveDedicated("permanent", "portable")).toBe(false);
    expect(deriveDedicated(null, null)).toBe(false);
  });

  it("computePopularityRank orders richer courts higher", () => {
    const big = computePopularityRank({ totalCourts: 8, hasPhotos: true, dedicated: true, indoorCourts: 2, amenitiesCount: 5 });
    const small = computePopularityRank({ totalCourts: 1, hasPhotos: false, dedicated: false, indoorCourts: 0, amenitiesCount: 0 });
    expect(big).toBeGreaterThan(small);
  });

  it("parseOpenPlay parses day ranges + lists + am/pm (N13)", () => {
    const blocks = parseOpenPlay("Mon-Fri 9:00 AM - 11:00 AM; Sat, Sun 1-3pm");
    // Mon–Fri (5) + Sat + Sun (2) = 7 blocks.
    expect(blocks).toHaveLength(7);
    const mon = blocks.find((b) => b.dayOfWeek === 1)!;
    expect(mon.start).toBe("09:00");
    expect(mon.end).toBe("11:00");
    const sun = blocks.find((b) => b.dayOfWeek === 0)!;
    expect(sun.start).toBe("13:00");
    expect(sun.end).toBe("15:00");
  });

  it("parseOpenPlay returns [] for unparseable / empty schedules", () => {
    expect(parseOpenPlay("")).toEqual([]);
    expect(parseOpenPlay("call for hours")).toEqual([]);
    expect(parseOpenPlay(undefined)).toEqual([]);
  });

  it("titleize turns slugs into display names", () => {
    expect(titleize("overland-park")).toBe("Overland Park");
    expect(titleize("st-louis")).toBe("St Louis");
  });

  it("mapSeedCourtToItem produces all keys + computed attrs", () => {
    const item = mapSeedCourtToItem(seed);
    expect(item.pk).toBe("COURT#abc-123");
    expect(item.gsi3pk).toBe("COURTSLUG#us#kansas#lawrence#riverside-pickleball-courts");
    expect(item.gsi2pk).toBe("CITY#us#kansas#lawrence");
    expect(item.gsi4pk).toBe(`GEO#${item.geohash.slice(0, 4)}`); // GEO_PARTITION_PRECISION = 4 (L23)
    expect(item.cityKey).toBe("us#kansas#lawrence");
    expect(item.dedicated).toBe(true);
    expect(item.lighted).toBe(true);
    expect(item.totalCourts).toBe(4);
    expect(item.openPlay?.length).toBe(7);
    expect(item.indexable).toBe(true); // description ≥40 chars + address + schedule
    expect(item.source).toBe("pickleheads.com");
  });

  it("a thin, no-content court is marked noindex (§14.4)", () => {
    const thin = mapSeedCourtToItem({
      ...seed,
      id: "thin-1",
      description: "",
      address: undefined,
      schedule_details: "",
      images: undefined,
      total_courts: 1,
      indoor_courts: 0,
      outdoor_courts: 1,
    });
    expect(thin.indexable).toBe(false);
  });
});
