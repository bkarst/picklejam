/**
 * lib/stripe — the payment gateway seam + Stripe server client (PRD §10, §14.5).
 *
 * `getGateway()` selects the implementation by CONFIGURATION, so the entire money
 * path is testable without a live Stripe account:
 *   • `STRIPE_SECRET_KEY` set   → {@link RealStripeGateway} (Stripe SDK adapter)
 *   • otherwise (local/CI/E2E)  → {@link FakeGateway} (deterministic, offline)
 *
 * The fake is a cached per-process singleton so a test (and the data layer under
 * test) share the SAME instance — e.g. a Connect account created via the data
 * layer can be graduated with `markComplete`, and processed refunds are
 * introspectable. Signature verification is ALWAYS real (offline HMAC) — see
 * ./webhook. Re-exports the webhook helpers so callers import from one place.
 *
 * NOTE: like lib/db/*, this intentionally omits `import "server-only"` so the
 * payment DATA layer (lib/data/payments, lib/data/connect) stays usable from Node
 * CLI scripts. Only server code / route handlers ever import it — never a client
 * component.
 */

import Stripe from "stripe";
import { stripeEnv } from "@/lib/env";
import type { PaymentGateway } from "@/lib/stripe/types";
import { RealStripeGateway, FakeGateway } from "@/lib/stripe/gateway";

export { RealStripeGateway, FakeGateway } from "@/lib/stripe/gateway";
export type { FakeRefundRecord } from "@/lib/stripe/gateway";
export {
  verifyWebhook,
  signTestPayload,
  buildEvent,
  webhookSecret,
  DEFAULT_WEBHOOK_SECRET,
} from "@/lib/stripe/webhook";

/*
 * Pin the API version the installed `stripe` package is generated against
 * (stripe@22.3.0 → `ApiVersion` = "2026-06-24.dahlia"). The typed `apiVersion`
 * config only accepts this exact literal, so a future SDK bump surfaces here as a
 * compile error — a deliberate, reviewed change rather than silent version drift.
 */
const STRIPE_API_VERSION = "2026-06-24.dahlia";

let cachedStripe: Stripe | null = null;

/** The server Stripe client (lazily created + cached). Throws if the key is unset. */
export function getStripe(): Stripe {
  if (cachedStripe) return cachedStripe;
  cachedStripe = new Stripe(stripeEnv.secretKey, { apiVersion: STRIPE_API_VERSION });
  return cachedStripe;
}

let cachedGateway: PaymentGateway | null = null;

/**
 * The active payment gateway. Returns a {@link RealStripeGateway} when
 * `STRIPE_SECRET_KEY` is configured, else a cached {@link FakeGateway}. Cached per
 * process so the fake's state is shared between the app and its tests.
 */
export function getGateway(): PaymentGateway {
  if (cachedGateway) return cachedGateway;
  cachedGateway = process.env.STRIPE_SECRET_KEY
    ? new RealStripeGateway(getStripe())
    : new FakeGateway();
  return cachedGateway;
}

/** Test-only: drop the cached gateway/client (e.g. after toggling env vars). */
export function __resetGateway(): void {
  cachedGateway = null;
  cachedStripe = null;
}
