/**
 * local.ts — local DynamoDB Streams emulation harness (PRD §9.4, §14 test suite).
 *
 * Two entry points:
 *
 *  • `processRecords(rawRecords)` — the TEST feeder. Takes an array of RAW AWS
 *    DynamoDB Stream records (the `@aws-sdk/client-dynamodb-streams` `_Record`
 *    shape, with `dynamodb.NewImage`/`OldImage` still marshalled as
 *    `AttributeValue` maps), UNMARSHALLS each image via `@aws-sdk/util-dynamodb`,
 *    normalizes it to the aggregator's `{ eventName, newImage, oldImage }`, and
 *    calls `applyStreamRecord`. Integration tests marshal fixture writes and hand
 *    them here to assert the resulting §9.4 aggregates.
 *
 *  • `runLocalStreamConsumer(opts?)` — a dev-only poller. Describes the table's
 *    stream on DynamoDB Local, gets shard iterators, and loops `GetRecords` →
 *    `processRecords`. GUARD: it refuses to run unless `DYNAMODB_ENDPOINT` is set,
 *    so it can never point at a real (production) stream. Safe to run as a
 *    background dev process; pass an `AbortSignal` (or a max-idle) to stop it.
 *
 * Requires the table's stream to be enabled with `NEW_AND_OLD_IMAGES` so both
 * images are available (MODIFY rating deltas + REMOVE handlers need the old image).
 */

import "server-only";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBClient, DescribeTableCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBStreamsClient,
  DescribeStreamCommand,
  GetShardIteratorCommand,
  GetRecordsCommand,
  type _Record,
  type ShardIteratorType,
} from "@aws-sdk/client-dynamodb-streams";
import { awsEnv } from "@/lib/env";
import { TABLE_NAME } from "@/lib/db/table";
import { applyStreamRecord, type StreamRecord } from "./aggregator";

// ── record normalization ─────────────────────────────────────────────────────

/** Unmarshall one marshalled image map into a plain JS object. */
function unmarshallImage(
  image: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!image) return undefined;
  // The streams package ships its own structurally-identical `AttributeValue`
  // union; bridge it to the one `unmarshall` expects.
  return unmarshall(image as unknown as Record<string, AttributeValue>);
}

/** Normalize a raw AWS `_Record` to the aggregator's `StreamRecord`, or skip it. */
export function normalizeRecord(raw: _Record): StreamRecord | undefined {
  const eventName = raw.eventName;
  if (eventName !== "INSERT" && eventName !== "MODIFY" && eventName !== "REMOVE") return undefined;
  const body = raw.dynamodb;
  if (!body) return undefined;
  return {
    eventName,
    newImage: unmarshallImage(body.NewImage),
    oldImage: unmarshallImage(body.OldImage),
  };
}

/**
 * Feed a batch of RAW stream records through the aggregator.
 * @returns the number of records that were routed (non-skipped).
 */
export async function processRecords(rawRecords: readonly _Record[]): Promise<number> {
  let handled = 0;
  for (const raw of rawRecords) {
    const normalized = normalizeRecord(raw);
    if (!normalized) continue;
    await applyStreamRecord(normalized);
    handled += 1;
  }
  return handled;
}

// ── local poller ─────────────────────────────────────────────────────────────

export interface LocalStreamConsumerOptions {
  /** Where in each shard to start reading (default `LATEST` — only new writes). */
  startPosition?: ShardIteratorType;
  /** Delay between empty poll cycles, ms (default 1000). */
  pollIntervalMs?: number;
  /**
   * Stop after this many consecutive fully-empty poll cycles (default: run until
   * aborted). Useful for a bounded test drain.
   */
  maxIdleCycles?: number;
  /** Abort the loop cooperatively. */
  signal?: AbortSignal;
  /** Invoked after each batch with the number of records handled (>0). */
  onBatch?: (handled: number) => void;
}

function localClientConfig(): {
  region: string;
  endpoint: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
} {
  return {
    region: awsEnv.region,
    // Non-null asserted by the guard in `runLocalStreamConsumer`.
    endpoint: awsEnv.dynamoEndpoint as string,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
    },
  };
}

/** Resolve after `ms`, or immediately if the signal aborts. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Poll DynamoDB Local's stream for `TABLE_NAME` and feed batches to
 * `processRecords`. LOCAL-ONLY: throws unless `DYNAMODB_ENDPOINT` is set.
 */
export async function runLocalStreamConsumer(opts: LocalStreamConsumerOptions = {}): Promise<void> {
  if (!awsEnv.dynamoEndpoint) {
    throw new Error(
      "runLocalStreamConsumer: refusing to run without DYNAMODB_ENDPOINT set — this poller is a local-only dev/test harness.",
    );
  }

  const cfg = localClientConfig();
  const ddb = new DynamoDBClient(cfg);
  const streams = new DynamoDBStreamsClient(cfg);
  const startPosition: ShardIteratorType = opts.startPosition ?? "LATEST";
  const pollIntervalMs = opts.pollIntervalMs ?? 1000;

  try {
    // 1. Find the table's stream.
    const table = await ddb.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    const streamArn = table.Table?.LatestStreamArn;
    if (!streamArn) {
      throw new Error(
        `runLocalStreamConsumer: ${TABLE_NAME} has no stream — enable Streams (NEW_AND_OLD_IMAGES) on the local table.`,
      );
    }

    // 2. Open an iterator per shard.
    const streamDesc = await streams.send(new DescribeStreamCommand({ StreamArn: streamArn }));
    const shards = streamDesc.StreamDescription?.Shards ?? [];
    const iterators = new Map<string, string>();
    for (const shard of shards) {
      if (!shard.ShardId) continue;
      const it = await streams.send(
        new GetShardIteratorCommand({
          StreamArn: streamArn,
          ShardId: shard.ShardId,
          ShardIteratorType: startPosition,
        }),
      );
      if (it.ShardIterator) iterators.set(shard.ShardId, it.ShardIterator);
    }

    // 3. Poll loop.
    let idleCycles = 0;
    while (!opts.signal?.aborted && iterators.size > 0) {
      let batchTotal = 0;
      for (const shardId of [...iterators.keys()]) {
        const iterator = iterators.get(shardId);
        if (!iterator) continue;
        const out = await streams.send(
          new GetRecordsCommand({ ShardIterator: iterator, Limit: 100 }),
        );
        const records = out.Records ?? [];
        if (records.length > 0) {
          const handled = await processRecords(records);
          batchTotal += handled;
          if (handled > 0) opts.onBatch?.(handled);
        }
        // Advance, or drop the shard when it closes (NextShardIterator == null).
        if (out.NextShardIterator) iterators.set(shardId, out.NextShardIterator);
        else iterators.delete(shardId);
      }

      if (batchTotal === 0) {
        idleCycles += 1;
        if (opts.maxIdleCycles !== undefined && idleCycles >= opts.maxIdleCycles) break;
        await delay(pollIntervalMs, opts.signal);
      } else {
        idleCycles = 0;
      }
    }
  } finally {
    ddb.destroy();
    streams.destroy();
  }
}
