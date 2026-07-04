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

import { ulid } from "ulid";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getItem, putNew, putItem, updateItem, queryAll, deleteItem } from "@/lib/db/client";
import { trackServerEvent } from "@/lib/analytics/server";
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

/**
 * Release a claimed Stripe event id so a FAILED fulfilment can be retried. The
 * webhook records the event before fulfilling (to serialize concurrent deliveries);
 * if fulfilment then throws, it calls this to drop the marker and returns a non-2xx
 * so Stripe re-delivers. Fulfilment is idempotent (conditional writes) so the retry
 * is safe. Best-effort: a failed delete just means the retry is deduped (no worse
 * than before) — the reconcile sweep still heals the gap.
 */
export async function releaseStripeEventRecord(evtId: string): Promise<void> {
  await deleteItem(paymentKeys.stripeEvent(evtId));
}

// ── receipts ──────────────────────────────────────────────────────────────────

/** Fields for a durable payment receipt (SK `PAYMENT#<ts>` under the payer). */
export interface WritePaymentInput {
  uid: string;
  kind: "tournament" | "league" | "ladder";
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
  const iso = new Date(input.now ?? Date.now()).toISOString();
  // Unique per-payer sort key. `PAYMENT#<iso-ms>` alone COLLIDES when two receipts land for
  // one payer in the same millisecond (concurrent fulfilments) → a plain putItem clobbers the
  // first, silently losing a receipt (revenue + refund target). Disambiguate with a ulid
  // suffix: the iso prefix preserves time ordering, the ulid guarantees uniqueness. `ts` IS the
  // per-uid key discriminator (refunds relocate by the stored `payment.ts`), so an explicit
  // `input.ts` is still honored verbatim for a caller that wants exact control (L7).
  const ts = input.ts ?? `${iso}#${ulid()}`;
  const item: PaymentItem = {
    ...paymentKeys.payment(input.uid, ts),
    entity: "PAYMENT",
    uid: input.uid,
    ts,
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
  // queryAll: a payer's receipts feed dashboard revenue AND refund lookups — a page
  // dropped at 1 MB would undercount revenue and hide a receipt from a refund.
  const items = await queryAll<PaymentItem>({
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

  const status: PaymentStatus = newRefunded.amount >= total.amount ? "refunded" : "partiallyRefunded";
  const refundedStored: StoredMoney = { amount: newRefunded.amount, currency: newRefunded.currency };
  const paymentKey = paymentKeys.payment(input.uid, input.ts);
  const prevAmount = prevRefunded.amount;

  // RESERVE the ledger slot FIRST, with optimistic concurrency on the prior
  // `refundedAmount` (§14.5). Only ONE concurrent refund can advance prev→new; a rival
  // that read the same `prev` fails this condition and is rejected BEFORE it can reach
  // the gateway — so two double-clicked partial refunds can't both hit Stripe and
  // over-refund the customer, and the ledger can never silently last-write-wins.
  try {
    await updateItem({
      key: paymentKey,
      update: "SET refundedAmount = :ra, #st = :st, updatedAt = :u",
      names: { "#st": "status" },
      condition:
        "attribute_exists(pk) AND (attribute_not_exists(refundedAmount) OR refundedAmount.amount = :prev)",
      values: {
        ":ra": refundedStored,
        ":st": status,
        ":u": new Date().toISOString(),
        ":prev": prevAmount,
      },
    });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new Error(
        "Refund conflict: this payment was refunded concurrently — re-read the ledger and retry against the remaining balance",
      );
    }
    throw err;
  }

  // Slot reserved — now move the money. The idempotency key collapses a retried/replayed
  // gateway call for the SAME reservation so it can never refund twice at Stripe.
  let refund: RefundResult;
  try {
    refund = await getGateway().createRefund({
      paymentIntentId: payment.paymentIntentId,
      amount: requested,
      refundApplicationFee: input.refundApplicationFee,
      idempotencyKey: `refund:${payment.paymentIntentId}:${prevAmount}:${requested.amount}`,
      ...(input.reason ? { reason: input.reason } : {}),
    });
  } catch (err) {
    // The gateway refund failed AFTER we reserved the slot. Roll the reservation back
    // (only if it is still our value) so the ledger never claims a refund that never
    // moved money. Best-effort — a failed rollback is logged for manual reconciliation.
    await updateItem({
      key: paymentKey,
      update: payment.refundedAmount
        ? "SET refundedAmount = :prevStored, #st = :prevSt, updatedAt = :u"
        : "SET #st = :prevSt, updatedAt = :u REMOVE refundedAmount",
      names: { "#st": "status" },
      condition: "refundedAmount.amount = :newAmt",
      values: {
        ...(payment.refundedAmount ? { ":prevStored": payment.refundedAmount } : {}),
        ":prevSt": payment.status,
        ":u": new Date().toISOString(),
        ":newAmt": refundedStored.amount,
      },
    }).catch((rbErr) => {
      console.error(
        `[refundPayment] reservation rollback failed for ${input.uid}/${input.ts} — needs manual reconcile:`,
        rbErr,
      );
    });
    throw err;
  }

  const updated: PaymentItem = { ...payment, refundedAmount: refundedStored, status };

  // ⚙ refund_issued (§2.1) — money returned. This is the SINGLE gateway-refund
  // point for every in-app refund (tournament / league / ladder cancels all route
  // through here), so it emits exactly once per refund (no double-count with the
  // charge.refunded webhook reconcilers, which only re-sync the ledger row).
  trackServerEvent(input.uid, "refund_issued", {
    kind: payment.kind,
    refId: payment.refId,
    ...(payment.divisionId !== undefined ? { divisionId: payment.divisionId } : {}),
    amount: requested.amount,
    currency: requested.currency,
    status,
  });

  return { payment: updated, refund };
}
