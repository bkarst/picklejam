/**
 * levels.ts — the Rally-Points level ladder (Gamification PRD §G5).
 *
 * Levels derive from `rpLevelWatermark` — the high-water mark of lifetime RP. The
 * exact rule (G5): you are Level N while `watermark ∈ [threshold(N), threshold(N+1))`.
 * The thresholds are a fixed LOOKUP table (not a formula) so tuning is a config edit;
 * early gaps are small (fast wins), later gaps grow (flow-state difficulty curve).
 *
 * Pure, no I/O — the unit/property oracle for level-up detection. Revocations lower
 * `rp`/`rpLifetime` but NEVER the watermark, so a displayed level never regresses:
 * that invariant lives in the data layer (awardXp), enforced by only ever feeding the
 * monotonic watermark to {@link levelForWatermark}.
 */

export interface LevelDef {
  level: number;
  name: string;
  /** Lifetime-RP watermark at which this level begins (inclusive). */
  threshold: number;
}

/** The exact G5 table — hard-coded, a lookup not a formula. */
export const LEVELS: readonly LevelDef[] = [
  { level: 1, name: "Paddle Rookie", threshold: 0 },
  { level: 2, name: "Dinker", threshold: 100 },
  { level: 3, name: "Rally Regular", threshold: 300 },
  { level: 4, name: "Kitchen Veteran", threshold: 700 },
  { level: 5, name: "Spin Doctor", threshold: 1_400 },
  { level: 6, name: "Drop-Shot Artist", threshold: 2_500 },
  { level: 7, name: "Smash Specialist", threshold: 4_200 },
  { level: 8, name: "Bracket Boss", threshold: 6_800 },
  { level: 9, name: "Titan", threshold: 10_500 },
  { level: 10, name: "Legend", threshold: 16_000 },
] as const;

export const MAX_LEVEL = LEVELS.length; // 10
export const MIN_LEVEL = 1;

/** The threshold at which `level` begins, or 0 for out-of-range low. */
export function thresholdFor(level: number): number {
  const def = LEVELS[Math.min(Math.max(level, MIN_LEVEL), MAX_LEVEL) - 1];
  return def.threshold;
}

/** The display name for a level (clamped into range). */
export function levelName(level: number): string {
  return LEVELS[Math.min(Math.max(level, MIN_LEVEL), MAX_LEVEL) - 1].name;
}

/**
 * The level for a given lifetime-RP watermark: the highest level whose threshold is
 * ≤ watermark. Monotonic non-decreasing in `watermark`; always in [1, 10].
 */
export function levelForWatermark(watermark: number): number {
  const w = Number.isFinite(watermark) ? watermark : 0;
  let level = MIN_LEVEL;
  for (const def of LEVELS) {
    if (w >= def.threshold) level = def.level;
    else break;
  }
  return level;
}

export interface LevelInfo {
  level: number;
  name: string;
  /** Threshold at which the current level began. */
  threshold: number;
  /** Threshold of the next level, or `null` at max level. */
  nextThreshold: number | null;
  /** RP accumulated into the current level (`watermark − threshold`). */
  rpIntoLevel: number;
  /** RP remaining to reach the next level, or `null` at max level. */
  rpToNext: number | null;
  /** Progress toward the next level in [0, 1]; 1 at max level (the endowed-progress and ring source). */
  progress: number;
  isMax: boolean;
}

/**
 * Full level breakdown for the ring / progress surfaces. At 25 RP this yields Level 1
 * with `progress = 0.25` — the "25% into Level 2" endowed-progress start (G2.2/G5).
 */
export function levelInfo(watermark: number): LevelInfo {
  const w = Number.isFinite(watermark) ? Math.max(watermark, 0) : 0;
  const level = levelForWatermark(w);
  const threshold = thresholdFor(level);
  const isMax = level >= MAX_LEVEL;
  const nextThreshold = isMax ? null : thresholdFor(level + 1);
  const span = nextThreshold === null ? 0 : nextThreshold - threshold;
  const rpIntoLevel = w - threshold;
  return {
    level,
    name: levelName(level),
    threshold,
    nextThreshold,
    rpIntoLevel,
    rpToNext: nextThreshold === null ? null : nextThreshold - w,
    progress: span > 0 ? Math.min(1, Math.max(0, rpIntoLevel / span)) : 1,
    isMax,
  };
}

/**
 * The level newly reached when the watermark moves `prev → next`, or `null` if the
 * level is unchanged. When a single award crosses MULTIPLE thresholds, the HIGHER
 * wins — a single `level_up` fires with the final level (G5 verification).
 */
export function levelUpCrossed(prevWatermark: number, nextWatermark: number): number | null {
  const before = levelForWatermark(prevWatermark);
  const after = levelForWatermark(nextWatermark);
  return after > before ? after : null;
}
