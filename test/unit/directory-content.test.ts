import { describe, it, expect } from "vitest";
import { cityFaq, citySubtitle } from "@/lib/directory/city-content";
import { courtSpecs, courtAmenities, courtFaq } from "@/lib/directory/court-content";
import type { CourtItem } from "@/lib/db/types";

function court(over: Partial<CourtItem>): CourtItem {
  return {
    pk: "COURT#x", sk: "META", entity: "COURT", courtId: "x", name: "Court X", slug: "court-x",
    cityKey: "us#kansas#lawrence", lat: 0, lng: 0, geohash: "000000000",
    indoorCourts: 0, outdoorCourts: 4, totalCourts: 4, hasPickleball: true,
    ...over,
  };
}

describe("city content (§6.1 / §3.4)", () => {
  it("citySubtitle pluralizes locations and courts", () => {
    expect(citySubtitle("Lawrence", 5, 23)).toContain("5 places");
    expect(citySubtitle("Solo", 1, 1)).toContain("1 place");
    expect(citySubtitle("Solo", 1, 1)).toContain("1 court");
  });

  it("cityFaq answers reflect the real court set", () => {
    const courts = [
      court({ courtId: "a", access: "free", indoorCourts: 2, lighted: true }),
      court({ courtId: "b", access: "membership", dedicated: true, lines: "permanent", nets: "permanent" }),
    ];
    const faq = cityFaq("Lawrence", courts);
    const joined = faq.map((f) => f.answer).join(" ");
    expect(joined).toContain("2 place"); // 2 locations total
    expect(joined).toContain("1 of 2 location"); // 1 free
    expect(faq.some((f) => /indoor/i.test(f.question))).toBe(true);
    expect(faq.some((f) => /lights?/i.test(f.question))).toBe(true); // lighted present
    expect(faq.some((f) => /dedicated/i.test(f.question))).toBe(true); // dedicated present
  });

  it("cityFaq omits lighted/dedicated questions when none apply", () => {
    const faq = cityFaq("Nowhere", [court({ access: "free" })]);
    expect(faq.some((f) => /lights?/i.test(f.question))).toBe(false);
    expect(faq.some((f) => /dedicated/i.test(f.question))).toBe(false);
  });
});

describe("court content (§6.1 / §3.4)", () => {
  it("courtSpecs lists court counts, surface, nets/lines, facility as key→value", () => {
    const s = courtSpecs(court({ surface: ["concrete"], lines: "permanent", nets: "portable", indoorCourts: 3, outdoorCourts: 2, facilityType: "public" }));
    expect(s).toContainEqual({ label: "Courts", value: "3 indoor · 2 outdoor" });
    expect(s).toContainEqual({ label: "Surface", value: "Concrete" });
    expect(s).toContainEqual({ label: "Lines", value: "Permanent" });
    expect(s).toContainEqual({ label: "Nets", value: "Portable" });
    expect(s).toContainEqual({ label: "Facility", value: "Public" });
  });

  it("courtAmenities maps known amenity keys and folds in the lighted flag", () => {
    const a = courtAmenities(court({ amenities: ["restrooms", "water"], lighted: true }));
    expect(a).toContainEqual({ key: "lighted", label: "LED lighting" });
    expect(a).toContainEqual({ key: "restrooms", label: "Restrooms" });
    expect(a).toContainEqual({ key: "water", label: "Water fountain" });
    // no duplicate when the amenities list already carries lighted
    const b = courtAmenities(court({ amenities: ["lighted"], lighted: true }));
    expect(b.filter((x) => x.key === "lighted")).toHaveLength(1);
  });

  it("courtFaq cost answer matches access type", () => {
    expect(courtFaq(court({ access: "free" }))[0].answer).toMatch(/free/i);
    expect(courtFaq(court({ access: "membership" }))[0].answer).toMatch(/membership/i);
    const lit = courtFaq(court({ lighted: true }));
    expect(lit.some((f) => /lighted/i.test(f.question))).toBe(true);
  });
});
