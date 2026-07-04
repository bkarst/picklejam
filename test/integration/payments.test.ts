/**
 * payments.test.ts — the payments FOUNDATION (money spine, PRD §10, §14.5).
 *
 * Exercises the REAL code paths with NO live Stripe account:
 *   • signature verification is real (offline HMAC via the Stripe SDK);
 *   • the gateway is the deterministic FakeGateway (no `STRIPE_SECRET_KEY` set).
 *
 * Webhook-verification tests are pure and always run. The ledger/connect tests
 * need DynamoDB Local and are skipped without `DYNAMODB_ENDPOINT`. Each test uses
 * a fresh keyspace (unique uid / evt id) so the suite is parallel-safe + re-runnable.
 */

// Emulate transactions/streams like the rest of the suite (harmless if unused here).
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";
process.env.STREAMS_INLINE = "1";
// Ensure the fake gateway is selected (real gateway requires a secret key).
delete process.env.STRIPE_SECRET_KEY;

import { describe, it, expect } from "vitest";
import { verifyWebhook, signTestPayload, buildEvent, getGateway } from "@/lib/stripe";
import { FakeGateway } from "@/lib/stripe/gateway";
import {
  recordStripeEventOnce,
  writePayment,
  getMyPayments,
  refundPayment,
} from "@/lib/data/payments";
import {
  getOrCreateConnectAccount,
  getConnectAccount,
  markConnectComplete,
  refreshConnectStatus,
} from "@/lib/data/connect";
import type { StoredMoney } from "@/lib/db/types";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;
const usd = (amount: number): StoredMoney => ({ amount, currency: "usd" });
const uniq = (p: string) => `${p}-${Date.now()}-${Math.floor(performance.now() * 1000)}`;

// ── signature verification (pure, always runs) ────────────────────────────────

describe("verifyWebhook — real offline HMAC (Stripe SDK)", () => {
  it("accepts a body signed by signTestPayload and returns the typed event", () => {
    const evt = buildEvent("checkout.session.completed", {
      id: "cs_test_123",
      payment_intent: "pi_test_123",
      metadata: { tid: "t1", uid: "u1" },
    });
    const payload = JSON.stringify(evt);
    const signature = signTestPayload(payload);

    const verified = verifyWebhook(payload, signature);
    expect(verified.id).toBe(evt.id);
    expect(verified.type).toBe("checkout.session.completed");
    expect(verified.created).toBe(evt.created);
    expect((verified.data.object as { id: string }).id).toBe("cs_test_123");
    expect((verified.data.object as { metadata: Record<string, string> }).metadata).toEqual({
      tid: "t1",
      uid: "u1",
    });
  });

  it("rejects a tampered / badly-signed body", () => {
    const payload = JSON.stringify(buildEvent("payment_intent.succeeded", { id: "pi_x" }));
    // Garbage signature header.
    expect(() => verifyWebhook(payload, "t=1,v1=deadbeef")).toThrow();
    // Valid signature but for a DIFFERENT payload → mismatch, rejected.
    const sigForOther = signTestPayload(JSON.stringify({ id: "evt_other" }));
    expect(() => verifyWebhook(payload, sigForOther)).toThrow();
  });

  it("rejects a body signed with the wrong secret", () => {
    const payload = JSON.stringify(buildEvent("charge.refunded", { id: "ch_x" }));
    const sigWrongSecret = signTestPayload(payload, "whsec_a_different_secret");
    expect(() => verifyWebhook(payload, sigWrongSecret)).toThrow();
    // Signed with the SAME (default) secret verifies fine.
    expect(() => verifyWebhook(payload, signTestPayload(payload))).not.toThrow();
  });
});

// ── ledger + connect (DynamoDB Local) ─────────────────────────────────────────

d("payments ledger + connect (DynamoDB Local)", () => {
  it("recordStripeEventOnce dedupes: first claim true, replay false", async () => {
    const evtId = uniq("evt");
    expect(await recordStripeEventOnce(evtId, "checkout.session.completed")).toBe(true);
    // Replays of the same event id are skipped (idempotency, pattern 23).
    expect(await recordStripeEventOnce(evtId, "checkout.session.completed")).toBe(false);
    expect(await recordStripeEventOnce(evtId, "checkout.session.completed")).toBe(false);
    // A different id is claimable.
    expect(await recordStripeEventOnce(uniq("evt"), "payment_intent.succeeded")).toBe(true);
  });

  it("writePayment persists a receipt; getMyPayments returns them newest-first", async () => {
    const uid = uniq("payer");
    const p1 = await writePayment({
      uid,
      kind: "tournament",
      refId: "tid-1",
      divisionId: "div-1",
      amount: usd(2000),
      applicationFee: usd(88),
      paymentIntentId: "pi_1",
      ts: "2026-06-01T00:00:00.000Z",
    });
    const p2 = await writePayment({
      uid,
      kind: "tournament",
      refId: "tid-1",
      divisionId: "div-2",
      amount: usd(3500),
      applicationFee: usd(131),
      paymentIntentId: "pi_2",
      ts: "2026-06-02T00:00:00.000Z",
    });
    expect(p1.status).toBe("paid");
    expect(p2.amount).toEqual(usd(3500));

    const mine = await getMyPayments(uid);
    expect(mine).toHaveLength(2);
    // Newest first (descending by PAYMENT#<ts>).
    expect(mine.map((p) => p.paymentIntentId)).toEqual(["pi_2", "pi_1"]);
    expect(mine[1].applicationFee).toEqual(usd(88));
    expect(mine[1].divisionId).toBe("div-1");
  });

  it("L7: two receipts in the SAME millisecond don't overwrite (unique keys)", async () => {
    const uid = uniq("payer");
    const now = 1_700_000_000_000; // an identical instant for both fulfilments
    const a = await writePayment({ uid, kind: "tournament", refId: "t-a", amount: usd(1000), paymentIntentId: "pi_a", now });
    const b = await writePayment({ uid, kind: "tournament", refId: "t-b", amount: usd(2000), paymentIntentId: "pi_b", now });

    // Same millisecond, but DISTINCT sort keys (pre-fix: both `PAYMENT#<iso>` → b clobbered a).
    expect(a.sk).not.toBe(b.sk);
    const mine = await getMyPayments(uid);
    expect(mine).toHaveLength(2); // pre-fix: 1
    expect(mine.map((p) => p.paymentIntentId).sort()).toEqual(["pi_a", "pi_b"]);
  });

  it("refundPayment (full) refunds the whole charge + platform fee; ledger → refunded", async () => {
    const uid = uniq("payer");
    const ts = "2026-06-03T00:00:00.000Z";
    await writePayment({
      uid,
      kind: "tournament",
      refId: "tid-2",
      amount: usd(2000),
      applicationFee: usd(88),
      paymentIntentId: "pi_full",
      ts,
    });

    // Organizer-cancel ⇒ refund the application fee too.
    const { payment, refund } = await refundPayment({ uid, ts, refundApplicationFee: true });
    expect(refund.status).toBe("succeeded");
    expect(refund.amount).toEqual(usd(2000)); // full remaining balance
    expect(payment.status).toBe("refunded");
    expect(payment.refundedAmount).toEqual(usd(2000));

    // The fee-refund flag flowed through to the gateway.
    const fake = getGateway() as FakeGateway;
    const rec = fake.refunds.find((r) => r.id === refund.id);
    expect(rec?.paymentIntentId).toBe("pi_full");
    expect(rec?.refundApplicationFee).toBe(true);

    // Persisted row reflects the refund too.
    const [persisted] = await getMyPayments(uid);
    expect(persisted.status).toBe("refunded");
    expect(persisted.refundedAmount).toEqual(usd(2000));
  });

  it("refundPayment (partial, fee retained) accumulates to a full refund", async () => {
    const uid = uniq("payer");
    const ts = "2026-06-04T00:00:00.000Z";
    await writePayment({
      uid,
      kind: "tournament",
      refId: "tid-3",
      amount: usd(5000),
      applicationFee: usd(175),
      paymentIntentId: "pi_partial",
      ts,
    });

    // Registrant-initiated partial ⇒ retain the platform fee.
    const first = await refundPayment({ uid, ts, amount: usd(2000), refundApplicationFee: false });
    expect(first.refund.amount).toEqual(usd(2000));
    expect(first.payment.status).toBe("partiallyRefunded");
    expect(first.payment.refundedAmount).toEqual(usd(2000));

    const fake = getGateway() as FakeGateway;
    expect(fake.refunds.find((r) => r.id === first.refund.id)?.refundApplicationFee).toBe(false);

    // A second partial that covers the rest tips it to fully refunded.
    const second = await refundPayment({ uid, ts, amount: usd(3000), refundApplicationFee: false });
    expect(second.payment.status).toBe("refunded");
    expect(second.payment.refundedAmount).toEqual(usd(5000));

    // Over-refunding beyond the charge is rejected (exact-money guard).
    await expect(
      refundPayment({ uid, ts, amount: usd(1), refundApplicationFee: false }),
    ).rejects.toThrow();
  });

  it("connect: create → (pending) → markComplete → status complete", async () => {
    const uid = uniq("organizer");

    const created = await getOrCreateConnectAccount(uid, "organizer@example.com");
    expect(created.accountId).toMatch(/^acct_fake_/);
    expect(created.status).toBe("pending");
    expect(created.chargesEnabled).toBe(false);

    // Idempotent: a second call returns the SAME account (no second Stripe account).
    const again = await getOrCreateConnectAccount(uid, "organizer@example.com");
    expect(again.accountId).toBe(created.accountId);

    // Before onboarding, a refresh still reports pending.
    const pending = await refreshConnectStatus(uid);
    expect(pending?.status).toBe("pending");

    // Graduate the account (test helper) and re-read the persisted row.
    const completed = await markConnectComplete(uid);
    expect(completed?.status).toBe("complete");
    expect(completed?.chargesEnabled).toBe(true);
    expect(completed?.payoutsEnabled).toBe(true);

    const persisted = await getConnectAccount(uid);
    expect(persisted?.status).toBe("complete");
    expect(persisted?.detailsSubmitted).toBe(true);
  });
});
