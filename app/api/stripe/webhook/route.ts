/**
 * POST /api/stripe/webhook — the Stripe money spine's inbound webhook (PRD §10,
 * §9.5 pattern 23).
 *
 * The signature is verified against the RAW request body (Stripe signs the exact
 * bytes) — so we read `req.text()`, never `req.json()`, and never a parsed/
 * re-serialized body. Flow:
 *   1. verifyWebhook(rawBody, "stripe-signature", secret)  → 400 on a bad signature
 *   2. recordStripeEventOnce(evt.id, evt.type)             → duplicate ⇒ 200, skip
 *   3. route the event:
 *      • checkout.session.completed / payment_intent.succeeded → REG paid + Payment
 *      • charge.refunded → REG refunded + Payment reconciled
 * We ALWAYS return 200 for a handled or duplicate event (so Stripe stops retrying)
 * and 400 ONLY for a bad signature. Fulfilment is idempotent (pattern 23 dedupe +
 * the REG `paid` guard) so a replay never double-counts or double-charges (§14.5).
 */

import type { NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { recordStripeEventOnce } from "@/lib/data/payments";
import { stripeEnv } from "@/lib/env";
import {
  confirmRegistrationPayment,
  markRegistrationRefunded,
} from "@/lib/data/tournaments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // HMAC signature verification needs Node crypto.

const PAID_EVENTS = new Set(["checkout.session.completed", "payment_intent.succeeded"]);

type Obj = Record<string, unknown>;

/** Read the correlation metadata Stripe echoes back on the object. */
function metaOf(object: Obj): Record<string, string> {
  const m = object.metadata;
  return m && typeof m === "object" ? (m as Record<string, string>) : {};
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export async function POST(req: NextRequest): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  const secret = stripeEnv.webhookSecret;
  const rawBody = await req.text();

  if (!sig || !secret) {
    return Response.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  // 1. Verify the signature against the RAW body (bad signature ⇒ 400).
  let evt;
  try {
    evt = await verifyWebhook(rawBody, sig, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // 2. Idempotency (pattern 23): a duplicate delivery is acked without re-processing.
  const firstTime = await recordStripeEventOnce(evt.id, evt.type);
  if (!firstTime) return Response.json({ received: true, duplicate: true });

  // 3. Route the event. Unknown/uncorrelatable events are simply acked.
  try {
    const object = (evt.data?.object ?? {}) as Obj;
    const meta = metaOf(object);

    if (PAID_EVENTS.has(evt.type)) {
      if (meta.kind === "tournament" && meta.tid && meta.did && meta.uid) {
        await confirmRegistrationPayment({
          tid: meta.tid,
          did: meta.did,
          uid: meta.uid,
          paymentIntentId: str(object.payment_intent) ?? str(object.id),
          amountTotal: num(object.amount_total) ?? num(object.amount),
          currency: str(object.currency),
        });
      }
    } else if (evt.type === "charge.refunded") {
      if (meta.kind === "tournament" && meta.tid && meta.did && meta.uid) {
        await markRegistrationRefunded({
          tid: meta.tid,
          did: meta.did,
          uid: meta.uid,
          amountRefunded: num(object.amount_refunded),
          currency: str(object.currency),
        });
      }
    }
  } catch (err) {
    // A processing error must NOT wedge the queue with endless retries once the
    // event is de-duped; log and ack. (Reconcile sweeps heal any gap, §14.6.)
    console.error("[stripe:webhook] handler error (acked):", err);
  }

  return Response.json({ received: true });
}
