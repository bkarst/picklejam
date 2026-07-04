/**
 * gateway.ts — the two {@link PaymentGateway} implementations (PRD §10, §14.5).
 *
 * The whole payment path is testable WITHOUT a live Stripe account. `getGateway()`
 * (see ./index) picks:
 *   • {@link RealStripeGateway} — the Stripe SDK adapter, when `STRIPE_SECRET_KEY`
 *     is set. DESTINATION CHARGES: funds go to the organizer's connected account
 *     (`transfer_data.destination`) and the platform keeps its cut as the
 *     `application_fee_amount`; deferred capture (waitlist holds) authorizes with
 *     `capture_method: "manual"`; refunds honour `refund_application_fee`.
 *   • {@link FakeGateway} — a DETERMINISTIC in-process fake (no network, no keys).
 *     Ids are monotonic per process (a module counter — never `Math.random`, which
 *     isn't available in every runtime) so tests are reproducible.
 *
 * Money is always {@link Money} (integer minor units) — never a float (§14.5).
 */

import type Stripe from "stripe";
import type { Money } from "@/lib/money";
import type {
  PaymentGateway,
  ConnectAccount,
  ConnectStatus,
  CheckoutInput,
  CheckoutSession,
  RefundInput,
  RefundResult,
} from "@/lib/stripe/types";

// ── shared helpers ────────────────────────────────────────────────────────────

/** Map Stripe account flags → our coarse {@link ConnectStatus}. */
function connectStatusOf(a: {
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  requirements?: { disabled_reason?: string | null } | null;
}): ConnectStatus {
  if (a.charges_enabled && a.payouts_enabled && a.details_submitted) return "complete";
  if (a.requirements?.disabled_reason) return "restricted";
  return "pending";
}

// ── real Stripe adapter ───────────────────────────────────────────────────────

/**
 * The production gateway: a thin, exact-money adapter over the Stripe SDK. Every
 * charge is a DESTINATION CHARGE on the platform account with the organizer's
 * connected account as `transfer_data.destination`, so the platform collects
 * `application_fee_amount` and Stripe routes the remainder to the organizer.
 */
export class RealStripeGateway implements PaymentGateway {
  readonly mode = "real" as const;

  constructor(private readonly stripe: Stripe) {}

  async createConnectAccount(input: { email?: string; country?: string }): Promise<ConnectAccount> {
    const acct = await this.stripe.accounts.create({
      type: "express",
      country: input.country ?? "US",
      ...(input.email ? { email: input.email } : {}),
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    return {
      accountId: acct.id,
      status: connectStatusOf(acct),
      chargesEnabled: !!acct.charges_enabled,
      payoutsEnabled: !!acct.payouts_enabled,
      detailsSubmitted: !!acct.details_submitted,
    };
  }

  async createOnboardingLink(
    accountId: string,
    opts: { refreshUrl: string; returnUrl: string },
  ): Promise<{ url: string }> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: opts.refreshUrl,
      return_url: opts.returnUrl,
      type: "account_onboarding",
    });
    return { url: link.url };
  }

  async getConnectAccount(accountId: string): Promise<ConnectAccount> {
    const acct = await this.stripe.accounts.retrieve(accountId);
    return {
      accountId: acct.id,
      status: connectStatusOf(acct),
      chargesEnabled: !!acct.charges_enabled,
      payoutsEnabled: !!acct.payouts_enabled,
      detailsSubmitted: !!acct.details_submitted,
    };
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: input.lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: input.currency,
          unit_amount: li.unitAmount.amount,
          product_data: { name: li.name },
        },
      })),
      payment_intent_data: {
        application_fee_amount: input.applicationFee.amount,
        transfer_data: { destination: input.connectedAccountId },
        ...(input.captureLater ? { capture_method: "manual" as const } : {}),
        metadata: input.metadata,
      },
      metadata: input.metadata,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      ...(input.clientReferenceId ? { client_reference_id: input.clientReferenceId } : {}),
    });

    const pi = session.payment_intent;
    const paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? "");
    return {
      id: session.id,
      url: session.url ?? input.successUrl,
      paymentIntentId,
      status: session.status ?? "open",
    };
  }

  async capturePaymentIntent(paymentIntentId: string): Promise<void> {
    await this.stripe.paymentIntents.capture(paymentIntentId);
  }

  async createRefund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.stripe.refunds.create(
      {
        payment_intent: input.paymentIntentId,
        ...(input.amount ? { amount: input.amount.amount } : {}),
        refund_application_fee: input.refundApplicationFee,
        ...(input.reason ? { reason: input.reason as Stripe.RefundCreateParams.Reason } : {}),
      },
      // Idempotency: a retried/duplicated refund with the same key returns the SAME
      // refund object instead of moving money twice (defense against double-clicks).
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    return {
      id: refund.id,
      amount: { amount: refund.amount, currency: refund.currency ?? (input.amount?.currency ?? "usd") },
      status: refund.status === "succeeded" || refund.status === "pending" ? refund.status : "failed",
    };
  }
}

// ── deterministic fake ────────────────────────────────────────────────────────

/** Monotonic, per-process id counter (deterministic — never `Math.random`). */
let seq = 0;
function nextId(): number {
  seq += 1;
  return seq;
}

/** A refund the fake processed (so tests can assert `refundApplicationFee` etc.). */
export interface FakeRefundRecord {
  id: string;
  paymentIntentId: string;
  amount: Money;
  refundApplicationFee: boolean;
  reason?: string;
  idempotencyKey?: string;
}

/**
 * The offline fake. Deterministic ids, no network. It keeps just enough state to
 * be self-consistent across a test: created Connect accounts (so `getConnectAccount`
 * returns the last-known state, and `markComplete` can graduate one to "complete"),
 * and the refunds it has processed (so a test can assert the `refund_application_fee`
 * flag flowed through). All amounts stay integer minor units.
 */
export class FakeGateway implements PaymentGateway {
  readonly mode = "fake" as const;

  private readonly accounts = new Map<string, ConnectAccount>();
  /** Every refund processed this session, in order (test introspection). */
  readonly refunds: FakeRefundRecord[] = [];

  async createConnectAccount(_input: { email?: string; country?: string }): Promise<ConnectAccount> {
    const accountId = `acct_fake_${nextId()}`;
    const account: ConnectAccount = {
      accountId,
      status: "pending",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
    this.accounts.set(accountId, account);
    return account;
  }

  async createOnboardingLink(
    _accountId: string,
    opts: { refreshUrl: string; returnUrl: string },
  ): Promise<{ url: string }> {
    // A real onboarding hop returns to `returnUrl` on success; land there directly.
    return { url: opts.returnUrl };
  }

  async getConnectAccount(accountId: string): Promise<ConnectAccount> {
    const known = this.accounts.get(accountId);
    if (known) return known;
    // Unknown id (e.g. a persisted account from a prior process): report pending.
    return {
      accountId,
      status: "pending",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  /** TEST-ONLY: graduate a fake account to a fully-onboarded "complete" state. */
  markComplete(accountId: string): ConnectAccount {
    const account: ConnectAccount = {
      accountId,
      status: "complete",
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    };
    this.accounts.set(accountId, account);
    return account;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    const n = nextId();
    return {
      id: `cs_fake_${n}`,
      // Redirect straight to success so an E2E flow lands on the success page.
      url: input.successUrl,
      paymentIntentId: `pi_fake_${n}`,
      status: "open",
    };
  }

  async capturePaymentIntent(_paymentIntentId: string): Promise<void> {
    // Deterministic ok — nothing to do.
  }

  async createRefund(input: RefundInput): Promise<RefundResult> {
    // Honor idempotency exactly like real Stripe: a repeat of the same key returns the
    // SAME refund without recording a second one (so a double-click collapses to one).
    if (input.idempotencyKey) {
      const prior = this.refunds.find((r) => r.idempotencyKey === input.idempotencyKey);
      if (prior) return { id: prior.id, amount: prior.amount, status: "succeeded" };
    }
    const id = `re_fake_${nextId()}`;
    // The ledger resolves the exact minor-unit amount (full = remaining) and always
    // passes it in, so the fake can echo it back faithfully.
    const amount: Money = input.amount ?? { amount: 0, currency: "usd" };
    this.refunds.push({
      id,
      paymentIntentId: input.paymentIntentId,
      amount,
      refundApplicationFee: input.refundApplicationFee,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    });
    return { id, amount, status: "succeeded" };
  }
}
