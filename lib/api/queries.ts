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
import type { Suggestion } from "@/lib/search/suggest";

/** A court returned by /api/courts/near (lite shape + distance). */
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

/** Typeahead suggestions (PLACES + COURTS, §6.1). Debounce `q` at the call site. */
export function useSearchSuggest(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.searchSuggest(term),
    queryFn: ({ signal }) =>
      fetchJson<{ cities: Suggestion[]; courts: Suggestion[] }>(
        `/api/search?q=${encodeURIComponent(term)}`,
        signal,
      ),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData, // keep last results while typing
    staleTime: 5 * 60_000,
  });
}

/** Courts within a radius of a point (GSI4 geohash cover-set, §9.7). */
export function useCourtsNear(coords: { lat: number; lng: number } | null, radius = 25000) {
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
