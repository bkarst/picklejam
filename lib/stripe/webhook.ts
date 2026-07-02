/**
 * webhook.ts — Stripe webhook signature verification + test signing (PRD §10, §14.5).
 *
 * Verification is ALWAYS real: we call the Stripe SDK's `constructEvent`, which is
 * a pure HMAC-SHA256 check with a replay-tolerance window — it runs entirely
 * OFFLINE (no network, no API key), so the signature path exercised by tests /
 * CI / E2E is the exact code that runs in production. Signing test fixtures uses
 * the SDK's matching `generateTestHeaderString`, so a fixture signed here verifies
 * here — and a tampered body or wrong secret is rejected.
 *
 * The signing secret comes from `STRIPE_WEBHOOK_SECRET`, defaulting to
 * `whsec_test_pickleloko` when unset so local/CI/E2E can round-trip signed
 * fixtures without any Stripe configuration.
 */

import Stripe from "stripe";
import type { StripeWebhookEvent } from "@/lib/stripe/types";

/** Default webhook secret for local/CI/E2E (real Stripe secrets start `whsec_…`). */
export const DEFAULT_WEBHOOK_SECRET = "whsec_test_pickleloko";

/** The active signing secret: `STRIPE_WEBHOOK_SECRET`, else the local default. */
export function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET;
}

/**
 * Verify a raw webhook body against its `Stripe-Signature` header and return the
 * typed event. Throws `Stripe.errors.StripeSignatureVerificationError` on a bad
 * signature, a tampered payload, or a secret mismatch (real HMAC, offline).
 *
 * @param payload   the RAW request body (string/Buffer) — never a re-serialized object
 * @param signature the `Stripe-Signature` request header
 * @param secret    signing secret (defaults to {@link webhookSecret})
 */
export function verifyWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string = webhookSecret(),
): StripeWebhookEvent {
  const event = Stripe.webhooks.constructEvent(payload, signature, secret);
  return {
    id: event.id,
    type: event.type,
    data: { object: event.data.object as unknown as Record<string, unknown> },
    created: event.created,
  };
}

/**
 * Sign a raw payload with the SDK's test-header generator (matches `constructEvent`).
 * Use in tests/fixtures to produce a valid `Stripe-Signature` for `payload`.
 */
export function signTestPayload(payload: string, secret: string = webhookSecret()): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

/** Monotonic fixture-id counter (deterministic — never `Math.random`). */
let evtSeq = 0;

/**
 * Build a Stripe-event-shaped fixture for `type` wrapping `object`. Returns a plain
 * object; `JSON.stringify` it to get the payload to sign with {@link signTestPayload}
 * and verify with {@link verifyWebhook}. Ids are stable/monotonic per process.
 */
export function buildEvent(
  type: string,
  object: Record<string, unknown>,
  overrides: Partial<StripeWebhookEvent> & { id?: string } = {},
): StripeWebhookEvent & { object: "event"; livemode: boolean } {
  evtSeq += 1;
  return {
    id: overrides.id ?? `evt_fake_${evtSeq}`,
    object: "event",
    type,
    data: { object },
    created: overrides.created ?? Math.floor(Date.UTC(2026, 0, 1) / 1000),
    livemode: false,
  };
}
