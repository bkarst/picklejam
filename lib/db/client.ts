/**
 * client.ts — the single-table access layer (PRD §9.5–9.6).
 *
 * Every §9.5 view resolves in ONE `Query`/`GetItem`, no scans, no joins. This
 * module deliberately exposes NO `scan` operation — a full-table scan is a bug
 * here (§9.6). Writes go through `putItem`/`putNew`/`updateItem`/`deleteItem` and,
 * for multi-item consistency (N15), `transactWrite`.
 */

// Server-context module (route handlers + CLI); see lib/db/table.ts on why this
// deliberately omits `import "server-only"`.
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLE_NAME, GSI } from "./table";
import type { PrimaryKey } from "./keys";

export type IndexName = (typeof GSI)[keyof typeof GSI];

/**
 * Extract ONLY the base-table primary key. Key builders often return the base key
 * spread with GSI projections (for writes); DynamoDB rejects a GetItem/Delete Key
 * that carries non-key attributes ("key does not match schema"), so every
 * point-key op narrows to `{pk, sk}` here.
 */
function baseKey(key: PrimaryKey): PrimaryKey {
  return { pk: key.pk, sk: key.sk };
}

/** Map an index (or the base table) to its partition/sort attribute names. */
function keyAttrs(index?: IndexName): { pk: string; sk: string } {
  switch (index) {
    case GSI.byOwner:
      return { pk: "gsi1pk", sk: "gsi1sk" };
    case GSI.byLocation:
      return { pk: "gsi2pk", sk: "gsi2sk" };
    case GSI.bySlug:
      return { pk: "gsi3pk", sk: "gsi3sk" };
    case GSI.byGeo:
      return { pk: "gsi4pk", sk: "gsi4sk" };
    default:
      return { pk: "pk", sk: "sk" };
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────

/** GetItem by primary key. */
export async function getItem<T>(
  key: PrimaryKey,
  opts?: { consistentRead?: boolean },
): Promise<T | undefined> {
  const res = await getDocClient().send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: baseKey(key),
      ConsistentRead: opts?.consistentRead,
    }),
  );
  return res.Item as T | undefined;
}

export interface QueryOptions {
  /** Partition-key value (of the base table or the chosen GSI). */
  pk: string;
  /** `begins_with(sk, prefix)` — the common single-partition filter. */
  skBeginsWith?: string;
  /** Exact sort-key equality. */
  skEquals?: string;
  /** Inclusive sort-key range `[from, to]` (mutually exclusive with the above). */
  skBetween?: [string, string];
  /** GSI to query; omit for the base table. */
  index?: IndexName;
  /** Sort ascending (default true). */
  ascending?: boolean;
  limit?: number;
  /** Pagination cursor from a previous page's `lastKey`. */
  startKey?: Record<string, unknown>;
  /** Post-read filter (allowed — a filter is NOT a scan; the Query is still keyed). */
  filter?: {
    expression: string;
    names?: Record<string, string>;
    values?: Record<string, unknown>;
  };
  /** Projection attribute names (reduce payload). */
  projection?: string[];
  consistentRead?: boolean;
}

export interface QueryResult<T> {
  items: T[];
  /** Present when the result was truncated — pass back as `startKey` to paginate. */
  lastKey?: Record<string, unknown>;
}

/**
 * Single-partition Query. Enforces the §9.5 "one query per view" rule: it always
 * targets a single partition key (never a scan). Sort-key narrowing is optional.
 */
export async function query<T>(opts: QueryOptions): Promise<QueryResult<T>> {
  const { pk: pkAttr, sk: skAttr } = keyAttrs(opts.index);

  const names: Record<string, string> = { "#pk": pkAttr };
  const values: Record<string, unknown> = { ":pk": opts.pk };
  let keyCond = "#pk = :pk";

  if (opts.skEquals !== undefined) {
    names["#sk"] = skAttr;
    values[":sk"] = opts.skEquals;
    keyCond += " AND #sk = :sk";
  } else if (opts.skBeginsWith !== undefined) {
    names["#sk"] = skAttr;
    values[":skPrefix"] = opts.skBeginsWith;
    keyCond += " AND begins_with(#sk, :skPrefix)";
  } else if (opts.skBetween !== undefined) {
    names["#sk"] = skAttr;
    values[":from"] = opts.skBetween[0];
    values[":to"] = opts.skBetween[1];
    keyCond += " AND #sk BETWEEN :from AND :to";
  }

  if (opts.filter?.names) Object.assign(names, opts.filter.names);
  if (opts.filter?.values) Object.assign(values, opts.filter.values);

  const res = await getDocClient().send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: opts.index,
      KeyConditionExpression: keyCond,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      FilterExpression: opts.filter?.expression,
      ScanIndexForward: opts.ascending ?? true,
      Limit: opts.limit,
      ExclusiveStartKey: opts.startKey,
      ProjectionExpression: opts.projection?.map((_, i) => `#p${i}`).join(", "),
      ...(opts.projection
        ? {
            ExpressionAttributeNames: {
              ...names,
              ...Object.fromEntries(opts.projection.map((p, i) => [`#p${i}`, p])),
            },
          }
        : {}),
      ConsistentRead: opts.index ? undefined : opts.consistentRead,
    }),
  );

  return {
    items: (res.Items ?? []) as T[],
    lastKey: res.LastEvaluatedKey,
  };
}

/**
 * Query a single partition and FOLLOW `LastEvaluatedKey` until every matching item is
 * read. DynamoDB caps one `query` page at 1 MB, so a large partition (thousands of
 * registrations/rungs/fixtures) is silently truncated. Use this for correctness-
 * critical full reads — mass refunds, standings/bracket seeding, whole-board reorders,
 * "mark all" sweeps — where a dropped page means lost money or corrupt state.
 *
 * Do NOT use for user-facing paginated lists; pass `limit` + `startKey` to `query` and
 * expose the cursor instead. (`limit`, if given, becomes the per-page size — the loop
 * still returns the full result.)
 */
export async function queryAll<T>(opts: Omit<QueryOptions, "startKey">): Promise<T[]> {
  const out: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await query<T>({ ...opts, startKey });
    out.push(...page.items);
    startKey = page.lastKey;
  } while (startKey);
  return out;
}

/** BatchGet up to 100 items by primary key (one round trip; still not a scan). */
export async function batchGet<T>(batchKeys: PrimaryKey[]): Promise<T[]> {
  if (batchKeys.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < batchKeys.length; i += 100) {
    const chunk = batchKeys.slice(i, i + 100).map(baseKey);
    const res = await getDocClient().send(
      new BatchGetCommand({ RequestItems: { [TABLE_NAME]: { Keys: chunk } } }),
    );
    out.push(...((res.Responses?.[TABLE_NAME] ?? []) as T[]));
  }
  return out;
}

// ── Writes ────────────────────────────────────────────────────────────────

/** Upsert an item. */
export async function putItem<T extends Record<string, unknown>>(item: T): Promise<void> {
  await getDocClient().send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

/**
 * Upsert an item and return its PRIOR image (`ALL_OLD`) — `undefined` if the key was empty
 * (a genuine INSERT). DynamoDB computes the prior image ATOMICALLY at write time, so a caller
 * that emits an inline stream image can decide INSERT-vs-MODIFY from the TRUE committed prior
 * state rather than a stale pre-read — the only race-safe way to mirror what real DynamoDB
 * Streams would deliver (two concurrent upserts ⇒ one INSERT + one MODIFY, never two INSERTs).
 */
export async function putItemReturningOld<T extends Record<string, unknown>>(
  item: T,
): Promise<Record<string, unknown> | undefined> {
  const res = await getDocClient().send(
    new PutCommand({ TableName: TABLE_NAME, Item: item, ReturnValues: "ALL_OLD" }),
  );
  return res.Attributes;
}

/**
 * Bulk upsert (seed ingestion). Chunks into 25-item BatchWrite requests and
 * retries UnprocessedItems with backoff. Idempotent by primary key (last write
 * wins), so re-running the import produces no duplicates (§9.8).
 */
export async function batchWrite<T extends Record<string, unknown>>(items: T[]): Promise<void> {
  const client = getDocClient();
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let requests = chunk.map((Item) => ({ PutRequest: { Item } }));
    for (let attempt = 0; attempt < 5 && requests.length > 0; attempt++) {
      const res = await client.send(
        new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: requests } }),
      );
      const unprocessed = res.UnprocessedItems?.[TABLE_NAME] ?? [];
      requests = unprocessed as typeof requests;
      if (requests.length > 0) await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
    if (requests.length > 0) {
      throw new Error(`batchWrite: ${requests.length} items unprocessed after retries`);
    }
  }
}

/** Create-only put: fails if an item with the same primary key already exists. */
export async function putNew<T extends Record<string, unknown>>(item: T): Promise<void> {
  await getDocClient().send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
}

/**
 * Conditional put: upsert an item only when `condition` holds against the CURRENT
 * stored item (throws {@link ConditionalCheckFailedException} otherwise). Use to
 * serialize concurrent creates that must not clobber an in-flight sibling — e.g. a
 * registration that may overwrite a terminal (cancelled/refunded) row but must NOT
 * overwrite an active one.
 */
export async function putConditional<T extends Record<string, unknown>>(
  item: T,
  condition: string,
  opts?: { names?: Record<string, string>; values?: Record<string, unknown> },
): Promise<void> {
  await getDocClient().send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: condition,
      ExpressionAttributeNames: opts?.names,
      ExpressionAttributeValues: opts?.values,
    }),
  );
}

export async function updateItem(params: {
  key: PrimaryKey;
  update: string;
  names?: Record<string, string>;
  values?: Record<string, unknown>;
  condition?: string;
}): Promise<Record<string, unknown> | undefined> {
  const res = await getDocClient().send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: baseKey(params.key),
      UpdateExpression: params.update,
      ExpressionAttributeNames: params.names,
      ExpressionAttributeValues: params.values,
      ConditionExpression: params.condition,
      ReturnValues: "ALL_NEW",
    }),
  );
  return res.Attributes;
}

export async function deleteItem(key: PrimaryKey, condition?: string): Promise<void> {
  await getDocClient().send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: baseKey(key), ConditionExpression: condition }),
  );
}

/**
 * Atomic composite write (N15, §9.1): all items succeed or none do. Use for
 * multi-item creates that must be mutually consistent — outing + OUTINGREF
 * (+ SERIES/MEETUP), group + creator MEMBER + COURT→GROUP pointers, registration
 * + Payment + counter. Respects the DynamoDB 100-item / 4 MB transaction limit.
 */
export type TransactItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];

export async function transactWrite(items: TransactItem[]): Promise<void> {
  if (items.length === 0) return;
  if (items.length > 100) {
    throw new Error(
      `transactWrite: ${items.length} items exceeds the DynamoDB 100-item limit (N15)`,
    );
  }
  // LOCAL ONLY: dynalite (the pure-JS local store) has no TransactWriteItems.
  // When DYNAMO_EMULATE_TRANSACTIONS=1, apply the items sequentially with their
  // conditions + best-effort rollback. Prod + CI (real DynamoDB / dynamodb-local)
  // NEVER set this and use the atomic TransactWriteItems (N15).
  if (process.env.DYNAMO_EMULATE_TRANSACTIONS === "1") {
    return emulateTransactWrite(items);
  }
  await getDocClient().send(new TransactWriteCommand({ TransactItems: items }));
}

/** Sequential, best-effort stand-in for TransactWriteItems (local dynalite only). */
async function emulateTransactWrite(items: TransactItem[]): Promise<void> {
  const client = getDocClient();
  const undo: PrimaryKey[] = [];
  try {
    for (const item of items) {
      if (item.Put) {
        await client.send(new PutCommand(item.Put));
        const it = item.Put.Item as PrimaryKey | undefined;
        if (it) undo.push({ pk: it.pk, sk: it.sk });
      } else if (item.Delete) {
        await client.send(new DeleteCommand(item.Delete));
      } else if (item.Update) {
        await client.send(new UpdateCommand(item.Update));
      } else {
        throw new Error("emulateTransactWrite: unsupported transact item (local mode)");
      }
    }
  } catch (err) {
    // Best-effort rollback of any Puts already applied (local dev integrity aid).
    for (const key of undo.reverse()) {
      await client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: key })).catch(() => {});
    }
    throw err;
  }
}

/** Build a Put transact item scoped to the app table. */
export function txPut<T extends Record<string, unknown>>(
  item: T,
  conditionExpression?: string,
): TransactItem {
  return { Put: { TableName: TABLE_NAME, Item: item, ConditionExpression: conditionExpression } };
}

/** Build a Delete transact item scoped to the app table. */
export function txDelete(key: PrimaryKey, conditionExpression?: string): TransactItem {
  return { Delete: { TableName: TABLE_NAME, Key: baseKey(key), ConditionExpression: conditionExpression } };
}

/** Build an Update transact item scoped to the app table (e.g. a version-guard bump). */
export function txUpdate(params: {
  key: PrimaryKey;
  update: string;
  condition?: string;
  names?: Record<string, string>;
  values?: Record<string, unknown>;
}): TransactItem {
  return {
    Update: {
      TableName: TABLE_NAME,
      Key: baseKey(params.key),
      UpdateExpression: params.update,
      ConditionExpression: params.condition,
      ExpressionAttributeNames: params.names,
      ExpressionAttributeValues: params.values,
    },
  };
}
