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
 * We return 200 for a handled or duplicate event (so Stripe stops retrying), 400 for
 * a bad signature, and 500 if fulfilment throws — rolling back the dedupe marker so
 * Stripe re-delivers (we must not ack a payment we failed to fulfil). Fulfilment is
 * idempotent (pattern 23 dedupe + conditional `paid` flip) so neither a replay nor a
 * post-failure retry double-counts or double-charges (§14.5).
 */

import type { NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/stripe";
import { recordStripeEventOnce, releaseStripeEventRecord } from "@/lib/data/payments";
import { stripeEnv } from "@/lib/env";
import {
  confirmRegistrationPayment,
  markRegistrationRefunded,
} from "@/lib/data/tournaments";
import { confirmLeaguePayment, markLeagueRegRefunded } from "@/lib/data/leagues";
import { confirmLadderPayment, markLadderRefunded } from "@/lib/data/ladders";

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

    const paymentIntentId = str(object.payment_intent) ?? str(object.id);
    const amountTotal = num(object.amount_total) ?? num(object.amount);
    const currency = str(object.currency);

    if (PAID_EVENTS.has(evt.type)) {
      if (meta.kind === "tournament" && meta.tid && meta.did && meta.uid) {
        await confirmRegistrationPayment({ tid: meta.tid, did: meta.did, uid: meta.uid, paymentIntentId, amountTotal, currency });
      } else if (meta.kind === "league" && meta.lid && meta.did && meta.uid) {
        await confirmLeaguePayment({ lid: meta.lid, did: meta.did, uid: meta.uid, paymentIntentId, amountTotal, currency });
      } else if (meta.kind === "ladder" && meta.lid && meta.uid) {
        await confirmLadderPayment({ lid: meta.lid, uid: meta.uid, paymentIntentId, amountTotal, currency });
      }
    } else if (evt.type === "charge.refunded") {
      const amountRefunded = num(object.amount_refunded);
      if (meta.kind === "tournament" && meta.tid && meta.did && meta.uid) {
        await markRegistrationRefunded({ tid: meta.tid, did: meta.did, uid: meta.uid, amountRefunded, currency });
      } else if (meta.kind === "league" && meta.lid && meta.did && meta.uid) {
        await markLeagueRegRefunded({ lid: meta.lid, did: meta.did, uid: meta.uid, amountRefunded, currency });
      } else if (meta.kind === "ladder" && meta.lid && meta.uid) {
        await markLadderRefunded({ lid: meta.lid, uid: meta.uid, amountRefunded, currency, paymentIntentId });
      }
    }
  } catch (err) {
    // Fulfilment failed (e.g. a transient DB error). Do NOT silently ack — the
    // customer paid but their entry would never be confirmed. Roll back the dedupe
    // marker and return 500 so Stripe re-delivers; fulfilment is idempotent
    // (conditional writes + the `paid` guard), so the retry is safe.
    console.error("[stripe:webhook] handler error — requesting retry:", err);
    await releaseStripeEventRecord(evt.id).catch((delErr) => {
      console.error("[stripe:webhook] failed to release dedupe marker:", delErr);
    });
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
