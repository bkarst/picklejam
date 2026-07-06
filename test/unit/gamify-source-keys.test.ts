/**
 * gamify-source-keys.test.ts — the idempotency contract (§G13.2). Distinct actions
 * must yield distinct keys; replays must yield identical keys; revocations suffix #REV.
 *
 * The bijectivity property holds because identifiers never contain the `#` separator
 * (they are ULIDs / slugs / numbers) — the generators below reflect that invariant.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  sourceKey,
  revocationKey,
  isRevocation,
  ruleOfSourceKey,
  type SourceKeyInput,
} from "@/lib/gamify/source-keys";

describe("sourceKey — the G13.2 registry (table oracle)", () => {
  it("derives the documented keys", () => {
    expect(sourceKey({ rule: "E1", courtId: "c1", day: "20260705" })).toBe("E1#c1#20260705");
    expect(sourceKey({ rule: "E2", courtId: "c1", day: "20260705" })).toBe("E2#c1#20260705");
    expect(sourceKey({ rule: "E3", courtId: "c1" })).toBe("E3#c1");
    expect(sourceKey({ rule: "E5", courtId: "c1" })).toBe("E5#c1");
    expect(sourceKey({ rule: "E8", courtId: "c1", voterUid: "u2" })).toBe("E8#c1#u2");
    expect(sourceKey({ rule: "E9", courtId: "c1", photoId: "p3" })).toBe("E9#c1#p3");
    expect(sourceKey({ rule: "E10", tid: "t1", did: "d1" })).toBe("E10#t1#d1");
    expect(sourceKey({ rule: "E11", tid: "t1", did: "d1", matchId: "m4" })).toBe("E11#t1#d1#m4");
    expect(sourceKey({ rule: "E13", lid: "l1" })).toBe("E13#l1");
    expect(sourceKey({ rule: "E14", lid: "l1", mid: "m9" })).toBe("E14#l1#m9");
    expect(sourceKey({ rule: "E16", lid: "l1", cid: "ch2" })).toBe("E16#l1#ch2");
    expect(sourceKey({ rule: "E19", outingId: "o1" })).toBe("E19#o1");
    expect(sourceKey({ rule: "E22", groupId: "g1" })).toBe("E22#g1");
    expect(sourceKey({ rule: "E24" })).toBe("E24");
    expect(sourceKey({ rule: "E25", step: "profile" })).toBe("E25#profile");
    expect(sourceKey({ rule: "E28", milestone: 12 })).toBe("E28#12");
  });

  it("replays of the same action produce identical keys (idempotent)", () => {
    const inp: SourceKeyInput = { rule: "E1", courtId: "cX", day: "20260101" };
    expect(sourceKey(inp)).toBe(sourceKey({ ...inp }));
  });

  it("the rule prefix round-trips out of any key", () => {
    expect(ruleOfSourceKey(sourceKey({ rule: "E14", lid: "l1", mid: "m9" }))).toBe("E14");
    expect(ruleOfSourceKey(sourceKey({ rule: "E24" }))).toBe("E24");
  });
});

// Delimiter-free id strings — ids are ULIDs/slugs and never contain `#`.
const id = fc.stringMatching(/^[a-zA-Z0-9_-]{1,12}$/);

const anyInput = fc.oneof(
  fc.record({ rule: fc.constantFrom("E1", "E2"), courtId: id, day: id }),
  fc.record({ rule: fc.constantFrom("E3", "E4", "E5", "E6", "E7"), courtId: id }),
  fc.record({ rule: fc.constant("E8"), courtId: id, voterUid: id }),
  fc.record({ rule: fc.constant("E9"), courtId: id, photoId: id }),
  fc.record({ rule: fc.constantFrom("E10", "E12"), tid: id, did: id }),
  fc.record({ rule: fc.constant("E11"), tid: id, did: id, matchId: id }),
  fc.record({ rule: fc.constantFrom("E13", "E15", "E18"), lid: id }),
  fc.record({ rule: fc.constant("E14"), lid: id, mid: id }),
  fc.record({ rule: fc.constantFrom("E16", "E17"), lid: id, cid: id }),
  fc.record({ rule: fc.constantFrom("E19", "E20", "E23"), outingId: id }),
  fc.record({ rule: fc.constant("E21"), eventId: id }),
  fc.record({ rule: fc.constant("E22"), groupId: id }),
  fc.record({ rule: fc.constant("E25"), step: fc.constantFrom("profile", "checkin", "follow") }),
  fc.record({ rule: fc.constantFrom("E26", "E27"), questId: id }),
  fc.record({ rule: fc.constant("E28"), milestone: fc.constantFrom(4, 12, 26, 52) }),
) as fc.Arbitrary<SourceKeyInput>;

describe("bijectivity property (distinct actions ⇒ distinct keys)", () => {
  it("is a deterministic, total function (never throws, always non-empty)", () => {
    fc.assert(
      fc.property(anyInput, (inp) => {
        const k = sourceKey(inp);
        expect(k).toBe(sourceKey(inp));
        expect(k.length).toBeGreaterThan(0);
      }),
    );
  });

  it("two inputs collide only when they are the same action", () => {
    fc.assert(
      fc.property(anyInput, anyInput, (a, b) => {
        if (sourceKey(a) === sourceKey(b)) {
          expect(sortedEntries(a)).toEqual(sortedEntries(b));
        }
      }),
    );
  });
});

function sortedEntries(o: Record<string, unknown>): [string, unknown][] {
  return Object.entries(o).sort(([k1], [k2]) => k1.localeCompare(k2));
}

describe("revocations", () => {
  it("append #REV and are detectable", () => {
    const base = sourceKey({ rule: "E10", tid: "t1", did: "d1" });
    const rev = revocationKey(base);
    expect(rev).toBe("E10#t1#d1#REV");
    expect(isRevocation(rev)).toBe(true);
    expect(isRevocation(base)).toBe(false);
  });
});
