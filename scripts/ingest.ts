#!/usr/bin/env tsx
/**
 * ingest.ts — seed the court directory from data/<state>.yml (PRD §9.8).
 *
 * Parses each state file → maps courts to COURT items (skips is_deleted; stores
 * is_hidden) → batch-upserts (idempotent on courtId) → rolls up CITY/STATE/COUNTRY
 * counts via the batch path (GeoAccumulator) → writes geo items.
 *
 * Run (local, against dynalite/DynamoDB Local):
 *   DYNAMODB_ENDPOINT=http://localhost:8000 APP_ENV=Test npx tsx scripts/ingest.ts
 * Flags: --state <slug>  single state · --limit N  cap courts/state · --dry-run
 *
 * PRODUCTION full run (~16,311 courts): point at real DynamoDB (no endpoint),
 * APP_ENV=Production. On-demand table must be provisioned first.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { batchWrite } from "@/lib/db/client";
import { TABLE_NAME } from "@/lib/db/table";
import { mapSeedCourtToItem, type SeedCourt } from "@/lib/ingest/map";
import { GeoAccumulator } from "@/lib/ingest/pipeline";
import { courtToLite, cityToLite, writeSearchIndex, type CourtSearchLite } from "@/lib/search/index-store";
import type { CourtItem } from "@/lib/db/types";

interface StateFile {
  state: string;
  state_slug: string;
  country: string;
  courts: SeedCourt[];
}

const DATA_DIR = path.resolve(import.meta.dirname, "../data");

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    state: get("--state"),
    limit: get("--limit") ? Number(get("--limit")) : undefined,
    dryRun: a.includes("--dry-run"),
  };
}

async function main() {
  const { state, limit, dryRun } = parseArgs();
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
    .filter((f) => !state || f === `${state}.yml`)
    .sort();

  if (files.length === 0) throw new Error(`No state files matched (state=${state ?? "*"})`);

  console.log(`Ingesting → ${TABLE_NAME}${dryRun ? " (DRY RUN)" : ""} · ${files.length} state file(s)`);

  const geo = new GeoAccumulator();
  const courtLites: CourtSearchLite[] = []; // accumulated in-memory → precomputed search index
  let totalCourts = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const raw = readFileSync(path.join(DATA_DIR, file), "utf8");
    const doc = loadYaml(raw) as StateFile;
    if (!doc?.courts) {
      console.warn(`  ${file}: no courts[] — skipped`);
      continue;
    }
    const seedCourts = limit ? doc.courts.slice(0, limit) : doc.courts;
    const items: CourtItem[] = [];
    for (const seed of seedCourts) {
      if (seed.is_deleted) {
        totalSkipped += 1;
        continue;
      }
      const item = mapSeedCourtToItem(seed);
      items.push(item);
      geo.ingest(item, doc.state);
      if (!item.hidden && item.indexable !== false) courtLites.push(courtToLite(item));
    }
    if (!dryRun) await batchWrite(items as unknown as Record<string, unknown>[]);
    totalCourts += items.length;
    console.log(`  ${doc.state_slug}: ${items.length} courts${limit ? ` (capped ${limit})` : ""}`);
  }

  const { countries, states, cities } = geo.finalize();
  if (!dryRun) {
    await batchWrite(cities as unknown as Record<string, unknown>[]);
    await batchWrite(states as unknown as Record<string, unknown>[]);
    await batchWrite(countries as unknown as Record<string, unknown>[]);
  }

  // Precompute the typeahead search index (§6.1) from the in-memory data — only on
  // a full run, so a --state/--limit ingest never clobbers the complete index.
  if (!dryRun && !state && !limit) {
    const cityLites = cities.map(cityToLite);
    await writeSearchIndex("us", { courts: courtLites, cities: cityLites });
    console.log(`Search index: ${courtLites.length} courts · ${cityLites.length} cities`);
  } else if (!dryRun) {
    console.log("Search index: skipped (partial run — run a full ingest to rebuild it)");
  }

  console.log(
    `\nDone. Courts: ${totalCourts} (skipped deleted: ${totalSkipped}) · ` +
      `Cities: ${cities.length} · States: ${states.length} · Countries: ${countries.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
