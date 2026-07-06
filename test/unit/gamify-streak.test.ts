/**
 * gamify-streak.test.ts — the G8.2 state-machine contract (the heaviest property
 * target). resolve idempotence, sweep-lag equivalence, Rain-Check earn/spend, repair
 * grace, milestones, and the "any sequence ⇒ valid state" invariant.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  initialStreak,
  resolveStreak,
  applyPlay,
  resolveAndPlay,
  RAIN_CHECK_MAX,
  type StreakState,
} from "@/lib/gamify/streak";
import { addWeeks } from "@/lib/gamify/time";

const W = (n: number): string => addWeeks("2026-W01", n); // W(0) = 2026-W01

/** Drive a chain of played weeks (relative to 2026-W01) via the lazy award path. */
function playSequence(offsets: number[], start: StreakState = initialStreak()): StreakState {
  return offsets.reduce((s, off) => resolveAndPlay(s, W(off)).state, start);
}

describe("scenario walk-throughs (§G8)", () => {
  it("6 straight weeks: chain 6, one Rain Check at week 4, milestone at 4", () => {
    let s = initialStreak();
    const milestones: (number | undefined)[] = [];
    for (let i = 0; i < 6; i++) {
      const r = resolveAndPlay(s, W(i));
      s = r.state;
      milestones.push(r.milestone);
    }
    expect(s.streakWeeks).toBe(6);
    expect(s.streakBest).toBe(6);
    expect(s.rainChecks).toBe(1); // earned at week 4
    expect(milestones).toEqual([undefined, undefined, undefined, 4, undefined, undefined]);
  });

  it("a missed week with a Rain Check banked preserves the chain without incrementing", () => {
    const s6 = playSequence([0, 1, 2, 3, 4, 5]); // chain 6, rainChecks 1
    expect(s6.rainChecks).toBe(1);
    // skip week 6, play week 7
    const afterMiss = resolveStreak(s6, W(7));
    expect(afterMiss.rainChecks).toBe(0); // spent
    expect(afterMiss.streakWeeks).toBe(6); // preserved, not incremented
    const played = applyPlay(afterMiss, W(7)).state;
    expect(played.streakWeeks).toBe(7); // now increments on the played week
  });

  it("a single-week lapse with no Rain Check breaks; playing the very next week REPAIRS", () => {
    // chain of 2 (no rain check banked yet), then miss week 2, play week 3
    let s = playSequence([0, 1]); // weeks W0,W1 → chain 2
    expect(s.streakWeeks).toBe(2);
    const r = resolveAndPlay(s, W(3)); // skipped W2
    expect(r.outcome).toBe("repair");
    expect(r.state.streakWeeks).toBe(3); // streakPrev(2) + 1
    expect(r.state.rainChecks).toBe(0); // 3 is not a multiple of 4
    expect(r.state.lastRepairWeek).toBe(W(3));
    s = r.state;
    // a SECOND single-week lapse within 12 weeks: repair on cooldown → fresh start
    const r2 = resolveAndPlay(s, W(5)); // skipped W4, played W5
    expect(r2.outcome).toBe("start");
    expect(r2.state.streakWeeks).toBe(1);
  });

  it("a long absence is NOT a repairable single lapse — it fresh-starts (intent, G8)", () => {
    const s = playSequence([0, 1, 2]); // chain 3
    const r = resolveAndPlay(s, W(8)); // skipped W3..W7 (5 weeks) → cascaded breaks zero streakPrev
    expect(r.outcome).toBe("start");
    expect(r.state.streakWeeks).toBe(1);
    expect(r.state.streakBest).toBe(3); // best preserved
  });
});

describe("resolveStreak — idempotent", () => {
  it("resolve∘resolve = resolve", () => {
    fc.assert(
      fc.property(anyStreak(), fc.integer({ min: 0, max: 60 }), (s, n) => {
        const now = W(n);
        const once = resolveStreak(s, now);
        const twice = resolveStreak(once, now);
        expect(twice).toEqual(once);
      }),
    );
  });
});

describe("sweep-lag is immaterial (lazy ≡ incremental Sunday sweeps)", () => {
  it("resolving straight to nowWeek equals resolving week-by-week", () => {
    fc.assert(
      fc.property(anyStreak({ played: true }), fc.integer({ min: 1, max: 40 }), (s, span) => {
        const start = s.coveredWeek!;
        const now = addWeeks(start, span);
        const lazy = resolveStreak(s, now);
        let incremental = s;
        for (let i = 1; i <= span; i++) incremental = resolveStreak(incremental, addWeeks(start, i));
        expect(incremental).toEqual(lazy);
      }),
    );
  });
});

describe("applyPlay — idempotent within a week", () => {
  it("replaying the same week is a no-op", () => {
    fc.assert(
      fc.property(anyStreak(), fc.integer({ min: 0, max: 60 }), (s, n) => {
        const first = resolveAndPlay(s, W(n)).state;
        const second = applyPlay(first, W(n));
        expect(second.outcome).toBe("noop");
        expect(second.state).toEqual(first);
      }),
    );
  });
});

describe("Rain Checks — earn every 4th played week, bank ≤ 2", () => {
  it("banks one every 4 played weeks up to the cap", () => {
    let s = initialStreak();
    const banked: number[] = [];
    for (let i = 0; i < 16; i++) {
      s = resolveAndPlay(s, W(i)).state;
      banked.push(s.rainChecks);
    }
    // weeks 4,8,12,16 earn; cap holds at 2.
    expect(banked[3]).toBe(1);
    expect(banked[7]).toBe(2);
    expect(banked[11]).toBe(2); // capped
    expect(s.rainChecks).toBeLessThanOrEqual(RAIN_CHECK_MAX);
  });
});

describe("milestones reported at 4/12/26/52", () => {
  it("fires exactly on those rungs", () => {
    let s = initialStreak();
    const hits: number[] = [];
    for (let i = 0; i < 52; i++) {
      const r = resolveAndPlay(s, W(i));
      s = r.state;
      if (r.milestone) hits.push(r.milestone);
    }
    expect(hits).toEqual([4, 12, 26, 52]);
  });
});

describe("invariants hold under any action sequence", () => {
  it("no negative counters, rainChecks ≤ 2, streakBest monotonic & ≥ streakWeeks", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 40 }),
        (gaps) => {
          let s = initialStreak();
          let off = 0;
          let prevBest = 0;
          for (const gap of gaps) {
            off += gap;
            s = resolveAndPlay(s, W(off)).state;
            expect(s.streakWeeks).toBeGreaterThanOrEqual(0);
            expect(s.rainChecks).toBeGreaterThanOrEqual(0);
            expect(s.rainChecks).toBeLessThanOrEqual(RAIN_CHECK_MAX);
            expect(s.streakBest).toBeGreaterThanOrEqual(s.streakWeeks);
            expect(s.streakBest).toBeGreaterThanOrEqual(prevBest); // monotonic
            prevBest = s.streakBest;
          }
        },
      ),
    );
  });
});

// ── generators ──────────────────────────────────────────────────────────────

/** An arbitrary (reachable) streak state, built by driving a random play sequence. */
function anyStreak(opts: { played?: boolean } = {}): fc.Arbitrary<StreakState> {
  const seq = fc.array(fc.integer({ min: 1, max: 6 }), {
    minLength: opts.played ? 1 : 0,
    maxLength: 30,
  });
  return seq.map((gaps) => {
    let s = initialStreak();
    let off = 0;
    for (const gap of gaps) {
      off += gap;
      s = resolveAndPlay(s, W(off)).state;
    }
    return s;
  });
}
