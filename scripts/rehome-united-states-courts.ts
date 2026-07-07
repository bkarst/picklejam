#!/usr/bin/env tsx
/**
 * rehome-united-states-courts.ts — migration for the mis-ingested `united-states`
 * city buckets (see tasks/fix-cities-bug.md). Moves each court OUT of a bogus
 * `us#<state>#united-states` bucket and INTO its real city, parsed from the address.
 *
 * A COURT is one item, so a re-home is an in-place update of `cityKey` + the GSI2
 * (`inCity`) and GSI3 (`bySlug`) keys — the primary key `COURT#<id>/META` is stable.
 * The move is intra-state, so STATE/COUNTRY `locations`/`courts` are unchanged; only
 * `cities` drops when a bucket is fully emptied and deleted. Target CITY `counts` are
 * bumped by the courts they receive (matching the GeoAccumulator's indexable filter).
 *
 * CONSERVATIVE: re-homes only to cities that ALREADY exist. Courts whose real city is
 * missing (e.g. `long-island-city`) or unparseable are reported as unresolved and left
 * in place for a follow-up (city creation is out of scope here).
 *
 * Dry-run by default (writes nothing). Add --apply to execute.
 *   npx tsx --env-file=.env scripts/rehome-united-states-courts.ts --state new-york
 *   npx tsx --env-file=.env scripts/rehome-united-states-courts.ts --state new-york --apply
 * Omit --state to process every bucket (dry-run recommended first).
 */

import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, TABLE_NAME, GSI } from "@/lib/db/table";
import { getItem, query, updateItem, deleteItem } from "@/lib/db/client";
import { courtKeys, geoKeys, parseCityKey } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { stateAbbr } from "@/lib/geo/us-states";
import { getState, getCountry, getCitiesInState } from "@/lib/data/geo";
import type { CourtItem, CityItem } from "@/lib/db/types";

const COUNTRY = "us";
const DROP_TOKENS = new Set(["usa", "us", "united states"]);

/** NYC county form in addresses → borough city slug. */
const COUNTY_TO_BOROUGH: Record<string, string> = {
  kings: "brooklyn",
  queens: "queens",
  "new york": "manhattan",
  bronx: "bronx",
  richmond: "staten-island",
};

/** Queens neighborhoods with no CityItem of their own → fold into the `queens` borough. */
const QUEENS_NEIGHBORHOODS = new Set([
  "long-island-city", "maspeth", "middle-village", "rego-park", "fresh-meadows", "bay-terrace",
  "bayside", "glendale", "jamaica", "whitestone", "astoria", "flushing", "forest-hills",
  "elmhurst", "corona", "woodside", "sunnyside", "ridgewood", "howard-beach", "ozone-park",
  "kew-gardens", "far-rockaway", "college-point", "little-neck", "douglaston", "hollis",
  "springfield-gardens", "st-albans", "queens-village", "richmond-hill", "south-ozone-park",
]);

function parseArgs() {
  const a = process.argv.slice(2);
  const i = a.indexOf("--state");
  return { state: i >= 0 ? a[i + 1] : undefined, apply: a.includes("--apply") };
}

/** The trailing "city" segment of a comma address (state token dropped). Null if none. */
function citySegment(addr: string | undefined, abbr: string, stateName: string): string | null {
  if (!addr) return null;
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  while (parts.length && DROP_TOKENS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts.pop(); // bare zip segment
  if (!parts.length) return null;
  // The last segment should be the state ("NY" / "NY 12345" / "New York 12345"); drop it.
  const core = parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "").trim().toLowerCase();
  if (core === abbr.toLowerCase() || core === stateName.toLowerCase()) parts.pop();
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Resolve a court address to an EXISTING city slug in `existing`, or null. In order:
 * county→borough, direct slug, "the-" strip, Queens-neighborhood→borough, then a
 * space-token tail-suffix match (handles no-comma addresses like "… Clifton Park NY 12065").
 */
function resolveCitySlug(
  addr: string | undefined,
  abbr: string,
  stateName: string,
  existing: Set<string>,
): { slug: string; via: string } | null {
  const seg = citySegment(addr, abbr, stateName);
  if (seg) {
    const county = seg.toLowerCase().match(/\b(kings|queens|new york|bronx|richmond)\s+county\b/);
    if (county && existing.has(COUNTY_TO_BOROUGH[county[1]])) return { slug: COUNTY_TO_BOROUGH[county[1]], via: "county" };
    const base = slugify(seg);
    if (existing.has(base)) return { slug: base, via: "direct" };
    if (base.startsWith("the-") && existing.has(base.slice(4))) return { slug: base.slice(4), via: "the-strip" };
    if (QUEENS_NEIGHBORHOODS.has(base) && existing.has("queens")) return { slug: "queens", via: "queens-nbhd" };
  }
  // Tail-suffix fallback: strip trailing zip/state tokens, match the longest suffix that
  // is an existing city (prefer longer/more-specific; min length guards spurious hits).
  const toks = (addr ?? "").replace(/,/g, " ").split(/\s+/).filter(Boolean);
  while (toks.length && /^\d{5}(-\d{4})?$/.test(toks[toks.length - 1])) toks.pop();
  if (toks.length && toks[toks.length - 1].toLowerCase() === abbr.toLowerCase()) toks.pop();
  for (let k = 3; k >= 1; k--) {
    if (toks.length < k) continue;
    const cand = slugify(toks.slice(-k).join(" "));
    if (cand.length >= 4 && existing.has(cand)) return { slug: cand, via: `suffix-${k}` };
  }
  return null;
}

/** All COURT items in a bucket cityKey (scan; buckets are small). */
async function bucketCourts(cityKey: string): Promise<CourtItem[]> {
  const out: CourtItem[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await getDocClient().send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "entity = :e AND cityKey = :ck",
        ExpressionAttributeValues: { ":e": "COURT", ":ck": cityKey },
        ExclusiveStartKey: start,
      }),
    );
    out.push(...((res.Items ?? []) as CourtItem[]));
    start = res.LastEvaluatedKey;
  } while (start);
  return out;
}

/** Whether a court counts toward city/state `locations` (matches GeoAccumulator). */
function isCounted(c: CourtItem): boolean {
  return !c.deleted && !c.hidden && c.hasPickleball !== false && c.indexable !== false;
}

/** Is `slug` already taken by a court in the target city (GSI3 collision)? */
async function slugTaken(targetCityKey: string, slug: string): Promise<boolean> {
  const { items } = await query<{ pk: string }>({
    index: GSI.bySlug,
    pk: courtKeys.courtSlugPk(targetCityKey, slug),
    skEquals: "META",
    projection: ["pk"],
    limit: 1,
  });
  return items.length > 0;
}

interface Move {
  court: CourtItem;
  targetCityKey: string;
  slug: string;
  collided: boolean;
  counted: boolean;
  via: string;
}

async function processBucket(stateSlug: string, apply: boolean): Promise<void> {
  const bucketKey = `${COUNTRY}#${stateSlug}#united-states`;
  const stateItem = await getState(COUNTRY, stateSlug);
  const abbr = stateAbbr(stateSlug);
  const stateName = stateItem?.name ?? "";
  const courts = await bucketCourts(bucketKey);
  const existing = new Set(
    (await getCitiesInState(COUNTRY, stateSlug)).map((c) => c.slug).filter((s) => s !== "united-states"),
  );

  const moves: Move[] = [];
  const unresolved: { name: string; reason: string }[] = [];
  const assigned = new Set<string>(); // `${cityKey}|${slug}` — guards intra-batch collisions too

  for (const court of courts) {
    const resolved = resolveCitySlug(court.address, abbr, stateName, existing);
    if (!resolved) {
      const seg = citySegment(court.address, abbr, stateName);
      unresolved.push({ name: court.name, reason: seg ? `no city "${seg}"` : `unparseable · "${court.address ?? ""}"` });
      continue;
    }
    const targetCityKey = `${COUNTRY}#${stateSlug}#${resolved.slug}`;
    let slug = court.slug;
    const collided = assigned.has(`${targetCityKey}|${slug}`) || (await slugTaken(targetCityKey, slug));
    if (collided) slug = `${slug}-${court.courtId.slice(0, 6)}`;
    assigned.add(`${targetCityKey}|${slug}`);
    moves.push({ court, targetCityKey, slug, collided, counted: isCounted(court), via: resolved.via });
  }

  // ── report ──
  console.log(`\n=== ${stateSlug} · bucket ${bucketKey} ===`);
  console.log(`  courts in bucket: ${courts.length}`);
  console.log(`  re-homable (target exists): ${moves.length}   unresolved: ${unresolved.length}   slug collisions: ${moves.filter((m) => m.collided).length}`);
  const viaCounts = moves.reduce((m, x) => m.set(x.via, (m.get(x.via) ?? 0) + 1), new Map<string, number>());
  if (moves.length) console.log(`  resolved via: ${[...viaCounts].map(([v, n]) => `${v}=${n}`).join(" · ")}`);
  const byCity = new Map<string, Move[]>();
  for (const m of moves) byCity.set(m.targetCityKey, [...(byCity.get(m.targetCityKey) ?? []), m]);
  for (const [ck, ms] of [...byCity].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`    → ${parseCityKey(ck).city}: ${ms.length}`);
  }
  for (const u of unresolved) console.log(`    ⚠ UNRESOLVED · ${u.name} · ${u.reason}`);

  if (!apply) {
    const emptied = unresolved.length === 0;
    console.log(`  [dry-run] would move ${moves.length} courts; bucket ${emptied ? "DELETED (state.cities −1)" : "kept (has unresolved courts)"}`);
    return;
  }

  // ── apply ──
  for (const m of moves) {
    const inCity = courtKeys.inCity(m.court.courtId, m.targetCityKey);
    const bySlug = courtKeys.bySlug(m.targetCityKey, m.slug);
    await updateItem({
      key: courtKeys.meta(m.court.courtId),
      update: "SET cityKey = :ck, gsi2pk = :g2, gsi3pk = :g3, slug = :slug",
      values: { ":ck": m.targetCityKey, ":g2": inCity.gsi2pk, ":g3": bySlug.gsi3pk, ":slug": m.slug },
    });
  }
  // Bump each target city's counts by the courts it received (indexable only).
  for (const [ck, ms] of byCity) {
    const dl = ms.filter((m) => m.counted).length;
    const dc = ms.filter((m) => m.counted).reduce((s, m) => s + (m.court.totalCourts ?? 0), 0);
    const { state, city } = parseCityKey(ck);
    const cityItem = await getItem<CityItem>(geoKeys.city(COUNTRY, state, city));
    if (!cityItem) continue;
    const counts = {
      ...cityItem.counts,
      locations: (cityItem.counts?.locations ?? 0) + dl,
      courts: (cityItem.counts?.courts ?? 0) + dc,
    };
    await updateItem({ key: geoKeys.city(COUNTRY, state, city), update: "SET #c = :c", names: { "#c": "counts" }, values: { ":c": counts } });
  }
  // Bucket cleanup: delete if fully emptied, else recompute its counts.
  const remaining = await bucketCourts(bucketKey);
  if (remaining.length === 0) {
    await deleteItem(geoKeys.city(COUNTRY, stateSlug, "united-states"));
    const st = await getState(COUNTRY, stateSlug);
    if (st?.counts) {
      await updateItem({ key: geoKeys.state(COUNTRY, stateSlug), update: "SET #c = :c", names: { "#c": "counts" }, values: { ":c": { ...st.counts, cities: Math.max(0, (st.counts.cities ?? 1) - 1) } } });
    }
    const co = await getCountry(COUNTRY);
    if (co?.counts) {
      await updateItem({ key: geoKeys.country(COUNTRY), update: "SET #c = :c", names: { "#c": "counts" }, values: { ":c": { ...co.counts, cities: Math.max(0, (co.counts.cities ?? 1) - 1) } } });
    }
    console.log(`  [apply] moved ${moves.length}; bucket deleted; state.cities & country.cities −1`);
  } else {
    const loc = remaining.filter(isCounted).length;
    const crt = remaining.filter(isCounted).reduce((s, c) => s + (c.totalCourts ?? 0), 0);
    const bucket = await getItem<CityItem>(geoKeys.city(COUNTRY, stateSlug, "united-states"));
    if (bucket) {
      await updateItem({ key: geoKeys.city(COUNTRY, stateSlug, "united-states"), update: "SET #c = :c", names: { "#c": "counts" }, values: { ":c": { ...bucket.counts, locations: loc, courts: crt } } });
    }
    console.log(`  [apply] moved ${moves.length}; bucket kept with ${remaining.length} unresolved courts`);
  }
}

/** Find every `united-states` bucket state (for the no---state case). */
async function allBucketStates(): Promise<string[]> {
  const states = new Set<string>();
  let start: Record<string, unknown> | undefined;
  do {
    const res = await getDocClient().send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "entity = :e AND slug = :s",
        ExpressionAttributeValues: { ":e": "CITY", ":s": "united-states" },
        ProjectionExpression: "#st",
        ExpressionAttributeNames: { "#st": "state" },
        ExclusiveStartKey: start,
      }),
    );
    for (const it of res.Items ?? []) states.add((it as { state: string }).state);
    start = res.LastEvaluatedKey;
  } while (start);
  return [...states].sort();
}

async function main() {
  const { state, apply } = parseArgs();
  console.log(`Re-home united-states courts → ${TABLE_NAME}${apply ? " (APPLY)" : " (DRY RUN)"}`);
  const states = state ? [state] : await allBucketStates();
  console.log(`states: ${states.length === 1 ? states[0] : `${states.length} buckets`}`);
  for (const s of states) await processBucket(s, apply);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
