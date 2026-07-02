/**
 * payments.ts — the payment LEDGER data layer (PRD §10, §9.5 #23, §14.5).
 *
 * A PURE ledger: it records durable receipts, dedupes Stripe events, and
 * orchestrates refunds through the gateway ({@link getGateway}). It does NOT know
 * about tournaments/registrations — the tournament layer calls INTO these helpers
 * (writes a REG's `paymentStatus`, reconciles counts) after the ledger has run.
 * MONEY IS EXACT: every amount is integer minor units via {@link Money} — no floats.
 *
 *   • recordStripeEventOnce — idempotency (pattern 23): a create-only STRIPEEVENT#
 *     row with TTL; the FIRST delivery claims it, any replay returns `false`.
 *   • writePayment / getMyPayments — the payer's receipts under `USER#<uid>`.
 *   • refundPayment — gateway refund (fee retained vs refunded) + ledger update.
 */

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getItem, putNew, putItem, updateItem, query } from "@/lib/db/client";
import { paymentKeys } from "@/lib/db/keys";
import { getGateway } from "@/lib/stripe";
import { addMoney, subMoney } from "@/lib/money";
import type { Money } from "@/lib/money";
import type { PaymentItem, StoredMoney, StripeEventItem } from "@/lib/db/types";
import type { PaymentStatus, RefundResult } from "@/lib/stripe/types";

/** How long a processed Stripe event id is remembered before its TTL sweeps it. */
const DEDUPE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Idempotency gate (pattern 23). Claim a Stripe event id for processing with a
 * create-only conditional put of a `STRIPEEVENT#<id>` row (+ TTL).
 * @returns `true` on the FIRST delivery (proceed); `false` if already processed
 *          (a replay/duplicate — skip so nothing is double-charged/fulfilled).
 */
export async function recordStripeEventOnce(
  evtId: string,
  type: string,
  now: () => number = Date.now,
): Promise<boolean> {
  const item: StripeEventItem = {
    ...paymentKeys.stripeEvent(evtId),
    entity: "STRIPEEVENT",
    eventId: evtId,
    type,
    processedAt: new Date(now()).toISOString(),
    ttl: Math.floor(now() / 1000) + DEDUPE_TTL_SECONDS,
  };
  try {
    await putNew(item as unknown as Record<string, unknown>);
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

// ── receipts ──────────────────────────────────────────────────────────────────

/** Fields for a durable payment receipt (SK `PAYMENT#<ts>` under the payer). */
export interface WritePaymentInput {
  uid: string;
  kind: "tournament" | "league";
  refId: string; // tid / lid
  divisionId?: string;
  amount: StoredMoney; // total charged (registrant total)
  applicationFee?: StoredMoney; // platform take
  paymentIntentId: string;
  status?: PaymentStatus; // default "paid"
  receiptUrl?: string;
  /** Explicit sort timestamp (ISO); defaults to `now`. Keeps receipts ordered. */
  ts?: string;
  now?: number;
}

/**
 * Write a durable payment receipt under `USER#<uid>` (SK `PAYMENT#<ts>`, newest
 * last lexicographically). Returns the persisted item.
 */
export async function writePayment(input: WritePaymentInput): Promise<PaymentItem> {
  const iso = input.ts ?? new Date(input.now ?? Date.now()).toISOString();
  const item: PaymentItem = {
    ...paymentKeys.payment(input.uid, iso),
    entity: "PAYMENT",
    uid: input.uid,
    ts: iso,
    kind: input.kind,
    refId: input.refId,
    ...(input.divisionId !== undefined ? { divisionId: input.divisionId } : {}),
    amount: input.amount,
    ...(input.applicationFee !== undefined ? { applicationFee: input.applicationFee } : {}),
    paymentIntentId: input.paymentIntentId,
    status: input.status ?? "paid",
    ...(input.receiptUrl !== undefined ? { receiptUrl: input.receiptUrl } : {}),
    createdAt: iso,
  };
  await putItem(item as unknown as Record<string, unknown>);
  return item;
}

/**
 * The payer's receipts, newest first — one keyed Query on `USER#<uid>` with the
 * `PAYMENT#` sort-key prefix.
 */
export async function getMyPayments(uid: string): Promise<PaymentItem[]> {
  const { items } = await query<PaymentItem>({
    pk: paymentKeys.payment(uid, "").pk,
    skBeginsWith: paymentKeys.paymentPrefix(),
    ascending: false,
  });
  return items;
}

/** Read a single receipt by (uid, ts). */
export async function getPayment(uid: string, ts: string): Promise<PaymentItem | undefined> {
  return getItem<PaymentItem>(paymentKeys.payment(uid, ts));
}

// ── refunds ─────────────────────────────────────────────────────────────────

export interface RefundPaymentInput {
  uid: string;
  ts: string;
  /** Partial amount; omit for a FULL refund (the remaining balance). */
  amount?: Money;
  /** Organizer-cancel ⇒ refund the platform fee too; registrant-cancel ⇒ retain it (§10). */
  refundApplicationFee: boolean;
  reason?: string;
}

export interface RefundPaymentResult {
  payment: PaymentItem;
  refund: RefundResult;
}

/**
 * Refund a payment (full or partial) and update its ledger row. Resolves the exact
 * minor-unit amount (full = the remaining balance after any prior partial refund),
 * calls the gateway with `refund_application_fee` per {@link RefundPaymentInput},
 * then accumulates `refundedAmount` and flips `status` to `refunded` (fully) or
 * `partiallyRefunded`. All arithmetic is exact-money (throws on currency mismatch).
 */
export async function refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
  const payment = await getPayment(input.uid, input.ts);
  if (!payment) throw new Error(`Payment not found: ${input.uid}/${input.ts}`);

  const total: Money = payment.amount;
  const prevRefunded: Money = payment.refundedAmount ?? { amount: 0, currency: total.currency };
  // Full refund = the remaining balance; partial = the requested amount (currency-checked).
  const requested: Money = input.amount ?? subMoney(total, prevRefunded);

  if (requested.amount <= 0) {
    throw new Error("Refund amount must be positive (nothing left to refund)");
  }
  // addMoney throws on a currency mismatch — the exact-money guard.
  const newRefunded = addMoney(prevRefunded, requested);
  if (newRefunded.amount > total.amount) {
    throw new Error(
      `Refund of ${requested.amount} exceeds the ${total.amount - prevRefunded.amount} remaining`,
    );
  }

  const refund = await getGateway().createRefund({
    paymentIntentId: payment.paymentIntentId,
    amount: requested,
    refundApplicationFee: input.refundApplicationFee,
    ...(input.reason ? { reason: input.reason } : {}),
  });

  const status: PaymentStatus = newRefunded.amount >= total.amount ? "refunded" : "partiallyRefunded";
  const refundedStored: StoredMoney = { amount: newRefunded.amount, currency: newRefunded.currency };

  const attrs = await updateItem({
    key: paymentKeys.payment(input.uid, input.ts),
    update: "SET refundedAmount = :ra, #st = :st, updatedAt = :u",
    names: { "#st": "status" },
    values: { ":ra": refundedStored, ":st": status, ":u": new Date().toISOString() },
  });

  const updated = (attrs as unknown as PaymentItem) ?? {
    ...payment,
    refundedAmount: refundedStored,
    status,
  };
  return { payment: updated, refund };
}
