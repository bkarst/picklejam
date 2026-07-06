/**
 * time.ts — user-local calendars for the gamification layer (Gamification PRD §G13.0).
 *
 * The platform stores no user timezone (check-ins bucket by COURT-local day); but
 * streaks, daily caps, quest weeks, and the digest need a USER-local calendar. This
 * module maps a timestamp + resolved IANA zone → a `yyyymmdd` day, an ISO week
 * (`YYYY-Www`), and a `yyyymm` month, plus pure week arithmetic used by the streak
 * state machine (G8.2) and quest selection (G9.1).
 *
 * ISO weeks are represented canonically by their Monday at UTC midnight, so week
 * arithmetic is exact 7-day math (no DST drift): the wall-clock calendar date is
 * extracted in-zone first (via `Intl`, DST-correct), then week math is pure.
 */

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Resolve the user's tz (G13.0): explicit profile `tz` → home-city centroid tz → UTC. */
export function resolveUserTz(profileTz?: string | null, homeCityTz?: string | null): string {
  return profileTz || homeCityTz || "UTC";
}

/** The in-zone wall-clock calendar date `{ y, m, d }` for a timestamp. */
function localYMD(tz: string, now: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const at = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { y: at("year"), m: at("month"), d: at("day") };
}

/** The user-local day as `yyyymmdd` (the daily-cap + check-in-day window). */
export function userLocalDay(tz: string, now: number): string {
  const { y, m, d } = localYMD(tz, now);
  return `${y}${pad2(m)}${pad2(d)}`;
}

/** The user-local month as `yyyymm` (the monthEarn / personal-stats window). */
export function userLocalMonth(tz: string, now: number): string {
  const { y, m } = localYMD(tz, now);
  return `${y}${pad2(m)}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Full month name for a `yyyymm` (e.g. `202606` → "June"). Locale-free (avoids TZ drift). */
export function monthName(yyyymm: string): string {
  return MONTH_NAMES[Number(yyyymm.slice(4, 6)) - 1] ?? "";
}

/** Short month + year for a `yyyymm` (e.g. `202603` → "Mar 2026"). */
export function monthYearLabel(yyyymm: string): string {
  const name = monthName(yyyymm);
  return name ? `${name.slice(0, 3)} ${yyyymm.slice(0, 4)}` : yyyymm;
}

// ── ISO week core ─────────────────────────────────────────────────────────

/** ISO-8601 week-numbering `{ isoYear, week }` for a calendar Y/M/D. */
function isoWeekParts(y: number, m: number, d: number): { isoYear: number; week: number } {
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // the Thursday of this week
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const ftDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / WEEK_MS);
  return { isoYear, week };
}

/** Format an ISO week id, e.g. `2026-W07`. */
export function weekId(isoYear: number, week: number): string {
  return `${isoYear}-W${pad2(week)}`;
}

/** The ISO week id (`YYYY-Www`) for a timestamp in the user's zone. */
export function isoWeekOf(tz: string, now: number): string {
  const { y, m, d } = localYMD(tz, now);
  const { isoYear, week } = isoWeekParts(y, m, d);
  return weekId(isoYear, week);
}

/** Parse a `YYYY-Www` id back to its parts. */
export function parseWeek(id: string): { isoYear: number; week: number } {
  const [yr, wk] = id.split("-W");
  return { isoYear: Number(yr), week: Number(wk) };
}

/** The Monday (UTC midnight) that canonically represents an ISO week — the arithmetic anchor. */
export function mondayOfWeek(id: string): number {
  const { isoYear, week } = parseWeek(id);
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = Date.UTC(isoYear, 0, 4 - jan4DayNum);
  return week1Monday + (week - 1) * WEEK_MS;
}

/** Reformat a Monday epoch back to its ISO week id (round-trips `mondayOfWeek`). */
function weekIdOfMonday(mondayMs: number): string {
  const dt = new Date(mondayMs);
  const { isoYear, week } = isoWeekParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  return weekId(isoYear, week);
}

/** The ISO week `n` weeks after `id` (negative = before). */
export function addWeeks(id: string, n: number): string {
  return weekIdOfMonday(mondayOfWeek(id) + n * WEEK_MS);
}

export const prevWeek = (id: string): string => addWeeks(id, -1);
export const nextWeek = (id: string): string => addWeeks(id, 1);

/** Signed week distance `a → b` (b − a) in whole weeks. */
export function weeksBetween(a: string, b: string): number {
  return Math.round((mondayOfWeek(b) - mondayOfWeek(a)) / WEEK_MS);
}

/** Ordering comparator for ISO week ids (−1 / 0 / +1). */
export function compareWeeks(a: string, b: string): number {
  const d = mondayOfWeek(a) - mondayOfWeek(b);
  return d < 0 ? -1 : d > 0 ? 1 : 0;
}

/** Weeks strictly between `a` and `b` (exclusive both ends), ascending; `[]` if adjacent/reversed. */
export function weeksStrictlyBetween(a: string, b: string): string[] {
  const out: string[] = [];
  const span = weeksBetween(a, b);
  for (let i = 1; i < span; i++) out.push(addWeeks(a, i));
  return out;
}
