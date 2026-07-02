#!/usr/bin/env node
/**
 * provision-table.mjs — create the single DynamoDB table + 4 GSIs (PRD §9.1–9.2).
 *
 * ON-DEMAND capacity (PAY_PER_REQUEST) — never provisioned throughput (project rule).
 * Streams enabled (NEW_AND_OLD_IMAGES) for the §9.4 aggregation Lambdas, and TTL on
 * `ttl` for ephemeral items (anon tokens, Stripe dedupe).
 *
 * Usage:
 *   DYNAMODB_ENDPOINT=http://localhost:8000 APP_ENV=Development node scripts/provision-table.mjs
 *   node scripts/provision-table.mjs --recreate      # drop + recreate (local only)
 *
 * Env: APP_ENV (Development|Test|Production) → table PickleLokoApp<Env>;
 *      DYNAMODB_ENDPOINT (set → DynamoDB Local); AWS_REGION.
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from "@aws-sdk/client-dynamodb";

function resolveEnv() {
  const raw = (process.env.APP_ENV ?? "").toLowerCase();
  if (raw.startsWith("prod")) return "Production";
  if (raw === "test") return "Test";
  return "Development";
}

const TABLE = `PickleLokoApp${resolveEnv()}`;
const endpoint = process.env.DYNAMODB_ENDPOINT || undefined;
const recreate = process.argv.includes("--recreate");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(endpoint
    ? {
        endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "local",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "local",
        },
      }
    : {}),
});

const S = "S";
const attr = (n) => ({ AttributeName: n, AttributeType: S });
const gsi = (name, pk, sk) => ({
  IndexName: name,
  KeySchema: [
    { AttributeName: pk, KeyType: "HASH" },
    { AttributeName: sk, KeyType: "RANGE" },
  ],
  Projection: { ProjectionType: "ALL" },
});

const createInput = {
  TableName: TABLE,
  BillingMode: "PAY_PER_REQUEST", // on-demand — never provisioned
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" },
  ],
  AttributeDefinitions: [
    attr("pk"), attr("sk"),
    attr("gsi1pk"), attr("gsi1sk"),
    attr("gsi2pk"), attr("gsi2sk"),
    attr("gsi3pk"), attr("gsi3sk"),
    attr("gsi4pk"), attr("gsi4sk"),
  ],
  GlobalSecondaryIndexes: [
    gsi("GSI1", "gsi1pk", "gsi1sk"), // ByOwner/Parent
    gsi("GSI2", "gsi2pk", "gsi2sk"), // ByLocation/Date
    gsi("GSI3", "gsi3pk", "gsi3sk"), // BySlug
    gsi("GSI4", "gsi4pk", "gsi4sk"), // GeoHash
  ],
  StreamSpecification: { StreamEnabled: true, StreamViewType: "NEW_AND_OLD_IMAGES" },
};

async function exists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE }));
    return true;
  } catch (e) {
    if (e.name === "ResourceNotFoundException") return false;
    throw e;
  }
}

async function main() {
  console.log(`Provisioning ${TABLE}${endpoint ? ` @ ${endpoint}` : " (AWS)"}`);

  if (recreate && (await exists())) {
    if (!endpoint) throw new Error("--recreate is refused against real AWS (safety).");
    console.log("  dropping existing table…");
    await client.send(new DeleteTableCommand({ TableName: TABLE }));
    await waitUntilTableNotExists({ client, maxWaitTime: 60 }, { TableName: TABLE });
  }

  if (await exists()) {
    console.log("  table already exists — nothing to do.");
    return;
  }

  await client.send(new CreateTableCommand(createInput));
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: TABLE });
  console.log("  table + 4 GSIs created (on-demand, streams on).");

  // TTL is a separate call and can be flaky on DynamoDB Local; best-effort.
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: TABLE,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "ttl" },
      }),
    );
    console.log("  TTL enabled on `ttl`.");
  } catch (e) {
    console.warn(`  (TTL not enabled: ${e.name ?? e.message})`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
