/**
 * stripe/types.ts — the payment gateway CONTRACT (PRD §10). This is the seam
 * between our money/ledger code and Stripe, so the whole payment path is testable
 * without a live Stripe account: a REAL gateway (Stripe SDK, `sk_test_…`/`sk_live_…`)
 * is used when `STRIPE_SECRET_KEY` is set, and a deterministic FAKE otherwise
 * (local/CI). Webhook signature verification is ALWAYS real (offline HMAC via the
 * Stripe SDK) so idempotency + signature tests exercise the true code path.
 *
 * Money is always {@link Money} (integer minor units) — never a float (§14.5).
 */

import type { Money } from "@/lib/money";

/** Stripe Connect (Express) onboarding state for an organizer. */
export type ConnectStatus = "none" | "pending" | "complete" | "restricted";

export interface ConnectAccount {
  accountId: string; // acct_…
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface CheckoutLineItem {
  name: string;
  /** Unit price in minor units. */
  unitAmount: Money;
  quantity: number;
}

/** A destination-charge Checkout: funds go to the organizer's connected account,
 *  the platform keeps `applicationFee`. `captureLater` authorizes without capturing
 *  (deferred-capture / waitlist holds, §10). */
export interface CheckoutInput {
  connectedAccountId: string;
  lineItems: CheckoutLineItem[];
  applicationFee: Money;
  currency: string;
  /** Correlation keys echoed back on the webhook (tournamentId/divisionId/regKey/uid). */
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  captureLater?: boolean;
  clientReferenceId?: string;
}

export interface CheckoutSession {
  id: string; // cs_…
  url: string; // hosted Checkout URL (fake: a local /pay/sim URL)
  paymentIntentId: string; // pi_…
  status: "open" | "complete" | "expired";
}

/** A refund. On organizer-cancel the platform application fee is refunded too;
 *  on a registrant-initiated cancel it is retained (§10). */
export interface RefundInput {
  paymentIntentId: string;
  /** Partial amount; omit for a full refund. */
  amount?: Money;
  refundApplicationFee: boolean;
  reason?: string;
}

export interface RefundResult {
  id: string; // re_…
  amount: Money;
  status: "succeeded" | "pending" | "failed";
}

/** A verified inbound Stripe event (post signature-check). */
export interface StripeWebhookEvent {
  id: string; // evt_…
  type: string; // e.g. "checkout.session.completed"
  data: { object: Record<string, unknown> };
  created: number;
}

/** The gateway seam. Implemented by a real Stripe adapter + a deterministic fake. */
export interface PaymentGateway {
  readonly mode: "real" | "fake";
  createConnectAccount(input: { email?: string; country?: string }): Promise<ConnectAccount>;
  createOnboardingLink(
    accountId: string,
    opts: { refreshUrl: string; returnUrl: string },
  ): Promise<{ url: string }>;
  getConnectAccount(accountId: string): Promise<ConnectAccount>;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  /** Capture a previously authorized (captureLater) PaymentIntent. */
  capturePaymentIntent(paymentIntentId: string): Promise<void>;
  createRefund(input: RefundInput): Promise<RefundResult>;
}

/** REG payment lifecycle (ledger column). */
export type PaymentStatus =
  | "unpaid" //          created, no Checkout yet
  | "pending" //         Checkout open / authorized-not-captured
  | "partnerPending" //  waiting on a partner to accept before charge (§10)
  | "paid" //            captured / succeeded
  | "refunded" //        fully refunded
  | "partiallyRefunded"
  | "failed"
  | "cancelled";
