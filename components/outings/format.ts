/**
 * format.ts — date/time formatting for outing UI (§6.7), timezone-aware.
 *
 * Outings carry an ISO `startTs`/`endTs` and an optional IANA `tz` (the court's
 * local zone). These helpers render in that zone so a game reads in local wall
 * time regardless of the viewer's location, with a short zone label (e.g. CDT).
 */

/** "Wed Jun 30" in the outing's timezone. */
export function formatOutingDate(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** "7:00 AM" in the outing's timezone. */
export function formatTime(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** Short timezone label (e.g. "CDT") for a given instant + zone. */
export function tzLabel(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
    ...(tz ? { timeZone: tz } : {}),
  }).formatToParts(d);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/**
 * "7:00–9:00 AM CDT" (or "7:00 AM CDT" with no end) — the outing time range.
 * Collapses a shared AM/PM meridiem onto the end time only, like the mockups.
 */
export function formatTimeRange(startTs: string, endTs?: string, tz?: string): string {
  const start = formatTime(startTs, tz);
  const zone = tzLabel(startTs, tz);
  if (!endTs) return zone ? `${start} ${zone}` : start;
  const end = formatTime(endTs, tz);
  // Drop the start meridiem when it matches the end's (e.g. "7:00 – 9:00 AM").
  const startMer = start.match(/[AP]M$/)?.[0];
  const endMer = end.match(/[AP]M$/)?.[0];
  const startTrimmed = startMer && startMer === endMer ? start.replace(/\s*[AP]M$/, "") : start;
  const range = `${startTrimmed}–${end}`;
  return zone ? `${range} ${zone}` : range;
}

/** Format a skill range like "2.5 – 3.5", "2.5+", or "All levels". */
export function formatSkillRange(min?: number, max?: number): string {
  if (min == null && max == null) return "All levels";
  if (min != null && max != null) return `${min.toFixed(1)} – ${max.toFixed(1)}`;
  if (min != null) return `${min.toFixed(1)}+`;
  return `Up to ${max!.toFixed(1)}`;
}
