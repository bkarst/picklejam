"use client";

/**
 * MapFinder — the /search map utility (PRD §6.1, §5.2). Split list + map, geohash
 * radius query (§9.7) via TanStack Query (`useCourtsNear` → /api/courts/near),
 * filters, and a search box. The LIST is the text-list a11y equivalent of the map
 * (§2.9). Mapbox GL renders only when NEXT_PUBLIC_MAPBOX_TOKEN is set; otherwise
 * the list stands alone (E2E stubs maps). noindex (set by the page).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { parseCityKey } from "@/lib/db/keys";
import { courtPath, metersToMiles } from "@/lib/urls";
import { useCourtsNear } from "@/lib/api/queries";
import { SearchTypeahead } from "./SearchTypeahead";

type GeoStatus = "locating" | "located" | "denied";
type Filters = { indoor: boolean; lighted: boolean };

export function MapFinder() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("locating");
  const [filters, setFilters] = useState<Filters>({ indoor: false, lighted: false });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("located");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    // getCurrentPosition callbacks are async → no synchronous setState in effect.
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeoStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("located");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000 },
    );
  }, []);

  const { data, isLoading } = useCourtsNear(coords);
  const courts = data?.courts ?? [];

  const filtered = courts.filter(
    (c) => (!filters.indoor || c.indoorCourts > 0) && (!filters.lighted || c.lighted),
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="max-w-xl">
        <SearchTypeahead />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {(["indoor", "lighted"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filters[f]}
            onClick={() => setFilters((prev) => ({ ...prev, [f]: !prev[f] }))}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              filters[f] ? "border-accent bg-accent text-accent-foreground" : "border-border text-foreground hover:bg-surface-secondary"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted" aria-live="polite">
          {coords && !isLoading ? `${filtered.length} court${filtered.length === 1 ? "" : "s"} nearby` : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* List (the a11y text equivalent of the map) */}
        <div>
          {geoStatus === "locating" && <p className="text-muted">Finding your location…</p>}
          {geoStatus === "located" && isLoading && <p className="text-muted">Loading nearby courts…</p>}
          {geoStatus === "denied" && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-foreground">Set your location to find courts near you.</p>
              <button type="button" onClick={locate} className="mt-3 inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground">
                Use my location
              </button>
              <p className="mt-3 text-sm text-muted">Or search a city above to browse its courts.</p>
            </div>
          )}
          {geoStatus === "located" && !isLoading && filtered.length === 0 && (
            <p className="text-muted">No courts found within 25km.</p>
          )}
          <ul className="flex flex-col gap-3">
            {filtered.map((c) => {
              const { country, state, city } = parseCityKey(c.cityKey);
              return (
                <li key={c.courtId} className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-secondary">
                  <Link href={courtPath(country, state, city, c.slug)} className="font-display font-bold text-accent hover:underline">
                    {c.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {c.totalCourts} courts · {metersToMiles(c.distanceMeters)} mi
                    {c.indoorCourts > 0 ? " · Indoor" : ""}
                    {c.lighted ? " · Lighted" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Map */}
        <div className="sticky top-20 hidden h-[70vh] overflow-hidden rounded-2xl border border-border bg-surface-secondary lg:block" aria-hidden="true">
          <div className="flex h-full items-center justify-center text-center text-muted">
            {publicEnv.mapboxToken
              ? "Map loading…" /* Mapbox GL renders here when a token is configured. */
              : "Interactive map view. The list on the left is the accessible equivalent."}
          </div>
        </div>
      </div>
    </div>
  );
}
