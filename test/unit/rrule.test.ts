import { describe, it, expect } from "vitest";
import {
  parseRrule,
  expandRrule,
  nextOccurrences,
  toIcs,
  bydayTokens,
} from "@/lib/outings/rrule";
import { promoteFromWaitlist } from "@/lib/data/outings";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import type { RsvpItem } from "@/lib/db/types";

// DTSTART used across cases: Wed 2026-07-01 18:00 UTC.
const DTSTART = "2026-07-01T18:00:00.000Z";

describe("parseRrule (supported subset)", () => {
  it("parses FREQ/INTERVAL/BYDAY/COUNT", () => {
    const r = parseRrule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=6");
    expect(r.freq).toBe("WEEKLY");
    expect(r.interval).toBe(2);
    expect(r.byday).toEqual([0, 2, 4]); // MO,WE,FR → Monday-based indices
    expect(r.count).toBe(6);
    expect(bydayTokens(r)).toEqual(["MO", "WE", "FR"]);
  });

  it("tolerates an RRULE: prefix and normalizes UNTIL to ISO", () => {
    const r = parseRrule("RRULE:FREQ=WEEKLY;UNTIL=20260731T235959Z");
    expect(r.interval).toBe(1);
    expect(r.until).toBe("2026-07-31T23:59:59.000Z");
  });

  it("rejects unsupported frequencies", () => {
    expect(() => parseRrule("FREQ=DAILY")).toThrow(/FREQ/);
    expect(() => parseRrule("FREQ=MONTHLY;INTERVAL=1")).toThrow(/WEEKLY/);
  });
});

describe("expandRrule (weekly + biweekly)", () => {
  it("weekly, no BYDAY → same weekday each week, preserving time-of-day", () => {
    const occ = expandRrule("FREQ=WEEKLY;COUNT=3", DTSTART);
    expect(occ).toEqual([
      "2026-07-01T18:00:00.000Z",
      "2026-07-08T18:00:00.000Z",
      "2026-07-15T18:00:00.000Z",
    ]);
  });

  it("biweekly (INTERVAL=2) skips a week between occurrences", () => {
    const occ = expandRrule("FREQ=WEEKLY;INTERVAL=2;COUNT=3", DTSTART);
    expect(occ).toEqual([
      "2026-07-01T18:00:00.000Z",
      "2026-07-15T18:00:00.000Z",
      "2026-07-29T18:00:00.000Z",
    ]);
  });

  it("BYDAY expands multiple weekdays per week in weekday order", () => {
    // DTSTART is Wed; MO,WE,FR → the MO before DTSTART is skipped (pre-start).
    const occ = expandRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4", DTSTART);
    expect(occ).toEqual([
      "2026-07-01T18:00:00.000Z", // Wed Jul 1
      "2026-07-03T18:00:00.000Z", // Fri Jul 3
      "2026-07-06T18:00:00.000Z", // Mon Jul 6
      "2026-07-08T18:00:00.000Z", // Wed Jul 8
    ]);
  });

  it("caps the expansion at opts.max (runaway guard, default 52)", () => {
    expect(expandRrule("FREQ=WEEKLY", DTSTART)).toHaveLength(52);
    expect(expandRrule("FREQ=WEEKLY", DTSTART, { max: 5 })).toHaveLength(5);
  });
});

describe("COUNT vs UNTIL termination", () => {
  it("COUNT stops after N occurrences", () => {
    expect(expandRrule("FREQ=WEEKLY;COUNT=4", DTSTART)).toHaveLength(4);
  });

  it("UNTIL stops at/after the boundary instant (inclusive)", () => {
    const occ = expandRrule("FREQ=WEEKLY;UNTIL=20260715T180000Z", DTSTART);
    expect(occ).toEqual([
      "2026-07-01T18:00:00.000Z",
      "2026-07-08T18:00:00.000Z",
      "2026-07-15T18:00:00.000Z", // inclusive of the UNTIL instant
    ]);
  });

  it("UNTIL before an occurrence excludes it", () => {
    const occ = expandRrule("FREQ=WEEKLY;UNTIL=20260714T000000Z", DTSTART);
    expect(occ).toEqual(["2026-07-01T18:00:00.000Z", "2026-07-08T18:00:00.000Z"]);
  });
});

describe("nextOccurrences", () => {
  it("returns the next N occurrences at/after a cutoff", () => {
    const next = nextOccurrences("FREQ=WEEKLY", DTSTART, "2026-07-10T00:00:00.000Z", 2);
    expect(next).toEqual(["2026-07-15T18:00:00.000Z", "2026-07-22T18:00:00.000Z"]);
  });

  it("respects COUNT so it can return fewer than N", () => {
    const next = nextOccurrences("FREQ=WEEKLY;COUNT=2", DTSTART, "2026-07-05T00:00:00.000Z", 5);
    expect(next).toEqual(["2026-07-08T18:00:00.000Z"]);
  });
});

describe("toIcs (VCALENDAR/VEVENT shape)", () => {
  it("renders a valid single-event calendar with escaped text", () => {
    const ics = toIcs({
      title: "Open Play; all levels",
      startTs: DTSTART,
      endTs: "2026-07-01T20:00:00.000Z",
      description: "Bring water, paddles",
      location: "Lawrence, KS",
      url: "https://pickleloko.com/outings/abc",
      uid: "abc@pickleloko",
    });
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:abc@pickleloko");
    expect(ics).toContain("DTSTART:20260701T180000Z");
    expect(ics).toContain("DTEND:20260701T200000Z");
    // ';' and ',' are backslash-escaped per RFC 5545.
    expect(ics).toContain("SUMMARY:Open Play\\; all levels");
    expect(ics).toContain("DESCRIPTION:Bring water\\, paddles");
    expect(ics).toContain("URL:https://pickleloko.com/outings/abc");
  });
});

describe("promoteFromWaitlist (pure)", () => {
  const wl = (uid: string, pos: number): RsvpItem => ({
    pk: "OUTING#o1",
    sk: `RSVP#${uid}`,
    entity: "RSVP",
    outingId: "o1",
    uid,
    status: "waitlist",
    waitlistPos: pos,
  });

  it("promotes the lowest-position waitlister and repositions the rest", () => {
    const going: RsvpItem = { pk: "OUTING#o1", sk: "RSVP#g", entity: "RSVP", outingId: "o1", uid: "g", status: "going" };
    const { promoted, remaining } = promoteFromWaitlist([wl("b", 2), going, wl("a", 1), wl("c", 3)]);
    expect(promoted?.uid).toBe("a");
    expect(promoted?.status).toBe("going");
    expect(promoted?.waitlistPos).toBeUndefined();
    expect(remaining.map((r) => [r.uid, r.waitlistPos])).toEqual([
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("no waitlist → nothing to promote", () => {
    const { promoted, remaining } = promoteFromWaitlist([]);
    expect(promoted).toBeUndefined();
    expect(remaining).toEqual([]);
  });
});

describe("court-local CITYGAME day bucket (§9.5 #8)", () => {
  it("buckets by the court's local day, not UTC (longitude-approximated)", () => {
    // Kansas lng -95 → UTC-6. An outing at 2026-07-02T03:00Z is still Jul 1 locally.
    expect(courtLocalDay({ lng: -95 }, Date.parse("2026-07-02T03:00:00Z"))).toBe("20260701");
    // Near the date line (lng 179 → +12): a 2026-06-30T18:00Z start is Jul 1 locally.
    expect(courtLocalDay({ lng: 179 }, Date.parse("2026-06-30T18:00:00Z"))).toBe("20260701");
  });
});
