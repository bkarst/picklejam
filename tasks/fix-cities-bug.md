# Fix bogus "United States" cities (mis-ingested country-as-city buckets)

**Status:** in progress — **PIVOTED to a source fix** (see below). NY DB re-home was
applied as a Dev stopgap (63/76) but a re-ingest would REVERT it. Durable fix = rewrite
`city_slug` in `data/<state>.yml` + re-ingest. Home-page mitigation still in place.
**Area:** directory data / ingest (§9.8 data hygiene)

## Summary

Courts whose city could not be parsed at ingest were bucketed under the **country
name** instead of a real city, producing a bogus **`united-states`** city. The
`GeoAccumulator` then rolled these up into **39 CITY items — one per state** (name
"United States", slug `united-states`, cityKey `us#<state>#united-states`).

The largest bucket (`us#new-york#united-states`, **75 locations · 373 courts**) was
big enough to surface on the homepage "Explore places to play" grid.

## Scope / evidence

- **39** CITY items named "United States" (one per state). Confirm:
  ```
  aws dynamodb scan --table-name PickleLokoAppDevelopment \
    --filter-expression "entity = :e AND #n = :n" \
    --expression-attribute-values '{":e":{"S":"CITY"},":n":{"S":"United States"}}' \
    --expression-attribute-names '{"#n":"name"}' \
    --projection-expression "cityKey, slug, counts"
  ```
- Each is a bucket of COURT items with `cityKey = us#<state>#united-states`.

## Where it surfaces

- [x] **Home page** "Explore places to play" — *mitigated* (see below)
- [ ] **State pages** `/courts/us/<state>` — lists "United States" as a city (via `getCitiesInState`)
- [ ] **Search suggestions** — `City, State, United States` formatting (`lib/search/suggest.ts`)
- [ ] **Sitemap** — 39 indexable junk city pages (`lib/seo/sitemap.ts`)

## Root cause — CONFIRMED (Pickleheads fallback city)

The source YAML itself carries `city_slug: united-states` (+ `path: /courts/us/<state>/united-states/…`).
Pickleheads assigns every court a **city entity** (`city_id` + `city_slug`); when their
geocoder can't resolve a specific city it falls back to a **placeholder "United States"
city, one per state** (evidence: all **76 NY** courts share `city_id 1960105088`; across all
states **239 courts** map to **~39 distinct fallback `city_id`s** ≈ one per state). The court's
*address* still has the real city — only Pickleheads' structured city field bucketed to the
country. We import `city_slug` verbatim, so the flaw rode into our DB.

`mapSeedCourtToItem` buckets by `seed.city_slug` (`lib/ingest/map.ts`); `GeoAccumulator`
(`lib/ingest/pipeline.ts`) then synthesizes one CITY per distinct city_slug → the 39 junk cities.

## Strategy: fix the SOURCE, then re-ingest (supersedes the DB migration)

A re-ingest reads the YAML as-is and would (1) **revert the 63 DB re-homes** — `batchWrite`
is a full `PutItem` that overwrites `cityKey` back to the bucket (and zeroes denormalized
counters) — and (2) **recreate all 39 bucket CITY items**. So the DB migration is a stopgap.

The durable fix rewrites `city_slug` (+ `path`) in `data/<state>.yml` from each court's
address (reusing the re-home resolver), commits it, and re-ingests. This is strictly better:
- Survives re-ingest (it *is* the ingest input); version-controlled + reviewable.
- Fixes **every surface at once** (home, state pages, search, sitemap).
- **Auto-creates the missing standalone-town cities** (Grand Island, Somers, …) — the
  `GeoAccumulator` mints real CityItems from the corrected slugs, solving the "13 towns"
  problem the DB migration couldn't.

**Script:** `scripts/fix-source-cities.ts` — dry-run diff by default; `--write` rewrites the
YAML in place; `--state <slug>` to scope. Ports the resolver from the re-home script; leaves
courts it can't confidently resolve unchanged (reported), so a re-ingest still creates a
(smaller) bucket for the true leftovers rather than mis-homing.

## Interim mitigation (done)

`getTopCities` (`lib/data/geo.ts`) now filters out `slug === "united-states"` via
`isCountryNamedCity`, so the homepage grid is clean. This is a band-aid — it does NOT
touch state pages, search, or the sitemap. A `TODO` marks it in code.

## Audit findings — `us#new-york#united-states` (done 2026-07-06)

**76 courts. 100% recoverable — none need discarding.**

- **All 76 have an address**; **all 76 lat/lng fall inside the NY bounding box** — the
  courts are correctly located in New York; only the *city-level* bucketing is wrong.
- **72/76** yield a real city with a trivial `", <City>, NY"` parse. The other **4** are
  still recoverable with a looser parser (edge formats: "…, New York 13031" spelled out;
  no-comma "1 Wall St Clifton Park NY 12065"; county form "Kings County … 11220" → Brooklyn).
- Real-city distribution (top): **Brooklyn 19, Queens 9, Staten Island 6, The Bronx 4,
  Long Island City 3**, then a long tail (Clifton Park, Fresh Meadows, Glendale, Grand
  Island, Camillus, Somers, Rhinebeck, …).
- **Most targets already exist** as CityItems (NY has 361 real cities): `brooklyn`,
  `queens`, `staten-island`, `bronx`, `clifton-park`, `camillus` all EXIST. A few are
  **missing** (`long-island-city`, `somers`) → create, or merge into nearest existing.
- **Naming normalization needed**: address "The Bronx" slugifies to `the-bronx` but the
  existing city slug is `bronx`; NYC boroughs are modeled as separate cities (not one
  `new-york`). A re-home must map borough/alias names to existing slugs.

**Conclusion:** the fix is a **re-home migration** (reassign each court's `cityKey` +
GSI2 keys to its real city, re-roll CITY/STATE counts, delete the emptied `united-states`
buckets). No reverse-geocoding needed for NY — addresses suffice. Expect the other 38
state buckets to be similar; spot-check a non-NYC state before generalizing.

## Migration script + dry-runs (2026-07-06)

**Script:** `scripts/rehome-united-states-courts.ts` — dry-run by default; `--apply` to
write; `--state <slug>` for one bucket (else all). Re-home = in-place `UpdateItem` of
`cityKey` + `gsi2pk` (`inCity`) + `gsi3pk` (`bySlug`); target CITY `counts` bumped;
emptied bucket deleted with `state.cities`/`country.cities` −1. **Conservative:** only
re-homes to cities that already exist; unparseable / missing-city courts are left in place.

```
npx tsx --env-file=.env scripts/rehome-united-states-courts.ts --state new-york          # dry-run
npx tsx --env-file=.env scripts/rehome-united-states-courts.ts --state new-york --apply
```

**Resolver** (in the script) resolves an address to an existing city via: county→borough
(`Kings County → brooklyn`), direct slug, `the-` strip, Queens-neighborhood→`queens` alias
(`QUEENS_NEIGHBORHOODS`), then a space-token tail-suffix match (no-comma addresses).

**NY — APPLIED 2026-07-06:** 76 → **63 re-homed**, 0 collisions
(`direct=43 · the-strip=4 · queens-nbhd=14 · suffix-2=1 · county=1`): queens 23, brooklyn 20,
staten-island 6, bronx 5, clifton-park 3, + camillus/glens-falls/williamsville/queensbury/
commack/delmar. Verified: bucket 76→13; queens counts 24/91, brooklyn 23/100; moved court
resolves at new URL (200), old bucket URL 404s. **Bucket kept** (13 remain) so `state.cities`
unchanged.

**Remaining NY: 13 standalone towns** (no CityItem) — Almond, Grahamsville, Halfmoon,
Somers×2, Rhinebeck, Paris/Sauquoit×2, Stony Point, Grand Island×2, Levittown, Cheektowaga.
**Decision:** create a CityItem per town (centroid/geohash/nearby), or merge into nearest.
Until then they stay in the NY bucket (which therefore still shows on the NY state page).

**Other 38 state buckets:** not yet processed. Spot-checks (TX 11, CA 8) confirm the same
shape; re-run the script per state (`--state <slug>`), expecting a small standalone-town tail
each. NYC alias logic is NY-specific but harmless elsewhere.

## Plan (durable source fix)

1. ~~Audit NY bucket~~ · ~~build resolver + DB re-home (Dev stopgap)~~ — done.
2. **`scripts/fix-source-cities.ts`** — rewrite `city_slug`/`path` in `data/*.yml` from
   addresses. Dry-run diff first (review the `united-states → <city>` mapping), then `--write`.
3. **Re-ingest** `npx tsx --env-file=.env scripts/ingest.ts` — rebuilds courts with correct
   cities; `GeoAccumulator` mints real CityItems (incl. standalone towns); the 39 buckets
   shrink to only true leftovers (or vanish). NOTE: re-ingest resets denormalized counters
   (reviewCount/ratingAvg/checkins/players/groups + facilityScore is recomputed) — fine in
   Dev; for Prod, sequence with the counter-rebuild story ([[aggregator-not-counter-source]]).
4. Remove the interim `isCountryNamedCity` filter in `getTopCities` once data is clean.
5. (Optional) leftover true-unresolved courts: reverse-geocode lat/lng or hide.

## Acceptance criteria

- No `united-states` city appears on home, state pages, search, or sitemap.
- Affected courts are correctly homed to real cities in the SOURCE YAML (survives re-ingest).
- A fresh ingest of `data/<state>.yml` produces **zero** country-named cities (or only a tiny
  reviewed leftover set).

## Pointers

- `lib/data/geo.ts` — `getTopCities` (mitigation), `getCitiesInState`
- `lib/ingest/map.ts` — `mapSeedCourtToItem` (city bucketing)
- `lib/ingest/pipeline.ts` — `GeoAccumulator` (city synthesis), `COUNTRY_NAMES`
- `lib/search/suggest.ts`, `lib/seo/sitemap.ts` — downstream surfaces
- Table: `PickleLokoAppDevelopment` (`us-east-1`); Prod has the same bug if ingested from the same source
