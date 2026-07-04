import { describe, it, expect } from "vitest";
import {
  writeSearchIndex,
  loadSearchIndex,
  type CourtSearchLite,
  type CitySearchLite,
} from "@/lib/search/index-store";

/**
 * Search index chunk store against DynamoDB Local (§6.1/§13). Skipped without
 * DYNAMODB_ENDPOINT. A per-run synthetic country isolates the SEARCHIDX partition.
 *
 * M29: a cleaned re-ingest that produces FEWER chunks must drop the leftover
 * higher-numbered chunks — else `loadChunks` concatenates them and deleted courts/cities
 * resurface in typeahead.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;
const RUN = Math.random().toString(36).slice(2, 8);
const COUNTRY = `zz${RUN}`;

const court = (i: number): CourtSearchLite => ({
  id: `c${i}`,
  name: `Court ${i}`,
  slug: `court-${i}`,
  cityKey: "zz#s#c",
  lat: 0,
  lng: 0,
  tc: 1,
  pop: 0,
});
const city = (i: number): CitySearchLite => ({ key: `zz#s#city${i}`, name: `City ${i}`, loc: 0 });

d("search index re-ingest prune (DynamoDB Local)", () => {
  it("M29: a smaller re-ingest drops stale chunks (deleted courts don't resurface)", async () => {
    // First ingest: 2000 courts (chunks 0,1,2 at CHUNK_SIZE 800) + 1200 cities (chunks 0,1).
    await writeSearchIndex(COUNTRY, {
      courts: Array.from({ length: 2000 }, (_, i) => court(i)),
      cities: Array.from({ length: 1200 }, (_, i) => city(i)),
    });
    let loaded = await loadSearchIndex(COUNTRY);
    expect(loaded?.courts).toHaveLength(2000);
    expect(loaded?.cities).toHaveLength(1200);

    // Cleaned re-ingest: 300 courts (chunk 0 only) + 100 cities (chunk 0 only). Courts
    // c300..c1999 and cities city100..city1199 are gone.
    await writeSearchIndex(COUNTRY, {
      courts: Array.from({ length: 300 }, (_, i) => court(i)),
      cities: Array.from({ length: 100 }, (_, i) => city(i)),
    });
    loaded = await loadSearchIndex(COUNTRY);

    // Pre-fix: the old chunks 1,2 (courts) and chunk 1 (cities) lingered → 1500 courts /
    // 500 cities, with removed rows resurfacing. Post-fix: exactly the shrunk index.
    expect(loaded?.courts).toHaveLength(300);
    expect(loaded?.cities).toHaveLength(100);
    expect(loaded?.courts.some((c) => c.id === "c1999")).toBe(false); // a deleted court is gone
    expect(loaded?.cities.some((c) => c.key === "zz#s#city1199")).toBe(false);
  });
});
