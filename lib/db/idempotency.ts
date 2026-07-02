/**
 * idempotency.ts — Stripe webhook dedupe (PRD §9.5 #23, §10).
 *
 * Every webhook write is guarded by a conditional put of a `STRIPEEVENT#<id>`
 * item: the FIRST delivery of an event claims it and proceeds; any REPLAY finds
 * the item present and is skipped → no double-charge / double-fulfilment. The
 * dedupe item carries a TTL so the table doesn't grow unbounded.
 */

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { putNew } from "./client";
import { paymentKeys } from "./keys";

/** How long a processed Stripe event id is remembered (30 days). */
const DEDUPE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Try to claim a Stripe event for processing.
 * @returns `true` if this is the first time we've seen `evtId` (proceed);
 *          `false` if it was already processed (skip — replay/duplicate).
 */
export async function claimStripeEvent(
  evtId: string,
  now: () => number = Date.now,
): Promise<boolean> {
  const key = paymentKeys.stripeEvent(evtId);
  try {
    await putNew({
      ...key,
      entity: "STRIPEEVENT",
      processedAt: new Date(now()).toISOString(),
      ttl: Math.floor(now() / 1000) + DEDUPE_TTL_SECONDS,
    });
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}
