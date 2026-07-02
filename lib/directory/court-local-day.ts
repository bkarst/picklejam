/**
 * court-local-day.ts — the court's LOCAL calendar day as `yyyymmdd` (PRD §6.2).
 *
 * Check-ins bucket by the COURT's local day ("who's here today"), not the
 * viewer's or UTC's. We approximate the court's timezone purely from longitude:
 * every 15° ≈ 1 hour of offset from UTC (`offsetHours = round(lng / 15)`), shift
 * `now` by that offset, then format the UTC parts of the shifted instant.
 *
 * This is a deliberately coarse stand-in: it ignores DST and political timezone
 * boundaries, so a check-in near midnight at a court close to a zone edge can land
 * in the adjacent day. A real IANA `timezone` field on the court would refine
 * this; until then longitude is a good-enough day bucket for the daily aggregate.
 */

import type { CourtItem } from "@/lib/db/types";

/** The court-local day, `yyyymmdd`, approximated from the court's longitude. */
export function courtLocalDay(court: Pick<CourtItem, "lng">, now: number = Date.now()): string {
  const offsetHours = Math.round((court.lng ?? 0) / 15);
  const local = new Date(now + offsetHours * 3600e3);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const d = local.getUTCDate();
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

/** Current epoch ms. A tiny wrapper so server components can read request-time
 *  without a direct `Date.now()` in render (the react purity lint flags that). */
export function nowMs(): number {
  return Date.now();
}
