/**
 * format.ts — pure display helpers for the tournament UI (event-type codes,
 * rating ranges, date ranges, status chips). No React, no I/O — safe to unit test
 * and to import from both server and client components.
 */

import type { Money } from "@/lib/money";
import type { DivisionItem, TourneyStatus } from "@/lib/db/types";

/** The cheapest division price for a "from $X" display, or `undefined`. */
export function priceFrom(divisions: Pick<DivisionItem, "price">[]): Money | undefined {
  if (divisions.length === 0) return undefined;
  const min = divisions.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));
  return { amount: min.price.amount, currency: min.price.currency };
}

/** Short event-type badge, e.g. "MD" / "WD" / "MXD" / "MS" (design 12.2.2). */
export function eventTypeCode(d: Pick<DivisionItem, "playMode" | "gender">): string {
  const suffix = d.playMode === "singles" ? "S" : "D";
  switch (d.gender) {
    case "mens":
      return `M${suffix}`;
    case "womens":
      return `W${suffix}`;
    case "mixed":
      return `MX${suffix}`;
    default:
      return d.playMode === "singles" ? "Singles" : "Doubles";
  }
}

/** Full, spoken event-type label (accessible titles). */
export function eventTypeFull(d: Pick<DivisionItem, "playMode" | "gender">): string {
  const mode = d.playMode === "singles" ? "Singles" : "Doubles";
  switch (d.gender) {
    case "mens":
      return `Men's ${mode}`;
    case "womens":
      return `Women's ${mode}`;
    case "mixed":
      return `Mixed ${mode}`;
    case "open":
      return `Open ${mode}`;
    default:
      return mode;
  }
}

/** A 1-decimal rating like "3.5". */
function fmtRating(v: number): string {
  return v.toFixed(1);
}

/**
 * The division's rating gate for display. Prefers an explicit DUPR range; falls
 * back to the generic skill range; `system` lets the UI badge it (never rely on
 * the number alone for the DUPR gate — show "DUPR").
 */
export function ratingRange(d: Pick<DivisionItem, "duprMin" | "duprMax" | "skillMin" | "skillMax">): {
  text: string;
  system: "DUPR" | "Skill" | null;
} {
  if (typeof d.duprMin === "number" || typeof d.duprMax === "number") {
    const lo = typeof d.duprMin === "number" ? fmtRating(d.duprMin) : "";
    const hi = typeof d.duprMax === "number" ? fmtRating(d.duprMax) : "";
    const text = lo && hi ? `${lo}–${hi}` : lo ? `${lo}+` : `≤ ${hi}`;
    return { text, system: "DUPR" };
  }
  if (typeof d.skillMin === "number" || typeof d.skillMax === "number") {
    const lo = typeof d.skillMin === "number" ? fmtRating(d.skillMin) : "";
    const hi = typeof d.skillMax === "number" ? fmtRating(d.skillMax) : "";
    const text = lo && hi ? `${lo}–${hi}` : lo ? `${lo}+` : `≤ ${hi}`;
    return { text, system: "Skill" };
  }
  return { text: "All levels", system: null };
}

/** Is a rating (DUPR) within the division's gate? Undefined rating ⇒ can't confirm. */
export function ratingWithinGate(
  d: Pick<DivisionItem, "duprMin" | "duprMax">,
  rating: number | undefined,
): boolean {
  if (typeof d.duprMin !== "number" && typeof d.duprMax !== "number") return true;
  if (typeof rating !== "number") return false;
  if (typeof d.duprMin === "number" && rating < d.duprMin) return false;
  if (typeof d.duprMax === "number" && rating > d.duprMax) return false;
  return true;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a `yyyy-mm-dd` into a LOCAL Date (no tz shift). */
function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * A compact date range, e.g. "Jul 18–19, 2026", "Jul 30 – Aug 2, 2026", or a
 * single "Jul 18, 2026". Falls back to the raw string on a parse failure.
 */
export function formatDateRange(start: string, end?: string): string {
  const s = parseYmd(start);
  if (!s) return start;
  const sM = MONTHS[s.getMonth()];
  const sD = s.getDate();
  const sY = s.getFullYear();
  const e = end ? parseYmd(end) : null;
  if (!e || (e.getMonth() === s.getMonth() && e.getDate() === s.getDate() && e.getFullYear() === sY)) {
    return `${sM} ${sD}, ${sY}`;
  }
  const eM = MONTHS[e.getMonth()];
  const eD = e.getDate();
  const eY = e.getFullYear();
  if (sY === eY && s.getMonth() === e.getMonth()) return `${sM} ${sD}–${eD}, ${sY}`;
  if (sY === eY) return `${sM} ${sD} – ${eM} ${eD}, ${sY}`;
  return `${sM} ${sD}, ${sY} – ${eM} ${eD}, ${eY}`;
}

/** Status chip metadata (label + tone class) for a tournament. */
export function statusMeta(status: TourneyStatus): { label: string; tone: string } {
  switch (status) {
    case "published":
      return { label: "Registering", tone: "bg-success/15 text-foreground" };
    case "complete":
      return { label: "Complete", tone: "bg-surface-secondary text-muted" };
    case "cancelled":
      return { label: "Cancelled", tone: "bg-danger/15 text-danger" };
    default:
      return { label: "Draft", tone: "bg-warning/15 text-warning-foreground" };
  }
}
