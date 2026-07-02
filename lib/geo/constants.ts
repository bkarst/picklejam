/**
 * constants.ts — shared geo constants (client-safe; NO `ngeohash` import).
 *
 * The GSI4 partition precision is used at BOTH write time (lib/db/keys.ts →
 * `gsi4pk`) and query time (lib/geo/geohash.ts → `coverSet`); it lives here so
 * those two stay in lockstep, and so client bundles (which import keys.ts for
 * URL/cityKey helpers, and queries.ts for the "near" radius) don't pull in the
 * `ngeohash` dependency that lib/geo/geohash.ts carries.
 */

/** GSI4 partition precision (4 chars ≈ 39km × 20km cell). See geohash.ts. */
export const GEO_PARTITION_PRECISION = 4;

/** "Near me" radii are a product concept in MILES; convert at the edges. */
export const MILES_TO_METERS = 1609.344;
/** Default "near me" radius — 15 miles. */
export const DEFAULT_NEAR_RADIUS_M = Math.round(15 * MILES_TO_METERS); // 24_140
/** Cap on the "near me" radius — 50 miles. */
export const MAX_NEAR_RADIUS_M = Math.round(50 * MILES_TO_METERS); // 80_467
