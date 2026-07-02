/**
 * table.ts — single-table config + the DynamoDB Document client (PRD §9.1–9.2).
 *
 * ONE table per environment, named `PickleLoko` + `App` + `<Environment>`
 * (PascalCase, no separators) → `PickleLokoAppDevelopment|Test|Production`.
 * The environment is resolved from `APP_ENV` (lib/env.ts) — never hardcode a bare
 * `PickleLoko`. Four GSIs overload the table (§9.2).
 *
 * When `DYNAMODB_ENDPOINT` is set (local dev / DynamoDB Local / the Test suite),
 * the client points there with throwaway credentials.
 */

// NOTE: intentionally NOT `import "server-only"`. The data layer is a
// server-context module used by BOTH Next route handlers/server components AND
// Node CLI scripts (seed ingestion). `server-only` (which guards against
// client-component bundling) would crash the CLI. Client components never import
// lib/db — reads go through server components / route handlers. The true
// app-server singletons (firebase/admin, stripe, resend, posthog-server) keep it.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { APP_ENV, awsEnv } from "@/lib/env";

/** Fully-qualified table name for the active environment (§9.1). */
export const TABLE_NAME = `PickleLokoApp${APP_ENV}` as const;

/** GSI logical names (§9.2). Kept in one place; used by queries + provisioning. */
export const GSI = {
  /** ByOwner/Parent — personal feeds & parent→children. */
  byOwner: "GSI1",
  /** ByLocation/Date — geo directory + date-scoped lists. */
  byLocation: "GSI2",
  /** BySlug — resolve SSG pages by URL slug. */
  bySlug: "GSI3",
  /** GeoHash — radius "near me" search. */
  byGeo: "GSI4",
} as const;

/** Physical key attribute names on every item. */
export const ATTR = {
  pk: "pk",
  sk: "sk",
  gsi1pk: "gsi1pk",
  gsi1sk: "gsi1sk",
  gsi2pk: "gsi2pk",
  gsi2sk: "gsi2sk",
  gsi3pk: "gsi3pk",
  gsi3sk: "gsi3sk",
  gsi4pk: "gsi4pk",
  gsi4sk: "gsi4sk",
  /** TTL attribute (epoch seconds) — only on ephemeral anon tokens + stripe dedupe. */
  ttl: "ttl",
} as const;

let _doc: DynamoDBDocumentClient | undefined;

/** The shared DynamoDB Document client singleton (JS-native marshalling). */
export function getDocClient(): DynamoDBDocumentClient {
  if (_doc) return _doc;

  const base = new DynamoDBClient({
    region: awsEnv.region,
    ...(awsEnv.dynamoEndpoint
      ? {
          endpoint: awsEnv.dynamoEndpoint,
          // DynamoDB Local accepts any credentials.
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
          },
        }
      : {}),
  });

  _doc = DynamoDBDocumentClient.from(base, {
    marshallOptions: {
      // Denormalized aggregates go in/out as plain numbers/strings; drop undefined.
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
    unmarshallOptions: { wrapNumbers: false },
  });
  return _doc;
}

/** Test-only: reset the cached client (e.g. after pointing at a fresh local table). */
export function __resetDocClient(): void {
  _doc = undefined;
}
