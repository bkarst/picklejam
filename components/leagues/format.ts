/**
 * format.ts — pure display helpers for the league + ladder UI. No React, no I/O —
 * safe to unit test and to import from both server and client components. Reuses
 * the tournament formatters where the shape is identical (status chips, date
 * ranges, rating ranges) so leagues/ladders read consistently with tournaments.
 */

import type { LeagueDivisionItem, RungItem } from "@/lib/db/types";
import { statusMeta, formatDateRange, ratingRange } from "@/components/tournaments/format";

export { statusMeta, formatDateRange, ratingRange };

/** Human label for a league/ladder play mode. */
export function playModeLabel(mode: "singles" | "doubles" | "team"): string {
  switch (mode) {
    case "singles":
      return "Singles";
    case "team":
      return "Team";
    default:
      return "Doubles";
  }
}

/** "8 weeks" / "1 week". */
export function seasonLabel(weeks: number): string {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

/** Spots remaining in a division/flight, or `null` when uncapped. */
export function spotsRemaining(d: Pick<LeagueDivisionItem, "capacity" | "registeredCount">): number | null {
  if (typeof d.capacity !== "number" || d.capacity <= 0) return null;
  return Math.max(0, d.capacity - d.registeredCount);
}

/** The cheapest division price for a "from $X" display, or `undefined`. */
export function leaguePriceFrom(divisions: Pick<LeagueDivisionItem, "price">[]) {
  if (divisions.length === 0) return undefined;
  const min = divisions.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));
  return { amount: min.price.amount, currency: min.price.currency };
}

/**
 * A ladder rung's recent movement, derived from its win/loss record. A rung with
 * no history is "even". Callers render an arrow AND the numeric delta (never color
 * alone) with an accessible label.
 */
export function ladderMovement(rung: Pick<RungItem, "wins" | "losses">): {
  dir: "up" | "down" | "even";
  delta: number;
  label: string;
} {
  const net = (rung.wins ?? 0) - (rung.losses ?? 0);
  if (net > 0) return { dir: "up", delta: net, label: `Up ${net}` };
  if (net < 0) return { dir: "down", delta: Math.abs(net), label: `Down ${Math.abs(net)}` };
  return { dir: "even", delta: 0, label: "No change" };
}

/** A 1-decimal rating like "1560" (ladders) or "3.5" (skill) — pass-through format. */
export function fmtRating(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
