/**
 * index-store.ts — the precomputed court + city search index (PRD §6.1, §13).
 *
 * Global name autocomplete can't reload all 16k courts per request (that both
 * saturates DynamoDB and blows Next's 2 MB `unstable_cache` limit). Instead the
 * directory is flattened to a compact lite index (~4 MB for the US), persisted
 * as chunked items at ingest, then loaded ONCE into this process and searched in
 * memory. `getSearchIndex` caches it with a TTL and dedupes concurrent builds.
 *
 * Server-context module (route handlers + the ingest CLI); like lib/db/table.ts
 * it deliberately omits `import "server-only"`. The live-traversal fallback is
 * loaded via dynamic import so this module — and the CLI that imports it — never
 * statically pulls in the data layer (and next/cache).
 */

import { query, batchWrite } from "@/lib/db/client";
import type { CourtItem, CityItem } from "@/lib/db/types";

/** Court fields the typeahead needs (compact keys — the whole US index is ~4 MB). */
export interface CourtSearchLite {
  id: string;
  name: string;
  slug: string;
  cityKey: string;
  lat: number;
  lng: number;
  /** totalCourts */
  tc: number;
  /** popularityRank (ranking tie-break) */
  pop: number;
}

/** City fields the typeahead needs. */
export interface CitySearchLite {
  key: string;
  name: string;
  /** counts.locations (ranking tie-break) */
  loc: number;
}

export interface SearchIndex {
  courts: CourtSearchLite[];
  cities: CitySearchLite[];
}

export function courtToLite(c: CourtItem): CourtSearchLite {
  return {
    id: c.courtId,
    name: c.name,
    slug: c.slug,
    cityKey: c.cityKey,
    lat: c.lat,
    lng: c.lng,
    tc: c.totalCourts,
    pop: c.popularityRank ?? 0,
  };
}

export function cityToLite(c: CityItem): CitySearchLite {
  return { key: c.cityKey, name: c.name, loc: c.counts?.locations ?? 0 };
}

const idxPk = (country: string) => `SEARCHIDX#${country}`;
const COURT_PREFIX = "COURTS#";
const CITY_PREFIX = "CITIES#";
// ~160 KB/chunk of CourtSearchLite, comfortably under DynamoDB's 400 KB item cap.
const CHUNK_SIZE = 800;

/**
 * Persist the index as chunked items (called by scripts/ingest.ts after the
 * courts are written). Idempotent by chunk key: re-ingesting the same directory
 * overwrites chunk 0..N in place.
 */
export async function writeSearchIndex(country: string, index: SearchIndex): Promise<void> {
  const pk = idxPk(country);
  const items: Record<string, unknown>[] = [];
  const chunkInto = (prefix: string, arr: unknown[]) => {
    for (let i = 0; i * CHUNK_SIZE < arr.length; i++) {
      const chunk = arr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      items.push({
        pk,
        sk: `${prefix}${String(i).padStart(4, "0")}`,
        data: JSON.stringify(chunk),
        n: chunk.length,
      });
    }
  };
  chunkInto(COURT_PREFIX, index.courts);
  chunkInto(CITY_PREFIX, index.cities);
  await batchWrite(items);
}

async function loadChunks<T>(country: string, prefix: string): Promise<T[]> {
  const out: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const { items, lastKey } = await query<{ data: string }>({
      pk: idxPk(country),
      skBeginsWith: prefix,
      startKey,
    });
    for (const it of items) out.push(...(JSON.parse(it.data) as T[]));
    startKey = lastKey;
  } while (startKey);
  return out;
}

/** Load the precomputed index (a handful of reads); null if not written yet. */
export async function loadSearchIndex(country: string): Promise<SearchIndex | null> {
  const courts = await loadChunks<CourtSearchLite>(country, COURT_PREFIX);
  if (courts.length === 0) return null;
  const cities = await loadChunks<CitySearchLite>(country, CITY_PREFIX);
  return { courts, cities };
}

// In-process cache: built once, refreshed after the TTL; concurrent builds deduped.
const TTL_MS = 10 * 60 * 1000;
let cache: { country: string; index: SearchIndex; at: number } | null = null;
let inflight: Promise<SearchIndex> | null = null;

export async function getSearchIndex(country = "us"): Promise<SearchIndex> {
  if (cache && cache.country === country && Date.now() - cache.at < TTL_MS) return cache.index;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // Prefer the precomputed chunks (a few reads); fall back to a live traversal.
      let index = await loadSearchIndex(country);
      if (!index) {
        const { buildSearchIndex } = await import("./build-index");
        index = await buildSearchIndex(country);
      }
      cache = { country, index, at: Date.now() };
      return index;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
