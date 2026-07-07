#!/usr/bin/env tsx
/**
 * fix-source-cities.ts — DURABLE fix for the Pickleheads "united-states" fallback city
 * (see tasks/fix-cities-bug.md). Rewrites `city_slug` (+ `path`) in `data/<state>.yml`
 * for every court Pickleheads bucketed under the country, deriving the real city from the
 * court's address. After this, a re-ingest produces correct cities everywhere and the
 * `GeoAccumulator` mints real CityItems (incl. standalone towns) — no more buckets.
 *
 * Surgical text edit: only the two changed lines per affected court are rewritten (parsed
 * via js-yaml for the address, edited in the raw text), so the diff is minimal + reviewable.
 * Courts it can't confidently resolve are LEFT UNCHANGED and reported (a re-ingest keeps a
 * small, honest bucket rather than mis-homing).
 *
 * Dry-run diff by default; --write to edit the YAML. --state <slug> scopes to one file.
 *   npx tsx scripts/fix-source-cities.ts --state new-york
 *   npx tsx scripts/fix-source-cities.ts --state new-york --write
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { slugify } from "@/lib/util/slug";
import { stateAbbr } from "@/lib/geo/us-states";

const DATA_DIR = path.resolve(import.meta.dirname, "../data");
const DROP_TOKENS = new Set(["usa", "us", "united states"]);
const COUNTY_TO_BOROUGH: Record<string, string> = {
  kings: "brooklyn", queens: "queens", "new york": "manhattan", bronx: "bronx", richmond: "staten-island",
};
const QUEENS_NEIGHBORHOODS = new Set([
  "long-island-city", "maspeth", "middle-village", "rego-park", "fresh-meadows", "bay-terrace",
  "bayside", "glendale", "jamaica", "whitestone", "astoria", "flushing", "forest-hills",
  "elmhurst", "corona", "woodside", "sunnyside", "ridgewood", "howard-beach", "ozone-park",
  "kew-gardens", "far-rockaway", "college-point", "little-neck", "douglaston", "hollis",
  "springfield-gardens", "st-albans", "queens-village", "richmond-hill", "south-ozone-park",
]);

interface SeedCourt {
  title: string;
  address?: string;
  city_slug?: string;
}
interface StateDoc {
  state: string;
  state_slug: string;
  courts: SeedCourt[];
}

function parseArgs() {
  const a = process.argv.slice(2);
  const i = a.indexOf("--state");
  return { state: i >= 0 ? a[i + 1] : undefined, write: a.includes("--write") };
}

/** Trailing "city" segment of a comma address (state token dropped). */
function citySegment(addr: string | undefined, abbr: string, stateName: string): string | null {
  if (!addr) return null;
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  while (parts.length && DROP_TOKENS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  if (parts.length && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return null;
  const core = parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?$/, "").trim().toLowerCase();
  if (core === abbr.toLowerCase() || core === stateName.toLowerCase()) parts.pop();
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Resolve an address to a real city slug. Unlike the DB re-home, a clean city segment is
 * accepted even if no CityItem exists yet (via="new-city") — a re-ingest will create it.
 * `known` (the state's real city slugs) gates only the ambiguous paths (the-strip / county /
 * neighborhood / tail-suffix), so we never invent a city from a garbled segment.
 */
function resolveCity(addr: string | undefined, abbr: string, stateName: string, known: Set<string>): { slug: string; via: string } | null {
  const seg = citySegment(addr, abbr, stateName);
  if (seg) {
    const county = seg.toLowerCase().match(/\b(kings|queens|new york|bronx|richmond)\s+county\b/);
    if (county && known.has(COUNTY_TO_BOROUGH[county[1]])) return { slug: COUNTY_TO_BOROUGH[county[1]], via: "county" };
    if (!/^\d/.test(seg) && !/\bcounty\b/i.test(seg) && /[a-zA-Z]/.test(seg)) {
      const base = slugify(seg);
      if (base) {
        if (base.startsWith("the-") && known.has(base.slice(4))) return { slug: base.slice(4), via: "the-strip" };
        if (QUEENS_NEIGHBORHOODS.has(base) && known.has("queens")) return { slug: "queens", via: "queens-nbhd" };
        return { slug: base, via: known.has(base) ? "direct" : "new-city" };
      }
    }
  }
  const toks = String(addr ?? "").replace(/,/g, " ").split(/\s+/).filter(Boolean);
  while (toks.length && /^\d{5}(-\d{4})?$/.test(toks[toks.length - 1])) toks.pop();
  if (toks.length && toks[toks.length - 1].toLowerCase() === abbr.toLowerCase()) toks.pop();
  for (let k = 3; k >= 1; k--) {
    if (toks.length < k) continue;
    const cand = slugify(toks.slice(-k).join(" "));
    if (cand.length >= 4 && known.has(cand)) return { slug: cand, via: `suffix-${k}` };
  }
  return null;
}

function processFile(file: string, write: boolean) {
  const full = path.join(DATA_DIR, file);
  const text = readFileSync(full, "utf8");
  const doc = loadYaml(text) as StateDoc;
  if (!doc?.courts) return null;
  const affected = doc.courts.map((c, i) => ({ c, i })).filter((x) => x.c.city_slug === "united-states");
  if (!affected.length) return null;

  const abbr = stateAbbr(doc.state_slug);
  const stateName = doc.state;
  const known = new Set(doc.courts.map((c) => c.city_slug).filter((s): s is string => !!s && s !== "united-states"));

  // Split into header + one block per court (2-space `- id:`; images nest deeper, so safe).
  const blocks = text.split(/(?=^ {2}- id:)/m);
  const aligned = blocks.length - 1 === doc.courts.length;
  if (!aligned) console.warn(`  ⚠ ${file}: block/court count mismatch (${blocks.length - 1} vs ${doc.courts.length}) — skipping WRITE, dry-run only`);

  const resolved = new Map<string, number>();
  const newCities = new Map<string, number>();
  const unresolved: { title: string; addr: string }[] = [];
  let edits = 0;

  for (const { c, i } of affected) {
    const r = resolveCity(c.address, abbr, stateName, known);
    if (!r) {
      unresolved.push({ title: c.title, addr: c.address ?? "" });
      continue;
    }
    resolved.set(r.via, (resolved.get(r.via) ?? 0) + 1);
    if (r.via === "new-city") newCities.set(r.slug, (newCities.get(r.slug) ?? 0) + 1);
    if (write && aligned) {
      const bi = i + 1;
      blocks[bi] = blocks[bi]
        .replace(/(\n\s*city_slug: )united-states\b/, `$1${r.slug}`)
        .replace(/(\n\s*path: \/courts\/us\/[^/\n]+\/)united-states\//, `$1${r.slug}/`);
      edits += 1;
    }
  }

  // report
  console.log(`\n=== ${doc.state_slug} (${file}) ===`);
  console.log(`  bucketed courts: ${affected.length}   resolved: ${affected.length - unresolved.length}   unresolved: ${unresolved.length}`);
  if (resolved.size) console.log(`  via: ${[...resolved].map(([v, n]) => `${v}=${n}`).join(" · ")}`);
  if (newCities.size) console.log(`  NEW cities re-ingest would create: ${[...newCities].map(([s, n]) => `${s}(${n})`).join(", ")}`);
  for (const u of unresolved) console.log(`    ⚠ unchanged · ${u.title} · "${u.addr}"`);

  if (write && aligned && edits) {
    writeFileSync(full, blocks.join(""));
    console.log(`  [write] rewrote ${edits} courts in ${file}`);
  } else if (!write) {
    console.log(`  [dry-run] would rewrite ${affected.length - unresolved.length} courts`);
  }
  return { affected: affected.length, unresolved: unresolved.length };
}

function main() {
  const { state, write } = parseArgs();
  console.log(`Fix source city_slug in data/*.yml${write ? " (WRITE)" : " (DRY RUN)"}`);
  const files = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".yml") && !f.startsWith("_"))
    .filter((f) => !state || f === `${state}.yml`)
    .sort();

  let totAffected = 0;
  let totUnresolved = 0;
  for (const f of files) {
    const r = processFile(f, write);
    if (r) {
      totAffected += r.affected;
      totUnresolved += r.unresolved;
    }
  }
  console.log(`\nTotal: ${totAffected} bucketed · ${totAffected - totUnresolved} resolved · ${totUnresolved} left unchanged`);
  if (!write) console.log("Re-run with --write to apply, then re-ingest.");
}

main();
