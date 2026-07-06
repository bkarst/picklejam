/**
 * elite.ts — the Elite program's config-driven criteria evaluator (Gamification PRD §G11).
 *
 * Pure + I/O-free (unit/property-testable): the thresholds live in `ELITE_CRITERIA` (config,
 * not code — a threshold change needs no code change), `evaluateElite` grades a computed
 * `EliteStats` against them, and `eliteCriteriaCopy` renders the SAME config as the public
 * criteria list so the `/elite` page can never drift from what's enforced (§G11 fairness).
 * A single moderation strike voids eligibility outright (§G11 "zero strikes").
 */

export interface EliteCriteriaConfig {
  minReviews: number;
  minMedianWords: number;
  minVerifiedPct: number; // 0..1
  minCheckins: number;
  /** Either ≥ `competitions` competition entries OR ≥ `hosted` hosted events. */
  minCompetitionsOrHosted: { competitions: number; hosted: number };
  maxStrikes: number;
}

/** §G11 thresholds — CONFIG, not code. Change these without touching the evaluator. */
export const ELITE_CRITERIA: EliteCriteriaConfig = {
  minReviews: 12,
  minMedianWords: 80,
  minVerifiedPct: 0.6,
  minCheckins: 40,
  minCompetitionsOrHosted: { competitions: 1, hosted: 6 },
  maxStrikes: 0,
};

/** The raw signals the evaluator grades — computed from the ledger, reviews, and strikes. */
export interface EliteStats {
  reviews: number;
  medianReviewWords: number;
  verifiedPct: number; // 0..1 (0 when no reviews)
  checkins: number;
  competitions: number;
  hostedEvents: number;
  strikes: number;
}

export interface EliteCheck {
  key: string;
  label: string;
  met: boolean;
  value: string;
  target: string;
}

export interface EliteEvaluation {
  eligible: boolean;
  checks: EliteCheck[];
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Grade a user's stats against the Elite criteria (all checks must pass; strikes veto). */
export function evaluateElite(stats: EliteStats, config: EliteCriteriaConfig = ELITE_CRITERIA): EliteEvaluation {
  const co = config.minCompetitionsOrHosted;
  const checks: EliteCheck[] = [
    { key: "reviews", label: "Quality reviews", met: stats.reviews >= config.minReviews, value: `${stats.reviews}`, target: `${config.minReviews}+` },
    {
      key: "medianWords",
      label: "Median review length",
      met: stats.reviews >= config.minReviews && stats.medianReviewWords >= config.minMedianWords,
      value: `${stats.medianReviewWords} words`,
      target: `${config.minMedianWords}+ words`,
    },
    {
      key: "verified",
      label: "Check-in-verified reviews",
      met: stats.verifiedPct >= config.minVerifiedPct,
      value: pct(stats.verifiedPct),
      target: `${pct(config.minVerifiedPct)}+`,
    },
    { key: "checkins", label: "Check-ins", met: stats.checkins >= config.minCheckins, value: `${stats.checkins}`, target: `${config.minCheckins}+` },
    {
      key: "participation",
      label: "Competes or hosts",
      met: stats.competitions >= co.competitions || stats.hostedEvents >= co.hosted,
      value: `${stats.competitions} entries · ${stats.hostedEvents} hosted`,
      target: `${co.competitions}+ entry or ${co.hosted}+ hosted`,
    },
    { key: "strikes", label: "Clean record", met: stats.strikes <= config.maxStrikes, value: `${stats.strikes} strikes`, target: "no strikes" },
  ];
  return { eligible: checks.every((c) => c.met), checks };
}

/** The public criteria list for `/elite`, rendered from the live config (never hand-written). */
export function eliteCriteriaCopy(config: EliteCriteriaConfig = ELITE_CRITERIA): string[] {
  const co = config.minCompetitionsOrHosted;
  return [
    `Write ${config.minReviews}+ quality reviews (median ${config.minMedianWords}+ words)`,
    `Keep ${pct(config.minVerifiedPct)}+ of your reviews check-in-verified`,
    `Check in ${config.minCheckins}+ times`,
    `Enter ${co.competitions}+ competition or host ${co.hosted}+ events`,
    `Maintain a clean record — no moderation strikes`,
  ];
}

/** The median of a list of word counts (0 for an empty list). */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** The Elite badge id for a given year (a year-stamped special badge). */
export function eliteBadgeId(year: string): string {
  return `elite-${year}`;
}

/** The current qualifying/award year as a `yyyy` string. */
export function currentEliteYear(now: number = Date.now()): string {
  return new Date(now).getUTCFullYear().toString();
}
