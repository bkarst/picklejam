"use client";

/**
 * client.ts — consent-gated client analytics (PRD §2.1).
 *
 * PostHog (product analytics) initializes ONLY after the user grants analytics
 * consent, via a first-party reverse proxy (`/ingest`) so it survives adblock and
 * stays off the CWV critical path. `trackEvent` no-ops until initialized, so call
 * sites never need to guard. Server-side ⚙ events live in `lib/posthog-server.ts`.
 */

import posthog from "posthog-js";
import { publicEnv } from "@/lib/env";
import type { AnalyticsEvent, BaseEventProps } from "./events";

let initialized = false;

/** Initialize PostHog once, after analytics consent is granted. */
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;
  if (!publicEnv.posthogKey) return; // not configured — stay dark
  posthog.init(publicEnv.posthogKey, {
    api_host: "/ingest", // first-party proxy (rewrite → publicEnv.posthogHost)
    ui_host: publicEnv.posthogHost,
    capture_pageview: false, // we emit page_view explicitly with page_template
    persistence: "localStorage+cookie",
    autocapture: false,
  });
  initialized = true;
}

/** Tear down on consent withdrawal. */
export function stopAnalytics(): void {
  if (!initialized) return;
  posthog.opt_out_capturing();
  initialized = false;
}

/** Capture a client intent/view event (no-op until consent-initialized). */
export function trackEvent(event: AnalyticsEvent, props?: BaseEventProps): void {
  if (!initialized) return;
  posthog.capture(event, props);
}
