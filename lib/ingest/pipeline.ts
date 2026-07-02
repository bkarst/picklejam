/**
 * pipeline.ts — pure geo rollup for seed ingestion (PRD §9.8, §9.4 batch path).
 *
 * As COURT items are mapped, a `GeoAccumulator` tallies per-city / per-state /
 * per-country counts and city centroids, then `finalize()` emits the
 * CITY/STATE/COUNTRY items with `counts` computed directly (the batch path — NOT
 * per-item Streams, which would double-count the bulk import). `nearbyCityKeys`
 * are the nearest cities within the same state by centroid distance.
 */

import { geoKeys, cityKeyOf } from "@/lib/db/keys";
import { encodeGeohash, haversineMeters } from "@/lib/geo/geohash";
import { slugify } from "@/lib/util/slug";
import type { CourtItem, CityItem, StateItem, CountryItem } from "@/lib/db/types";

/** Title-case a slug for display ("overland-park" → "Overland Park"). */
export function titleize(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const COUNTRY_NAMES: Record<string, string> = { us: "United States" };

interface CityAccum {
  country: string;
  state: string;
  citySlug: string;
  locations: number; // indexable venues
  courts: number; // sum of totalCourts
  latSum: number;
  lngSum: number;
  n: number;
}
interface StateAccum {
  country: string;
  stateSlug: string;
  stateName: string;
  locations: number;
  courts: number;
  cityKeys: Set<string>;
}
interface CountryAccum {
  country: string;
  locations: number;
  courts: number;
  cityKeys: Set<string>;
  stateKeys: Set<string>;
}

export interface GeoItems {
  countries: CountryItem[];
  states: StateItem[];
  cities: CityItem[];
}

/** Accumulates geo rollups across all ingested courts. */
export class GeoAccumulator {
  private cities = new Map<string, CityAccum>();
  private states = new Map<string, StateAccum>();
  private countries = new Map<string, CountryAccum>();

  constructor(
    /** Nearest-N cities (same state) to record on each city. */
    private nearbyLimit = 8,
    private now = "2026-06-30T00:00:00.000Z",
  ) {}

  /** Tally a mapped court. `stateName` comes from the state-file header. */
  ingest(court: CourtItem, stateName: string): void {
    if (court.deleted || court.hidden || !court.hasPickleball) return;
    const { country, state, city } = splitCityKey(court.cityKey);
    const indexable = court.indexable !== false;

    const c = this.cities.get(court.cityKey) ?? {
      country, state, citySlug: city, locations: 0, courts: 0, latSum: 0, lngSum: 0, n: 0,
    };
    if (indexable) {
      c.locations += 1;
      c.courts += court.totalCourts;
    }
    c.latSum += court.lat;
    c.lngSum += court.lng;
    c.n += 1;
    this.cities.set(court.cityKey, c);

    const stateKey = `${country}#${state}`;
    const s = this.states.get(stateKey) ?? {
      country, stateSlug: state, stateName, locations: 0, courts: 0, cityKeys: new Set<string>(),
    };
    if (indexable) {
      s.locations += 1;
      s.courts += court.totalCourts;
      s.cityKeys.add(court.cityKey);
    }
    this.states.set(stateKey, s);

    const co = this.countries.get(country) ?? {
      country, locations: 0, courts: 0, cityKeys: new Set<string>(), stateKeys: new Set<string>(),
    };
    if (indexable) {
      co.locations += 1;
      co.courts += court.totalCourts;
      co.cityKeys.add(court.cityKey);
      co.stateKeys.add(stateKey);
    }
    this.countries.set(country, co);
  }

  /** Emit the CITY/STATE/COUNTRY items with computed counts + nearby cities. */
  finalize(): GeoItems {
    const cityItems: CityItem[] = [];
    // Precompute centroids per state for nearby-city search.
    const byState = new Map<string, { cityKey: string; lat: number; lng: number }[]>();
    for (const [cityKey, c] of this.cities) {
      const lat = c.latSum / c.n;
      const lng = c.lngSum / c.n;
      const sk = `${c.country}#${c.state}`;
      const arr = byState.get(sk) ?? [];
      arr.push({ cityKey, lat, lng });
      byState.set(sk, arr);
    }

    for (const [cityKey, c] of this.cities) {
      if (c.locations === 0) continue; // no indexable venue → no city page
      const lat = c.latSum / c.n;
      const lng = c.lngSum / c.n;
      const peers = byState.get(`${c.country}#${c.state}`) ?? [];
      const nearby = peers
        .filter((p) => p.cityKey !== cityKey)
        .map((p) => ({ cityKey: p.cityKey, d: haversineMeters(lat, lng, p.lat, p.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, this.nearbyLimit)
        .map((p) => p.cityKey);

      cityItems.push({
        ...geoKeys.city(c.country, c.state, c.citySlug),
        entity: "CITY",
        cityKey,
        name: titleize(c.citySlug),
        slug: c.citySlug,
        country: c.country,
        state: c.state,
        centroidLat: lat,
        centroidLng: lng,
        geohash: encodeGeohash(lat, lng, 9),
        nearbyCityKeys: nearby,
        counts: { locations: c.locations, courts: c.courts },
        updatedAt: this.now,
      });
    }

    const stateItems: StateItem[] = [];
    for (const s of this.states.values()) {
      if (s.locations === 0) continue;
      stateItems.push({
        ...geoKeys.state(s.country, s.stateSlug),
        entity: "STATE",
        country: s.country,
        code: s.stateSlug,
        name: s.stateName || titleize(s.stateSlug),
        slug: s.stateSlug,
        counts: { locations: s.locations, courts: s.courts, cities: s.cityKeys.size },
        updatedAt: this.now,
      });
    }

    const countryItems: CountryItem[] = [];
    for (const co of this.countries.values()) {
      if (co.locations === 0) continue;
      countryItems.push({
        ...geoKeys.country(co.country),
        entity: "COUNTRY",
        code: co.country,
        name: COUNTRY_NAMES[co.country] ?? co.country.toUpperCase(),
        counts: {
          locations: co.locations,
          courts: co.courts,
          cities: co.cityKeys.size,
          states: co.stateKeys.size,
        },
        updatedAt: this.now,
      });
    }

    return { countries: countryItems, states: stateItems, cities: cityItems };
  }
}

function splitCityKey(cityKey: string): { country: string; state: string; city: string } {
  const [country, state, city] = cityKey.split("#");
  return { country, state, city };
}

/** Re-export for symmetry so callers can build a cityKey without importing keys. */
export { cityKeyOf, slugify };
