/**
 * ladders-rerank.test.ts — PROPERTY tests for the PURE ladder rules
 * (`lib/ladders/rerank`, PRD §7.4). These functions are the single source of truth
 * for eligibility, movement, and the response window, so they're pinned with
 * fast-check invariants rather than a handful of examples.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { canChallenge, applyResult, dueDateFrom, isExpired } from "@/lib/ladders/rerank";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reference implementation of a challenger-win move (splice out, splice in). */
function referenceUpset(order: string[], ci: number, di: number): string[] {
  const a = order.slice();
  const [x] = a.splice(ci, 1);
  a.splice(di, 0, x);
  return a;
}

/** An ordered ladder of distinct ids + two distinct 0-based positions in it. */
const ladderWithPair = fc
  .integer({ min: 2, max: 14 })
  .chain((n) =>
    fc.record({
      order: fc.constant(Array.from({ length: n }, (_, i) => `p${i}`)),
      a: fc.integer({ min: 0, max: n - 1 }),
      b: fc.integer({ min: 0, max: n - 1 }),
    }),
  )
  .filter(({ a, b }) => a !== b);

describe("canChallenge — range / self / above rules (§7.4)", () => {
  it("is true iff the target is strictly ABOVE and within range", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 0, max: 300 }),
        (challengerPos, challengedPos, range) => {
          const expected =
            challengedPos < challengerPos && challengerPos - challengedPos <= range;
          expect(canChallenge({ challengerPos, challengedPos, range })).toBe(expected);
        },
      ),
    );
  });

  it("you can never challenge yourself, regardless of range", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 300 }), fc.integer({ min: 0, max: 300 }), (pos, range) => {
        expect(canChallenge({ challengerPos: pos, challengedPos: pos, range })).toBe(false);
      }),
    );
  });

  it("you can never challenge someone at or below you (target must be above)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 300 }),
        (challengerPos, below, range) => {
          const challengedPos = challengerPos + below; // at or below (>= challengerPos)
          expect(canChallenge({ challengerPos, challengedPos, range })).toBe(false);
        },
      ),
    );
  });

  it("the range boundary is inclusive (== range true, == range+1 false)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), (range, challengedPos) => {
        expect(canChallenge({ challengerPos: challengedPos + range, challengedPos, range })).toBe(true);
        expect(canChallenge({ challengerPos: challengedPos + range + 1, challengedPos, range })).toBe(false);
      }),
    );
  });
});

describe("applyResult — movement, length, permutation, idempotence (§7.4)", () => {
  it("challenger win (valid upward): challenger takes the rung; everyone between slides down one", () => {
    fc.assert(
      fc.property(ladderWithPair, ({ order, a, b }) => {
        const di = Math.min(a, b); // challenged is ABOVE (smaller index)
        const ci = Math.max(a, b); // challenger is BELOW (larger index)
        const challenger = order[ci];
        const challenged = order[di];
        const next = applyResult(order, challenger, challenged, challenger);

        expect(next).toEqual(referenceUpset(order, ci, di));
        expect(next[di]).toBe(challenger); // challenger now occupies the challenged's rung
        // Everyone originally in [di, ci-1] slides down exactly one rung.
        for (let k = di; k < ci; k++) expect(next[k + 1]).toBe(order[k]);
        // Positions outside [di, ci] are untouched.
        for (let k = 0; k < di; k++) expect(next[k]).toBe(order[k]);
        for (let k = ci + 1; k < order.length; k++) expect(next[k]).toBe(order[k]);
      }),
    );
  });

  it("challenged win is a no-op on the order", () => {
    fc.assert(
      fc.property(ladderWithPair, ({ order, a, b }) => {
        const di = Math.min(a, b);
        const ci = Math.max(a, b);
        const next = applyResult(order, order[ci], order[di], order[di]); // challenged wins
        expect(next).toEqual(order);
      }),
    );
  });

  it("an invalid pairing (challenger already above the challenged) is a no-op", () => {
    fc.assert(
      fc.property(ladderWithPair, ({ order, a, b }) => {
        const di = Math.max(a, b); // challenged BELOW
        const ci = Math.min(a, b); // challenger ABOVE → invalid upward challenge
        const next = applyResult(order, order[ci], order[di], order[ci]);
        expect(next).toEqual(order);
      }),
    );
  });

  it("a winner who is not a participant never moves the ladder", () => {
    fc.assert(
      fc.property(ladderWithPair, ({ order, a, b }) => {
        const di = Math.min(a, b);
        const ci = Math.max(a, b);
        const next = applyResult(order, order[ci], order[di], "not-a-player");
        expect(next).toEqual(order);
      }),
    );
  });

  it("always preserves length + is a permutation of the input (never mutates it)", () => {
    fc.assert(
      fc.property(
        ladderWithPair,
        fc.constantFrom<"challenger" | "challenged" | "other">("challenger", "challenged", "other"),
        ({ order, a, b }, who) => {
          const frozen = order.slice();
          const di = Math.min(a, b);
          const ci = Math.max(a, b);
          const winner =
            who === "challenger" ? order[ci] : who === "challenged" ? order[di] : "ghost";
          const next = applyResult(order, order[ci], order[di], winner);
          expect(next).toHaveLength(order.length);
          expect([...next].sort()).toEqual([...order].sort());
          expect(order).toEqual(frozen); // input untouched
        },
      ),
    );
  });

  it("is idempotent: re-applying the same confirmed upset changes nothing further", () => {
    fc.assert(
      fc.property(ladderWithPair, ({ order, a, b }) => {
        const di = Math.min(a, b);
        const ci = Math.max(a, b);
        const challenger = order[ci];
        const challenged = order[di];
        const once = applyResult(order, challenger, challenged, challenger);
        const twice = applyResult(once, challenger, challenged, challenger);
        expect(twice).toEqual(once);
      }),
    );
  });
});

describe("dueDateFrom / isExpired — the response window (§7.4)", () => {
  const isoArb = fc
    .integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2100, 0, 1) })
    .map((ms) => new Date(ms).toISOString());

  it("advances the due date by exactly N whole days (UTC, no drift)", () => {
    fc.assert(
      fc.property(isoArb, fc.integer({ min: 0, max: 3650 }), (iso, days) => {
        const due = dueDateFrom(iso, days);
        expect(new Date(due).getTime() - new Date(iso).getTime()).toBe(days * DAY_MS);
      }),
    );
  });

  it("clamps negative / fractional windows to whole non-negative days", () => {
    fc.assert(
      fc.property(isoArb, fc.double({ min: -100, max: 100, noNaN: true }), (iso, days) => {
        const due = dueDateFrom(iso, days);
        const expectedDays = Math.max(0, Math.floor(days));
        expect(new Date(due).getTime() - new Date(iso).getTime()).toBe(expectedDays * DAY_MS);
      }),
    );
  });

  it("a challenge is NOT expired at the moment it is issued", () => {
    fc.assert(
      fc.property(isoArb, fc.integer({ min: 0, max: 3650 }), (iso, days) => {
        expect(isExpired(dueDateFrom(iso, days), iso)).toBe(false);
      }),
    );
  });

  it("isExpired is true exactly when now is strictly past the due date", () => {
    fc.assert(
      fc.property(isoArb, fc.integer({ min: 1, max: 3650 }), (iso, days) => {
        const due = dueDateFrom(iso, days);
        const justBefore = new Date(new Date(due).getTime() - 1).toISOString();
        const exactly = due;
        const justAfter = new Date(new Date(due).getTime() + 1).toISOString();
        expect(isExpired(due, justBefore)).toBe(false);
        expect(isExpired(due, exactly)).toBe(false); // strict >, equal is not expired
        expect(isExpired(due, justAfter)).toBe(true);
      }),
    );
  });
});
