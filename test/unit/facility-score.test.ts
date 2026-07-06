/**
 * facility-score.test.ts — courtFacilityScore(): a 0–100 setup-quality rating +
 * 1–5 tier derived purely from the "courts/play" fields (nets, lines, surface,
 * capacity, amenities, lighting, indoor). No reviews or check-ins feed it.
 *
 * The load-bearing rule is the DEDICATED GATE: a court without permanent nets AND
 * permanent lines (a shared / converted court) can never exceed tier 4, no matter
 * how premium its surface or amenities are.
 */
import { describe, it, expect } from "vitest";
import { courtFacilityScore } from "@/lib/ingest/map";

const KEY_AMENITIES = ["restrooms", "water", "locker rooms", "pro shop", "food"];

describe("courtFacilityScore", () => {
  it("scores a top dedicated facility at the ceiling (tier 5)", () => {
    const r = courtFacilityScore({
      nets: "permanent", lines: "permanent", surface: ["acrylic"],
      totalCourts: 10, indoorCourts: 4, amenities: KEY_AMENITIES, lighted: true,
      dedicated: true,
    });
    expect(r.score).toBe(100);
    expect(r.tier).toBe(5);
  });

  it("scores the worst improvised court in the bottom tier", () => {
    const r = courtFacilityScore({
      nets: "tennis", lines: "chalk", surface: ["clay"],
      totalCourts: 1, indoorCourts: 0, amenities: [], lighted: false,
      dedicated: false,
    });
    expect(r.score).toBeLessThan(45);
    expect(r.tier).toBe(1);
  });

  it("GATE: a non-dedicated court caps at tier 4 even with an otherwise 5★ setup", () => {
    // portable nets ⇒ not dedicated, but acrylic + indoor + lit + 10 courts + all
    // amenities push the raw score into the 5★ band. The gate must pull it back.
    const shared = {
      nets: "portable" as const, lines: "permanent" as const, surface: ["acrylic"],
      totalCourts: 10, indoorCourts: 4, amenities: KEY_AMENITIES, lighted: true,
    };
    const nonDedicated = courtFacilityScore({ ...shared, dedicated: false });
    expect(nonDedicated.score).toBeGreaterThanOrEqual(85); // raw score IS 5★-worthy…
    expect(nonDedicated.tier).toBe(4); // …but the gate caps it

    // Same physical setup but flagged dedicated ⇒ the gate lifts to tier 5.
    const dedicated = courtFacilityScore({ ...shared, dedicated: true });
    expect(dedicated.score).toBe(nonDedicated.score); // score is identical…
    expect(dedicated.tier).toBe(5); // …only the tier differs
  });

  it("treats missing fields as a neutral midpoint, not zero", () => {
    // An empty court shouldn't crash or sink to tier 1 on unknowns alone.
    const r = courtFacilityScore({});
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.score).toBeLessThan(58);
    expect(r.tier).toBe(2);
  });

  it("net quality is monotonic, all else equal", () => {
    const base = { lines: "permanent" as const, surface: ["hard"], totalCourts: 4, dedicated: false };
    const perm = courtFacilityScore({ ...base, nets: "permanent" }).score;
    const port = courtFacilityScore({ ...base, nets: "portable" }).score;
    const byo = courtFacilityScore({ ...base, nets: "byo" }).score;
    const tennis = courtFacilityScore({ ...base, nets: "tennis" }).score;
    expect(perm).toBeGreaterThan(port);
    expect(port).toBeGreaterThan(byo);
    expect(byo).toBeGreaterThan(tennis);
  });

  it("credits the best surface when several are listed", () => {
    const worst = courtFacilityScore({ surface: ["clay"] }).score;
    const mixed = courtFacilityScore({ surface: ["clay", "acrylic"] }).score;
    expect(mixed).toBeGreaterThan(worst);
  });

  it("rewards lighting, indoor play, and amenities", () => {
    const bare = courtFacilityScore({ nets: "permanent", lines: "permanent" });
    const loaded = courtFacilityScore({
      nets: "permanent", lines: "permanent",
      lighted: true, indoorCourts: 2, amenities: KEY_AMENITIES,
    });
    expect(loaded.score).toBeGreaterThan(bare.score);
  });
});
