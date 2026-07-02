/**
 * inline.ts — apply Streams aggregation INLINE for local/CI (no real DynamoDB
 * Streams over dynalite / DynamoDB Local).
 *
 * In production, DynamoDB Streams → the aggregation Lambda (lib/streams/aggregator)
 * reconciles counters/averages asynchronously. Locally there's no stream, so when
 * `STREAMS_INLINE=1` a route handler calls `emitInsert/emitModify/emitRemove`
 * right after a write to run the SAME aggregator synchronously. Prod leaves the
 * flag unset (the real Lambda owns it) → these are no-ops, so writers never
 * double-apply. Failures are swallowed + logged (aggregation must not fail a write).
 */

import type { applyStreamRecord } from "./aggregator";

type Img = Record<string, unknown>;

const inlineEnabled = () => process.env.STREAMS_INLINE === "1";

// The aggregator statically imports `server-only`, so we import it LAZILY here —
// only when inline aggregation is actually enabled. That keeps the data layer
// importable from plain-Node scripts (seed/backfill via tsx) where `server-only`
// can't be resolved: with STREAMS_INLINE unset these emit calls short-circuit and
// the aggregator (and its `server-only` guard) is never loaded.
async function safeApply(record: Parameters<typeof applyStreamRecord>[0]): Promise<void> {
  try {
    const { applyStreamRecord } = await import("./aggregator");
    await applyStreamRecord(record);
  } catch (err) {
    console.error("[streams:inline] aggregation failed (non-fatal):", err);
  }
}

export async function emitInsert(newImage: Img): Promise<void> {
  if (!inlineEnabled()) return;
  await safeApply({ eventName: "INSERT", newImage });
}

export async function emitModify(oldImage: Img, newImage: Img): Promise<void> {
  if (!inlineEnabled()) return;
  await safeApply({ eventName: "MODIFY", oldImage, newImage });
}

export async function emitRemove(oldImage: Img): Promise<void> {
  if (!inlineEnabled()) return;
  await safeApply({ eventName: "REMOVE", oldImage });
}
