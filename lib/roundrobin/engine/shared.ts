/**
 * shared.ts — pure, seeded primitives reused across all five generators (§6.8).
 *
 * Everything here is a deterministic function of its inputs (the only randomness
 * source is `../rng`, threaded via an explicit seed). No `Math.random`, no
 * `Date.now`, no ambient state — that is what makes "same seed ⇒ identical
 * schedule for every viewer" hold (§14.1).
 */

import type { Match, RrConfig, Side } from "../types";
import { makeRng, deriveSeed } from "../rng";

/** True once BOTH scores are present (i.e. the match has been entered). */
export function isDecided(m: Match): boolean {
  return typeof m.scoreA === "number" && typeof m.scoreB === "number";
}

/** Who won a scored match: "A", "B" or "tie" (equal scores). */
export function outcome(m: Match): "A" | "B" | "tie" | null {
  if (!isDecided(m)) return null;
  const a = m.scoreA as number;
  const b = m.scoreB as number;
  return a > b ? "A" : b > a ? "B" : "tie";
}

/** The winning Side of a decided, non-tied match (else null). */
export function winnerSide(m: Match): Side | null {
  const o = outcome(m);
  if (o === "A") return m.sideA;
  if (o === "B") return m.sideB;
  return null;
}

/** The losing Side of a decided, non-tied match (else null). */
export function loserSide(m: Match): Side | null {
  const o = outcome(m);
  if (o === "A") return m.sideB;
  if (o === "B") return m.sideA;
  return null;
}

/** FNV-1a hash of a string → 32-bit unsigned int (for stable per-id sub-seeds). */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * A stable pseudo-random key in [0,1) for an entrant id under a given seed.
 * Used as the final, always-total tiebreak rung and to break generation ties.
 */
export function rngKeyFor(seed: number, id: string): number {
  return makeRng(deriveSeed(seed, hashString(id)))();
}

/** entrant id → its effective seed (explicit `seed`, else 1-based config order). */
export function seedMap(config: RrConfig): Map<string, number> {
  const m = new Map<string, number>();
  config.entrants.forEach((e, i) => m.set(e.id, e.seed ?? i + 1));
  return m;
}

/** Smallest even integer ≥ n. */
export function padEven(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

/** Smallest power of two ≥ n, but never below 2. */
export function nextPow2(n: number): number {
  let b = 1;
  while (b < n) b *= 2;
  return Math.max(b, 2);
}

/**
 * Circle method (round-robin scheduling / 1-factorization of K_m).
 *
 * For an EVEN participant count `m`, returns `m - 1` rounds; each round is a
 * perfect matching of `[0, m)` (an array of `[i, j]` index pairs), and across
 * all rounds every unordered pair appears exactly once. Callers that need an
 * odd count pad with a sentinel index (`m - 1`) representing "bye".
 */
export function circleRounds(m: number): [number, number][][] {
  const rounds: [number, number][][] = [];
  if (m < 2) return rounds;
  const arr = Array.from({ length: m }, (_, i) => i);
  for (let r = 0; r < m - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) pairs.push([arr[i], arr[m - 1 - i]]);
    rounds.push(pairs);
    // Rotate everything except the fixed first element (last → front).
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as number);
    for (let i = 1; i < m; i++) arr[i] = rest[i - 1];
  }
  return rounds;
}

/**
 * Standard single-elimination seed ordering for a bracket of size `B`
 * (power of two): returns the seed number occupying each slot, so seed 1 and
 * seed 2 can only meet in the final, seed 1 vs seed B in round one, etc.
 */
export function seedSlots(B: number): number[] {
  let arr = [1, 2];
  while (arr.length < B) {
    const sum = arr.length * 2 + 1;
    const next: number[] = [];
    for (const s of arr) {
      next.push(s);
      next.push(sum - s);
    }
    arr = next;
  }
  return arr;
}

/** Construct a pending Match with sensible defaults. */
export function mkMatch(
  round: number,
  index: number,
  sideA: Side,
  sideB: Side,
  extra: Partial<Match> = {},
): Match {
  return {
    id: extra.id ?? `r${round}m${index}`,
    round,
    index,
    sideA,
    sideB,
    status: "pending",
    ...extra,
  };
}

/** Deterministic Fisher–Yates over entrant ids for a given seed. */
export function seededOrder(ids: readonly string[], seed: number): string[] {
  const out = ids.slice();
  const rng = makeRng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
