// NOTE: deliberately NOT `import "server-only"` — this module is pulled in by the
// data layer (lib/data/*), which is reused by CLI seed/backfill scripts run under
// tsx (where `server-only` can't resolve). Mirrors lib/db/* and lib/stripe/* which
// omit the guard for the same reason; it's still never bundled client-side because
// the data layer that imports it is server-only in practice (AWS SDK, no client use).

/**
 * server.ts — fire-and-forget helper for the SERVER-side (⚙) analytics events
 * (PRD §2.1). These "confirmed" events (court_checkin, rsvp_set, match_played,
 * payment_succeeded, registration_confirmed, connect_onboarding_completed,
 * refund_issued) are emitted from the data layer AFTER a write succeeds, so
 * adblock / client drop-off can't undercount revenue + play.
 *
 * {@link trackServerEvent} wraps {@link captureServerEvent} so a capture failure
 * can NEVER throw into — or slow — the user action that emitted it: analytics is
 * strictly best-effort. `distinctId` is the actor's uid where known, otherwise an
 * anonymous marker (e.g. `"anonymous"` or an anonymous round-robin's token).
 */

import { captureServerEvent } from "@/lib/posthog-server";
import type { ServerEvent, BaseEventProps } from "./events";

/** Emit a server-side confirmed event. Best-effort: it never throws. */
export function trackServerEvent(
  distinctId: string,
  event: ServerEvent,
  props?: BaseEventProps,
): void {
  try {
    captureServerEvent(distinctId, event, props);
  } catch (err) {
    // Swallow — a broken analytics capture must not fail the underlying write.
    console.error(`[analytics] server event "${event}" failed (ignored):`, err);
  }
}
