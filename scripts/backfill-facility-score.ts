#!/usr/bin/env tsx
/**
 * backfill-facility-score.ts — one-off migration: populate `facilityScore` +
 * `facilityTier` on every existing COURT item (PRD §9.8, N8).
 *
 * These are DERIVED attributes, so a re-ingest is the wrong tool: ingest does a
 * full PutItem that hardcodes the live community counters (reviewCount, ratingAvg,
 * checkinsTodayCount, playerCount, groupCount) back to 0 and drops the stream-
 * maintained fields (gamesCount, trailblazer/captain). This migration instead scans
 * COURT items and does a targeted `SET` of just the two new attributes, computing
 * them from fields already on each item. Non-destructive and idempotent — safe to
 * re-run (it only overwrites facilityScore/facilityTier).
 *
 * Run (against the env's real table — on-demand, no throughput to provision):
 *   npx tsx --env-file=.env scripts/backfill-facility-score.ts
 * Flags: --dry-run  compute + print the tier distribution, write nothing
 *        --limit N   stop after N courts (smoke test)
 */

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLE_NAME } from "@/lib/db/table";
import { updateItem } from "@/lib/db/client";
import { courtFacilityScore, type FacilityScoreInput } from "@/lib/ingest/map";
import type { CourtItem } from "@/lib/db/types";

/** Only the fields the scorer + the update key need. */
type CourtRow = Pick<CourtItem, "pk" | "sk" | "courtId"> & FacilityScoreInput;

const CONCURRENCY = 25; // COURT META is one item per court; on-demand table absorbs this fine.

function parseArgs() {
  const a = process.argv.slice(2);
  const limitArg = a.indexOf("--limit");
  return {
    dryRun: a.includes("--dry-run"),
    limit: limitArg >= 0 ? Number(a[limitArg + 1]) : undefined,
  };
}

/** Scan every COURT item, projecting only what the scorer + key need. */
async function* scanCourts(): AsyncGenerator<CourtRow> {
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await getDocClient().send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "entity = :c",
        ProjectionExpression:
          "pk, sk, courtId, nets, #lines, surface, totalCourts, indoorCourts, amenities, lighted, dedicated",
        ExpressionAttributeNames: { "#lines": "lines" },
        ExpressionAttributeValues: { ":c": "COURT" },
        ExclusiveStartKey: startKey,
      }),
    );
    for (const it of res.Items ?? []) yield it as CourtRow;
    startKey = res.LastEvaluatedKey;
  } while (startKey);
}

async function main() {
  const { dryRun, limit } = parseArgs();
  console.log(`Backfill facilityScore/facilityTier → ${TABLE_NAME}${dryRun ? " (DRY RUN)" : ""}`);

  const tiers: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let processed = 0;
  let batch: CourtRow[] = [];

  const flush = async () => {
    if (dryRun) {
      batch = [];
      return;
    }
    await Promise.all(
      batch.map((c) => {
        const { score, tier } = courtFacilityScore(c);
        return updateItem({
          key: { pk: c.pk, sk: c.sk },
          update: "SET facilityScore = :s, facilityTier = :t",
          values: { ":s": score, ":t": tier },
        });
      }),
    );
    batch = [];
  };

  for await (const court of scanCourts()) {
    tiers[courtFacilityScore(court).tier] += 1;
    batch.push(court);
    processed += 1;
    if (batch.length >= CONCURRENCY) await flush();
    if (processed % 2000 === 0) console.log(`  …${processed} courts`);
    if (limit && processed >= limit) break;
  }
  await flush();

  console.log(`\nDone. ${dryRun ? "Would update" : "Updated"} ${processed} courts.`);
  for (let t = 5; t >= 1; t--) {
    const pct = processed ? ((100 * tiers[t]) / processed).toFixed(1) : "0.0";
    console.log(`  ${t}★: ${tiers[t]} (${pct}%)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
