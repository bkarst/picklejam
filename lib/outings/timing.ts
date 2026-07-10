/**
 * timing.ts — the event check-in window policy (§6.2/§6.7). Pure + client-safe
 * (no server imports): the SAME numbers gate the outing page's "I'm here"
 * affordance AND the check-in route's enforcement, so the button can never
 * promise what the API refuses.
 */

/** The check-in window opens this long before the event starts. */
export const EVENT_CHECKIN_OPENS_BEFORE_MS = 2 * 60 * 60 * 1000;
/** Without an end time, the window closes this long after start. */
export const EVENT_CHECKIN_CLOSES_AFTER_MS = 6 * 60 * 60 * 1000;
/** With an end time, stragglers may still check in this long past it. */
export const EVENT_CHECKIN_END_GRACE_MS = 60 * 60 * 1000;

/** The window's bounds in epoch ms (NaN when the timestamps are unparseable). */
export function eventCheckinWindow(
  startTs: string,
  endTs?: string,
): { opensAt: number; closesAt: number } {
  const start = Date.parse(startTs);
  const end = endTs ? Date.parse(endTs) : NaN;
  return {
    opensAt: start - EVENT_CHECKIN_OPENS_BEFORE_MS,
    closesAt: Number.isNaN(end)
      ? start + EVENT_CHECKIN_CLOSES_AFTER_MS
      : end + EVENT_CHECKIN_END_GRACE_MS,
  };
}

/** Whether `now` falls inside the check-in window (closed on bad timestamps). */
export function isEventCheckinOpen(
  startTs: string,
  endTs: string | undefined,
  now: number,
): boolean {
  const { opensAt, closesAt } = eventCheckinWindow(startTs, endTs);
  if (Number.isNaN(opensAt) || Number.isNaN(closesAt)) return false;
  return now >= opensAt && now <= closesAt;
}
