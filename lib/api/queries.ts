"use client";

/**
 * queries.ts — the client-side API layer (TanStack Query).
 *
 * Every client → /api/* call goes through a typed hook here: caching, request
 * dedup, `AbortController` wiring, and loading/error states are handled by
 * TanStack Query (server components still read the DB directly — those aren't
 * "API calls"). Query keys are centralized so they can be invalidated coherently.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { DEFAULT_NEAR_RADIUS_M } from "@/lib/geo/constants";
import type { Suggestion } from "@/lib/search/suggest";

/** A court returned by /api/courts/near (lite shape + distance + facet fields). */
export interface NearCourt {
  courtId: string;
  name: string;
  cityKey: string;
  slug: string;
  lat: number;
  lng: number;
  totalCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  access: string | null;
  lighted: boolean;
  // facility-quality rating (setup-only, §9.8) — denormalized at ingest
  facilityScore: number;
  facilityTier: number;
  // facet fields (§6.1 More Filters)
  dedicated: boolean;
  hasReservations: boolean;
  facilityType: string | null;
  amenities: string[];
  surface: string[];
  // Community frontier facets (§G12.10)
  reviewCount: number;
  hasTrailblazer: boolean;
  distanceMeters: number;
}

export const queryKeys = {
  searchSuggest: (q: string) => ["search-suggest", q] as const,
  courtsNear: (lat: number, lng: number, radius: number) =>
    ["courts-near", lat, lng, radius] as const,
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Typeahead suggestions (PLACES + COURTS, §6.1). Debounce `q` at the call site.
 * Optional `coords` add distance + nearest-first ranking to court results;
 * they're rounded (~100 m) so GPS jitter doesn't churn the query key.
 */
export function useSearchSuggest(q: string, coords?: { lat: number; lng: number } | null) {
  const term = q.trim();
  const rlat = coords ? Math.round(coords.lat * 1000) / 1000 : undefined;
  const rlng = coords ? Math.round(coords.lng * 1000) / 1000 : undefined;
  return useQuery({
    queryKey: [...queryKeys.searchSuggest(term), rlat ?? null, rlng ?? null],
    queryFn: ({ signal }) => {
      const loc = rlat !== undefined ? `&lat=${rlat}&lng=${rlng}` : "";
      return fetchJson<{ cities: Suggestion[]; courts: Suggestion[] }>(
        `/api/search?q=${encodeURIComponent(term)}${loc}`,
        signal,
      );
    },
    // ≥2 chars → global name search; empty + coords → location-aware prepopulate.
    enabled: term.length >= 2 || (term.length === 0 && rlat !== undefined),
    placeholderData: keepPreviousData, // keep last results while typing
    staleTime: 5 * 60_000,
  });
}

/** Courts within a radius of a point (GSI4 geohash cover-set, §9.7). */
export function useCourtsNear(
  coords: { lat: number; lng: number } | null,
  radius = DEFAULT_NEAR_RADIUS_M,
) {
  return useQuery({
    queryKey: coords
      ? queryKeys.courtsNear(coords.lat, coords.lng, radius)
      : ["courts-near", "disabled"],
    queryFn: ({ signal }) =>
      fetchJson<{ courts: NearCourt[] }>(
        `/api/courts/near?lat=${coords!.lat}&lng=${coords!.lng}&radius=${radius}`,
        signal,
      ),
    enabled: !!coords,
    staleTime: 5 * 60_000,
  });
}
