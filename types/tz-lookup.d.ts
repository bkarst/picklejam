/**
 * Ambient types for `tz-lookup` (ships no types, and there is no @types package).
 * The default export maps a coordinate to its IANA timezone name (a real zone such
 * as `America/New_York`, so it carries DST + political/half-hour offset rules).
 * Throws a RangeError for latitudes/longitudes outside the valid range.
 */
declare module "tz-lookup" {
  export default function tzLookup(lat: number, lon: number): string;
}
