/**
 * award.ts — the PURE award planner (Gamification PRD §G4/§G13.2).
 *
 * Given the current profile snapshot and the earns firing at one confirmation point,
 * compute the exact deltas the `awardXp` transaction applies: total RP, per-capped-
 * family points (the day-cap condition targets), counter increments, the new lifetime/
 * watermark/level, and whether a `level_up` crosses. No I/O — the unit oracle for the
 * data layer, so cap/level/counter math is testable without DynamoDB.
 *
 * Revocations (negative) subtract RP + counters but NEVER move the watermark/level
 * (levels are prestige, not balance — §G4.3).
 */

import { pointsFor, capFamilyOf, isCapped, type EarnRule, type EarnContext, type CapFamily } from "./earn-rules";
import { RULE_COUNTER, type CounterKey } from "./badges";
import { levelForWatermark, levelUpCrossed } from "./levels";

export interface PlannedEarn {
  rule: EarnRule;
  ctx?: EarnContext;
}

/** The slice of the profile the planner reads. */
export interface AwardSnapshot {
  rpLifetime: number;
  rpLevelWatermark: number;
}

export interface AwardPlan {
  /** Signed total RP (negative for revocations). */
  total: number;
  /** Signed points per earn (parallel to the input). */
  perEarn: { rule: EarnRule; points: number }[];
  /** Points per CAPPED family — the day-cap condition targets (always ≥ 0; empty for revocations). */
  cappedFamilyPoints: Partial<Record<CapFamily, number>>;
  /** Signed counter increments. */
  counterDeltas: Partial<Record<CounterKey, number>>;
  newLifetime: number;
  /** The new watermark (null for revocations — unchanged). */
  newWatermark: number | null;
  /** The new level (null for revocations — unchanged). */
  newLevel: number | null;
  /** The level newly reached, or null (never on a revocation). */
  levelUp: number | null;
  isRevocation: boolean;
}

/** The counter delta an earn contributes (E17 scales by rungs; others +1). */
function counterDelta(rule: EarnRule, ctx?: EarnContext): { counter: CounterKey; by: number } | null {
  const counter = RULE_COUNTER[rule];
  if (!counter) return null;
  const by = rule === "E17" ? Math.max(0, ctx?.rungs ?? 1) : 1;
  return { counter, by };
}

/**
 * Plan an award (or a revocation, `revoke: true`). Points are summed with the sign;
 * for revocations the caller has already chosen `#REV` sourceKeys — the planner just
 * negates points/counters and freezes the watermark/level.
 */
export function planAward(
  snap: AwardSnapshot,
  earns: PlannedEarn[],
  opts: { revoke?: boolean } = {},
): AwardPlan {
  const sign = opts.revoke ? -1 : 1;

  const perEarn = earns.map((e) => ({ rule: e.rule, points: sign * pointsFor(e.rule, e.ctx) }));
  const total = perEarn.reduce((sum, e) => sum + e.points, 0);

  const cappedFamilyPoints: Partial<Record<CapFamily, number>> = {};
  const counterDeltas: Partial<Record<CounterKey, number>> = {};
  for (const e of earns) {
    const gross = pointsFor(e.rule, e.ctx); // unsigned
    if (!opts.revoke && isCapped(e.rule) && gross > 0) {
      const fam = capFamilyOf(e.rule);
      cappedFamilyPoints[fam] = (cappedFamilyPoints[fam] ?? 0) + gross;
    }
    const cd = counterDelta(e.rule, e.ctx);
    if (cd) counterDeltas[cd.counter] = (counterDeltas[cd.counter] ?? 0) + sign * cd.by;
  }

  const newLifetime = snap.rpLifetime + total;

  if (opts.revoke) {
    return {
      total, perEarn, cappedFamilyPoints, counterDeltas,
      newLifetime, newWatermark: null, newLevel: null, levelUp: null, isRevocation: true,
    };
  }

  const newWatermark = Math.max(snap.rpLevelWatermark, newLifetime);
  const newLevel = levelForWatermark(newWatermark);
  const levelUp = levelUpCrossed(snap.rpLevelWatermark, newWatermark);
  return {
    total, perEarn, cappedFamilyPoints, counterDeltas,
    newLifetime, newWatermark, newLevel, levelUp, isRevocation: false,
  };
}
