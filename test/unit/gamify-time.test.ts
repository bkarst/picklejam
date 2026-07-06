/**
 * gamify-time.test.ts — user-local calendars & ISO-week arithmetic (§G13.0).
 * ISO-year edges, round-trips, tz mapping, DST, and the "tz change shifts ≤ 1 week"
 * property that underwrites the streak/quest re-bucketing guarantee.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  resolveUserTz,
  userLocalDay,
  userLocalMonth,
  isoWeekOf,
  weekId,
  parseWeek,
  mondayOfWeek,
  addWeeks,
  prevWeek,
  nextWeek,
  weeksBetween,
  compareWeeks,
  weeksStrictlyBetween,
} from "@/lib/gamify/time";

const UTC = "UTC";
const NY = "America/New_York";

describe("resolveUserTz — profile → home-city → UTC", () => {
  it("prefers the profile tz, then the city tz, then UTC", () => {
    expect(resolveUserTz("America/Chicago", "America/Denver")).toBe("America/Chicago");
    expect(resolveUserTz(null, "America/Denver")).toBe("America/Denver");
    expect(resolveUserTz(undefined, undefined)).toBe("UTC");
    expect(resolveUserTz("", "")).toBe("UTC");
  });
});

describe("ISO week — known values incl. year boundaries", () => {
  it("2026-01-01 (Thu) is 2026-W01; the prior Monday belongs to it too", () => {
    expect(isoWeekOf(UTC, Date.parse("2026-01-01T12:00:00Z"))).toBe("2026-W01");
    expect(isoWeekOf(UTC, Date.parse("2025-12-29T12:00:00Z"))).toBe("2026-W01"); // Monday
    expect(isoWeekOf(UTC, Date.parse("2026-01-04T12:00:00Z"))).toBe("2026-W01"); // Sunday
    expect(isoWeekOf(UTC, Date.parse("2026-01-05T12:00:00Z"))).toBe("2026-W02"); // Monday
  });

  it("2026 is a 53-week year; 2027-01-01 (Fri) belongs to 2026-W53", () => {
    expect(isoWeekOf(UTC, Date.parse("2026-12-31T12:00:00Z"))).toBe("2026-W53");
    expect(isoWeekOf(UTC, Date.parse("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(isoWeekOf(UTC, Date.parse("2027-01-04T12:00:00Z"))).toBe("2027-W01"); // Monday
  });
});

describe("week arithmetic", () => {
  it("weekId / parseWeek round-trip", () => {
    expect(weekId(2026, 7)).toBe("2026-W07");
    expect(parseWeek("2026-W07")).toEqual({ isoYear: 2026, week: 7 });
  });

  it("mondayOfWeek → reformat round-trips across a year edge", () => {
    for (const id of ["2026-W01", "2026-W53", "2027-W01", "2025-W52"]) {
      // Monday at 12:00Z maps back to the same ISO week.
      expect(isoWeekOf(UTC, mondayOfWeek(id) + 12 * 3_600_000)).toBe(id);
    }
  });

  it("prev/next/add/between are consistent 7-day math across year edges", () => {
    expect(nextWeek("2026-W53")).toBe("2027-W01");
    expect(prevWeek("2027-W01")).toBe("2026-W53");
    expect(addWeeks("2026-W53", 2)).toBe("2027-W02");
    expect(weeksBetween("2026-W53", "2027-W02")).toBe(2);
    expect(compareWeeks("2026-W53", "2027-W01")).toBe(-1);
    expect(weeksStrictlyBetween("2026-W51", "2027-W01")).toEqual(["2026-W52", "2026-W53"]);
    expect(weeksStrictlyBetween("2026-W10", "2026-W11")).toEqual([]); // adjacent
    expect(weeksStrictlyBetween("2026-W11", "2026-W10")).toEqual([]); // reversed
  });

  it("addWeeks is invertible and weeksBetween is its inverse (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -260, max: 260 }), (n) => {
        const w = addWeeks("2026-W01", n);
        expect(addWeeks(w, -n)).toBe("2026-W01");
        expect(weeksBetween("2026-W01", w)).toBe(n);
      }),
    );
  });
});

describe("tz → calendar mapping", () => {
  it("the same instant can fall on different days/weeks per zone", () => {
    const t = Date.parse("2026-01-01T02:00:00Z"); // 21:00 Dec 31 in NY
    expect(userLocalDay(UTC, t)).toBe("20260101");
    expect(userLocalDay(NY, t)).toBe("20251231");
    expect(userLocalMonth(UTC, t)).toBe("202601");
    expect(userLocalMonth(NY, t)).toBe("202512");
  });

  it("DST spring-forward: consecutive local noons still advance exactly one day", () => {
    // US DST begins 2026-03-08. Sample local noon each day across the change.
    let prev = "";
    for (let d = 6; d <= 10; d++) {
      const day = userLocalDay(NY, Date.parse(`2026-03-${String(d).padStart(2, "0")}T17:00:00Z`));
      if (prev) expect(Number(day)).toBe(Number(prev) + 1);
      prev = day;
    }
  });
});

describe("tz change shifts the current week by at most 1 (re-bucketing guarantee)", () => {
  const zones = ["Pacific/Kiritimati", "Pacific/Honolulu", UTC, NY, "Asia/Tokyo", "Pacific/Apia"];
  it("|Δweeks| ≤ 1 for any instant across any two zones", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.parse("2026-01-01T00:00:00Z"), max: Date.parse("2027-12-31T23:59:59Z") }),
        fc.constantFrom(...zones),
        fc.constantFrom(...zones),
        (t, za, zb) => {
          const diff = Math.abs(weeksBetween(isoWeekOf(za, t), isoWeekOf(zb, t)));
          expect(diff).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});
