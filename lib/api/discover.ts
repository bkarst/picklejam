"use client";

/**
 * discover.ts — client API for the unified "near me" finder (groups / leagues /
 * ladders / tournaments). Public reads (no auth), so plain `fetch` through TanStack
 * Query; mirrors `lib/api/queries.ts`. `useDiscover` fetches a city's enriched
 * entity list; `useNearestCity` resolves the browser's coordinates to a city.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { DiscoverEntityType, DiscoverItem } from "@/lib/search/discover-filters";

export interface DiscoverResponse {
  cityKey: string;
  cityLabel: string;
  items: DiscoverItem[];
}

export interface NearestCity {
  cityKey: string;
  label: string;
}

export const discoverKeys = {
  list: (type: DiscoverEntityType, cityKey: string) => ["discover", type, cityKey] as const,
  nearest: (lat: number | null, lng: number | null) => ["geo-nearest", lat, lng] as const,
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Enriched entities of `type` near a `cityKey` (the city + nearby cities). */
export function useDiscover(type: DiscoverEntityType, cityKey: string | null) {
  return useQuery<DiscoverResponse>({
    queryKey: discoverKeys.list(type, cityKey ?? ""),
    queryFn: ({ signal }) =>
      getJson<DiscoverResponse>(
        `/api/discover?type=${type}&cityKey=${encodeURIComponent(cityKey!)}`,
        signal,
      ),
    enabled: !!cityKey,
    placeholderData: keepPreviousData, // keep the list while switching type/city
    staleTime: 60_000,
  });
}

/** Resolve the browser's coordinates → nearest discoverable city. */
export function useNearestCity(coords: { lat: number; lng: number } | null) {
  const rlat = coords ? Math.round(coords.lat * 1000) / 1000 : null;
  const rlng = coords ? Math.round(coords.lng * 1000) / 1000 : null;
  return useQuery<NearestCity>({
    queryKey: discoverKeys.nearest(rlat, rlng),
    queryFn: ({ signal }) => getJson<NearestCity>(`/api/geo/nearest?lat=${rlat}&lng=${rlng}`, signal),
    enabled: rlat !== null && rlng !== null,
    staleTime: 10 * 60_000,
  });
}
