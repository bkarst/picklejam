/**
 * events.ts — the canonical analytics event taxonomy (PRD §2.1).
 *
 * Every event is tagged with `page_template` + `source` (on-ramp attribution).
 * ⚙ events are emitted SERVER-SIDE (route handlers / Stripe webhook / Streams)
 * via `lib/posthog-server.ts` so adblock/drop-off can't undercount revenue+play;
 * the rest are client intent/view events captured through `lib/analytics/client.ts`.
 */

/** Client-captured intent/view events. */
export const CLIENT_EVENTS = [
  "page_view",
  "search_performed",
  "geo_snapshot_shown",
  "signup_completed",
  "rating_connected",
  "first_play_action",
  "review_submitted",
  "court_followed",
  "round_robin_created", // carries rrCreatorToken (§2.1 N2)
  "round_robin_scored",
  "upgrade_clicked", // carries source + rrCreatorToken
  "checkout_started",
] as const;

/** Server-emitted (⚙) confirmed revenue/play events. */
export const SERVER_EVENTS = [
  "court_checkin",
  "rsvp_set",
  "outing_attended",
  "match_played",
  "payment_succeeded",
  "registration_confirmed",
  "connect_onboarding_completed",
  "refund_issued",
] as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export type AnalyticsEvent = ClientEvent | ServerEvent;

/** Properties attached to (almost) every event for attribution (§2.1). */
export interface BaseEventProps {
  page_template?: string;
  source?: string;
  /** Anonymous-organizer attribution token (§2.1 N2). */
  rrCreatorToken?: string;
  [key: string]: unknown;
}
