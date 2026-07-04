/**
 * court-local-day.ts — the court's LOCAL calendar day as `yyyymmdd` (PRD §6.2).
 *
 * Check-ins bucket by the COURT's local day ("who's here today"), not the viewer's
 * or UTC's. We resolve the court's REAL IANA timezone — an explicit `tz` override if
 * set, else a lat/lng → zone lookup — and format the calendar day in that zone via
 * `Intl`. Because a real zone (e.g. `America/New_York`) carries DST and political /
 * half-hour offset rules, the day bucket flips at the court's TRUE midnight, so the
 * write side (a check-in) and the read side ("checked in today") always agree.
 *
 * The old approximation (`offsetHours = round(lng / 15)`) ignored DST and zone
 * boundaries, so a check-in near midnight at a court close to a zone edge landed in
 * the adjacent day — the ISR court page then read "0 checked in today" while people
 * were on court (L15). That approximation now survives only as a FALLBACK for when
 * no coordinates are available (e.g. a city-centroid call missing its latitude) or
 * the lookup can't resolve the point.
 */

import tzLookup from "tz-lookup";
import type { CourtItem } from "@/lib/db/types";

/** The geo signal `courtLocalDay` needs: coordinates and/or an explicit IANA `tz`. */
export type CourtLocality = Partial<Pick<CourtItem, "lat" | "lng" | "tz">>;

/** Resolve a court's IANA timezone: an explicit `tz` override, else a lat/lng lookup. */
function resolveCourtTz(loc: CourtLocality): string | undefined {
  if (loc.tz) return loc.tz;
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    try {
      return tzLookup(loc.lat, loc.lng);
    } catch {
      return undefined; // out-of-range coords → fall back to the longitude approximation
    }
  }
  return undefined;
}

/** The court-local day, `yyyymmdd`, in the court's real timezone (fallback: lng-approx). */
export function courtLocalDay(loc: CourtLocality, now: number = Date.now()): string {
  const tz = resolveCourtTz(loc);
  if (tz) {
    // The REAL calendar day for the zone (DST- and boundary-correct). `formatToParts`
    // avoids any locale-ordering surprise; the parts are already zero-padded.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const at = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
    return `${at("year")}${at("month")}${at("day")}`;
  }

  // Fallback: coarse longitude approximation — every 15° ≈ 1 hour of offset from UTC.
  const offsetHours = Math.round((loc.lng ?? 0) / 15);
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
