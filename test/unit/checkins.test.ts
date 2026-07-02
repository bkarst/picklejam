import { describe, it, expect } from "vitest";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { buildCheckinItem, type CreateCheckinInput } from "@/lib/data/checkins";
import { buildAnonTokenItem, ANON_TTL_SECONDS } from "@/lib/data/anon";
import { courtKeys } from "@/lib/db/keys";

describe("courtLocalDay (§6.2 court-local day, longitude-approximated)", () => {
  it("uses the court's longitude offset, not UTC (Kansas ~ -95° → UTC-6 CDT-ish)", () => {
    // Kansas lng -95 → offsetHours = round(-95/15) = -6. Just before local midnight
    // it is still the PREVIOUS day locally even though UTC has ticked over.
    const kansas = { lng: -95 };
    // 2026-07-01T04:00Z − 6h = 2026-06-30T22:00 local → June 30.
    expect(courtLocalDay(kansas, Date.parse("2026-07-01T04:00:00Z"))).toBe("20260630");
    // 2026-07-01T07:00Z − 6h = 2026-07-01T01:00 local → July 1 (boundary crossed).
    expect(courtLocalDay(kansas, Date.parse("2026-07-01T07:00:00Z"))).toBe("20260701");
  });

  it("handles a near-date-line court (positive offset ahead of UTC)", () => {
    const nearDateLine = { lng: 179 }; // offsetHours = round(179/15) = 12
    // 2026-06-30T18:00Z + 12h = 2026-07-01T06:00 local → already July 1 while UTC is June 30.
    expect(courtLocalDay(nearDateLine, Date.parse("2026-06-30T18:00:00Z"))).toBe("20260701");
  });

  it("zero-pads months and days", () => {
    expect(courtLocalDay({ lng: 0 }, Date.parse("2026-01-05T12:00:00Z"))).toBe("20260105");
  });
});

describe("anon token carries NO uid / PII (§6.2)", () => {
  it("has only token + ttl + stamps — never a uid/email/name", () => {
    const item = buildAnonTokenItem("tok-abc", Date.parse("2026-07-01T00:00:00Z"));
    expect(item.entity).toBe("ANON");
    expect(item.token).toBe("tok-abc");
    expect(item.ttl).toBe(Math.floor(Date.parse("2026-07-01T00:00:00Z") / 1000) + ANON_TTL_SECONDS);
    const keys = Object.keys(item);
    for (const forbidden of ["uid", "email", "name", "displayName", "username"]) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(item)).not.toMatch(/uid|email/i);
  });
});

describe("buildCheckinItem (anonymous vs account)", () => {
  const base: Omit<CreateCheckinInput, "uid" | "anonymous"> = {
    courtId: "court-x",
    day: "20260701",
    note: "looking for doubles",
    ts: "2026-07-01T12:00:00.000Z",
    id: "cid-1",
  };

  it("anonymous check-ins store NO uid and get NO GSI1 projection", () => {
    const item = buildCheckinItem(
      { ...base, uid: null, anonymous: true },
      "us#ks#lawrence",
    );
    expect(item.anonymous).toBe(true);
    expect(item.checkinDay).toBe("20260701");
    expect(item.cityKey).toBe("us#ks#lawrence");
    expect("uid" in item).toBe(false);
    expect(item.gsi1pk).toBeUndefined();
    expect(item.gsi1sk).toBeUndefined();
    expect(JSON.stringify(item)).not.toMatch(/"uid"/);
  });

  it("account check-ins store the uid + a USER# GSI1 projection (my check-ins)", () => {
    const item = buildCheckinItem(
      { ...base, uid: "user-1", anonymous: false },
      "us#ks#lawrence",
    );
    expect(item.uid).toBe("user-1");
    expect(item.gsi1pk).toBe("USER#user-1");
    expect(item.gsi1sk).toBe("CHECKIN#2026-07-01T12:00:00.000Z");
  });
});

describe("one review per user per court — stable key (§6.4)", () => {
  it("reviewByUser is stable across edits (same pk/sk regardless of createdTs)", () => {
    const a = courtKeys.reviewByUser("court-x", "user-1", "2026-07-01T00:00:00Z");
    const b = courtKeys.reviewByUser("court-x", "user-1", "2026-08-09T00:00:00Z");
    expect(a.pk).toBe(b.pk);
    expect(a.sk).toBe(b.sk); // edit targets the SAME item → no duplicate row
    expect(a.sk).toBe("REVIEW#user-1");
    // still lists under the REVIEW# prefix, and orders "my reviews" by createdTs on GSI1.
    expect(a.sk.startsWith(courtKeys.reviewPrefix())).toBe(true);
    expect(a.gsi1pk).toBe("USER#user-1");
    expect(a.gsi1sk).toBe("REVIEW#2026-07-01T00:00:00Z");
    expect(b.gsi1sk).toBe("REVIEW#2026-08-09T00:00:00Z");
  });
});
