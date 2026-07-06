/**
 * badges.ts — the badge catalog + tier function (Gamification PRD §G6).
 *
 * Tiered FAMILIES (Bronze→Platinum, one item per family upgraded in place) plus
 * one-off SPECIALS. The catalog is typed static config — adding a badge is a code
 * change, not a migration. The tier function is monotonic: a counter jump crossing
 * multiple thresholds lands on the HIGHEST tier (G6 verification).
 *
 * Pure, no I/O. The badge-driving counters live on the gamify profile (`GamifyCounters`
 * derives from {@link COUNTER_KEYS} here — the single source of truth); Streaker reads
 * the separate `streakBest` field.
 */

/** The badge-driving tallies on the gamify profile (G13.1). */
export const COUNTER_KEYS = [
  "checkins",
  "courtsVisited",
  "reviews",
  "photos",
  "helpfulVotes",
  "tourneyMatches",
  "podiums",
  "seasonsCompleted",
  "rungsClimbed",
  "outingsAttended",
  "outingsHosted",
  "rrCompleted",
  "groupsFounded",
  "bestCourtCheckins",
] as const;
export type CounterKey = (typeof COUNTER_KEYS)[number];
export type Counters = Record<CounterKey, number>;

/** What a badge tier evaluates against: the counters plus the special `streakBest`. */
export type BadgeSnapshot = Counters & { streakBest: number };
export type BadgeCounterSource = CounterKey | "streakBest";

export type BadgeBehavior = "B1" | "B2" | "B3" | "B4" | "habit";

export interface BadgeFamilyDef {
  id: string;
  name: string;
  behavior: BadgeBehavior;
  /** The snapshot field this family reads. */
  counter: BadgeCounterSource;
  /** Ascending tier thresholds [Bronze, Silver, Gold, Platinum]; some families omit higher tiers. */
  tiers: number[];
  flavor: string;
}

/** Tier display names, indexed by tier number (0 = not earned / one-off). */
export const TIER_NAMES = ["", "Bronze", "Silver", "Gold", "Platinum"] as const;
export const MAX_TIER = 4;

/** The evergreen tiered families (G6.2 launch set). */
export const BADGE_FAMILIES: readonly BadgeFamilyDef[] = [
  { id: "explorer", name: "Explorer", behavior: "B1", counter: "courtsVisited", tiers: [3, 10, 25, 60], flavor: "Distinct courts checked into" },
  { id: "homebody", name: "Homebody", behavior: "B1", counter: "bestCourtCheckins", tiers: [10, 30, 75, 150], flavor: "Check-ins at your home court" },
  { id: "scout", name: "Scout", behavior: "B2", counter: "reviews", tiers: [1, 5, 15, 40], flavor: "Reviews published" },
  { id: "shutterbug", name: "Shutterbug", behavior: "B2", counter: "photos", tiers: [3, 10, 25, 60], flavor: "Court photos contributed" },
  { id: "helpful", name: "Helpful", behavior: "B2", counter: "helpfulVotes", tiers: [10, 50, 150, 400], flavor: "Helpful votes received" },
  { id: "competitor", name: "Competitor", behavior: "B3", counter: "tourneyMatches", tiers: [3, 10, 30, 75], flavor: "Tournament matches played" },
  { id: "medalist", name: "Medalist", behavior: "B3", counter: "podiums", tiers: [1, 3, 8, 20], flavor: "Tournament podiums" },
  { id: "grinder", name: "Grinder", behavior: "B3", counter: "seasonsCompleted", tiers: [1, 3, 6, 12], flavor: "League seasons completed" },
  { id: "climber", name: "Climber", behavior: "B3", counter: "rungsClimbed", tiers: [3, 10, 25, 60], flavor: "Ladder rungs climbed" },
  { id: "socialite", name: "Socialite", behavior: "B4", counter: "outingsAttended", tiers: [3, 12, 30, 75], flavor: "Outings attended" },
  { id: "host", name: "Host", behavior: "B4", counter: "outingsHosted", tiers: [1, 5, 15, 40], flavor: "Outings & meet-ups hosted" },
  { id: "ringmaster", name: "Ringmaster", behavior: "B4", counter: "rrCompleted", tiers: [1, 5, 15, 40], flavor: "Round robins run" },
  { id: "founder", name: "Founder", behavior: "B4", counter: "groupsFounded", tiers: [1, 2], flavor: "Active groups created" },
  { id: "streaker", name: "Streaker", behavior: "habit", counter: "streakBest", tiers: [4, 12, 26, 52], flavor: "Best Play Streak (weeks)" },
] as const;

export const BADGE_FAMILY_BY_ID: Record<string, BadgeFamilyDef> = Object.fromEntries(
  BADGE_FAMILIES.map((f) => [f.id, f]),
);

export interface SpecialBadgeDef {
  id: string;
  name: string;
  flavor: string;
  /** Criteria hidden until earned (Unpredictability, G6.2). */
  hidden?: boolean;
  /** Shows a stackable count (Trailblazer / First Reviewer). */
  stackable?: boolean;
  /** Retires when its season ends (evergreen families always remain earnable). */
  seasonal?: boolean;
}

/** One-off specials (tier 0). Elite `elite-<year>` is added by the P4 Elite program. */
export const SPECIAL_BADGES: readonly SpecialBadgeDef[] = [
  { id: "trailblazer", name: "Trailblazer", flavor: "First-ever check-in at a court", stackable: true },
  { id: "first-reviewer", name: "First Reviewer", flavor: "First to review a court", stackable: true },
  { id: "rung-one", name: "Rung One", flavor: "Held #1 on a ladder" },
  { id: "champion", name: "Champion", flavor: "Won a bracket" },
  { id: "early-adopter", name: "Early Adopter", flavor: "Joined in the early days" },
  { id: "night-owl", name: "Night Owl", flavor: "Discover it by playing", hidden: true },
] as const;

export const SPECIAL_BADGE_BY_ID: Record<string, SpecialBadgeDef> = Object.fromEntries(
  SPECIAL_BADGES.map((b) => [b.id, b]),
);

/**
 * The tier for a counter value against a family's thresholds: the highest tier whose
 * threshold is ≤ count (0 = not yet earned). Monotonic; a multi-threshold jump lands
 * on the highest tier.
 */
export function tierForCount(tiers: number[], count: number): number {
  let tier = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (count >= tiers[i]) tier = i + 1;
    else break;
  }
  return tier;
}

/** The value a family reads out of a snapshot. */
export function counterValue(family: BadgeFamilyDef, snap: BadgeSnapshot): number {
  return family.counter === "streakBest" ? snap.streakBest : snap[family.counter];
}

/** The current tier of a family for a snapshot. */
export function tierForFamily(family: BadgeFamilyDef, snap: BadgeSnapshot): number {
  return tierForCount(family.tiers, counterValue(family, snap));
}

export interface BadgeUpgrade {
  familyId: string;
  name: string;
  fromTier: number;
  tier: number;
  tierName: string;
}

/**
 * Which families upgraded tier moving `before → after`. Only forward moves report
 * (a revocation-driven counter decrement lowers PROGRESS but never confiscates an
 * earned tier — the data layer holds the tier at its high-water mark, G6.2).
 */
export function evaluateBadgeUpgrades(before: BadgeSnapshot, after: BadgeSnapshot): BadgeUpgrade[] {
  const out: BadgeUpgrade[] = [];
  for (const family of BADGE_FAMILIES) {
    const fromTier = tierForFamily(family, before);
    const tier = tierForFamily(family, after);
    if (tier > fromTier) {
      out.push({ familyId: family.id, name: family.name, fromTier, tier, tierName: TIER_NAMES[tier] });
    }
  }
  return out;
}

/** A zeroed snapshot (all counters + streakBest = 0). */
export function emptySnapshot(): BadgeSnapshot {
  const counters = Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])) as Counters;
  return { ...counters, streakBest: 0 };
}

/** All counters zeroed (the default profile's `counters` map). */
export function emptyCounters(): Counters {
  return Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])) as Counters;
}

/**
 * Which badge-driving counter an earn increments (§G6.2 ↔ §G13.1). `bestCourtCheckins`
 * (Homebody) is a per-court max the hot path can't track incrementally — the reconcile
 * sweep computes it — so it is deliberately absent here.
 */
export const RULE_COUNTER: Partial<Record<import("./earn-rules").EarnRule, CounterKey>> = {
  E1: "checkins",
  E3: "courtsVisited",
  E5: "reviews",
  E9: "photos",
  E8: "helpfulVotes",
  E11: "tourneyMatches",
  E12: "podiums",
  E15: "seasonsCompleted",
  E17: "rungsClimbed",
  E19: "outingsAttended",
  E20: "outingsHosted",
  E23: "outingsHosted",
  E21: "rrCompleted",
  E22: "groupsFounded",
};
