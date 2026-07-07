"use client";

/**
 * MapFinder — the /search map utility (PRD §6.1, §5.2). Split list + map, geohash
 * radius query (§9.7) via TanStack Query (`useCourtsNear` → /api/courts/near),
 * filters, and a search box. The LIST is the text-list a11y equivalent of the map
 * (§2.9). Mapbox GL renders only when NEXT_PUBLIC_MAPBOX_TOKEN is set; otherwise
 * the list stands alone (E2E stubs maps). noindex (set by the page).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import "mapbox-gl/dist/mapbox-gl.css";
import { palette } from "@/brand.config";
import { publicEnv } from "@/lib/env";
import { parseCityKey } from "@/lib/db/keys";
import { courtPath, metersToMiles } from "@/lib/urls";
import { Slider, useOverlayState } from "@heroui/react";
import { DEFAULT_NEAR_RADIUS_M, MAX_NEAR_RADIUS_M, MILES_TO_METERS } from "@/lib/geo/constants";
import { useCourtsNear, type NearCourt } from "@/lib/api/queries";
import {
  activeFilterCount,
  type CourtFilters,
  EMPTY_FILTERS,
  filterCourts,
} from "@/lib/search/court-filters";
import { FacilityRating, facilityTierLabel } from "@/components/directory";
import { SearchTypeahead } from "./SearchTypeahead";
import { MoreFiltersDrawer } from "./MoreFiltersDrawer";

type GeoStatus = "locating" | "located" | "denied";

// mapbox-gl is loaded lazily (client-only) inside an effect, so these are typed
// against the module without eagerly importing it into the SSR bundle.
type MapboxModule = (typeof import("mapbox-gl"))["default"];
type MapInstance = import("mapbox-gl").Map;
type MapMarker = import("mapbox-gl").Marker;

const PIN_COLOR = palette.forest; // brand Forest (§2.3 single source of truth)
const PIN_DOT = palette.lime; // brand Lime

const DEFAULT_RADIUS_MI = Math.round(DEFAULT_NEAR_RADIUS_M / MILES_TO_METERS); // 15
const MAX_RADIUS_MI = Math.round(MAX_NEAR_RADIUS_M / MILES_TO_METERS); // 50

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
}

/** A forest-green teardrop pin with a lime center (matches design 4.2). */
function makePinElement(): HTMLDivElement {
  // Mapbox positions the marker by writing `transform: translate(...)` onto THIS
  // (outer) element on every map move. The hover animation therefore lives on an
  // inner wrapper — mutating the outer transform would clobber the map positioning
  // and fling the pin to the corner. transform-origin bottom-center keeps it
  // anchored to the pin tip while scaling.
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;line-height:0;";
  const inner = document.createElement("span");
  inner.style.cssText =
    "display:block;line-height:0;transform-origin:bottom center;transition:transform .12s ease;";
  inner.innerHTML = `<svg width="26" height="34" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"><path d="M14 0C6.27 0 0 6.09 0 13.6 0 23.8 14 36 14 36s14-12.2 14-22.4C28 6.09 21.73 0 14 0z" fill="${PIN_COLOR}"/><circle cx="14" cy="13.5" r="4.8" fill="${PIN_DOT}"/></svg>`;
  el.appendChild(inner);
  el.addEventListener("mouseenter", () => (inner.style.transform = "scale(1.16) translateY(-2px)"));
  el.addEventListener("mouseleave", () => (inner.style.transform = "none"));
  return el;
}

function popupHtml(c: NearCourt, href: string): string {
  const meta =
    `${c.totalCourts} court${c.totalCourts === 1 ? "" : "s"} · ${metersToMiles(c.distanceMeters)} mi` +
    `${c.indoorCourts > 0 ? " · Indoor" : ""}${c.lighted ? " · Lighted" : ""}`;
  const facility = `${facilityTierLabel(c.facilityTier)} · ${c.facilityScore}/100`;
  return `<div style="min-width:172px">
    <div style="font-weight:700;color:${PIN_COLOR};font-size:14px;line-height:1.25">${escapeHtml(c.name)}</div>
    <div style="margin-top:3px;font-size:12px;color:#6b7280">${escapeHtml(meta)}</div>
    <div style="margin-top:4px;font-size:12px;font-weight:600;color:${PIN_COLOR}">${escapeHtml(facility)}</div>
    <a href="${escapeHtml(href)}" style="display:inline-block;margin-top:7px;font-size:13px;font-weight:600;color:${PIN_COLOR};text-decoration:none">View →</a>
  </div>`;
}

export function MapFinder() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("locating");
  const [filters, setFilters] = useState<CourtFilters>(EMPTY_FILTERS);
  // `radiusMi` feeds the query (committed on drag end); `radiusDisplay` tracks the
  // thumb live so the label updates while dragging without refetching every tick.
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI);
  const [radiusDisplay, setRadiusDisplay] = useState(DEFAULT_RADIUS_MI);
  const filtersDrawer = useOverlayState();

  // Quick pills (Indoor / Lighted) toggle membership in the shared `types` facet,
  // so a pill and its More-Filters checkbox stay in sync (one source of truth).
  const toggleType = useCallback(
    (t: string) =>
      setFilters((prev) => ({
        ...prev,
        types: prev.types.includes(t) ? prev.types.filter((x) => x !== t) : [...prev.types, t],
      })),
    [],
  );

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

  const { data, isLoading } = useCourtsNear(coords, Math.round(radiusMi * MILES_TO_METERS));

  const filtered = useMemo(() => filterCourts(data?.courts ?? [], filters), [data, filters]);
  const activeCount = activeFilterCount(filters);

  // ── Mapbox GL (client-only, loaded lazily) ──
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const mapboxRef = useRef<MapboxModule | null>(null);
  const markersRef = useRef<MapMarker[]>([]);
  const coordsRef = useRef(coords);
  const [mapReady, setMapReady] = useState(false);

  // Keep the latest coords available to the init effect without re-running it.
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  // Initialize the map once the panel is visible (it is hidden below `lg`, where
  // the list is the accessible equivalent). A ResizeObserver both defers init
  // until the container has a size and keeps the map sized as the panel changes.
  useEffect(() => {
    if (!publicEnv.mapboxToken) return;
    const container = mapContainerRef.current;
    if (!container) return;
    let cancelled = false;

    const tryInit = async () => {
      if (cancelled || mapRef.current || !container.offsetWidth) return;
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || mapRef.current) return;
      mapboxRef.current = mapboxgl;
      mapboxgl.accessToken = publicEnv.mapboxToken;
      const start = coordsRef.current;
      const map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: start ? [start.lng, start.lat] : [-98.5, 39.8],
        zoom: start ? 11 : 3.4,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "bottom-right",
      );
      map.on("load", () => {
        if (!cancelled) setMapReady(true);
      });
      mapRef.current = map;
    };

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
      else void tryInit();
    });
    ro.observe(container);
    void tryInit();

    return () => {
      cancelled = true;
      ro.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers with the filtered courts; fit the viewport to them.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !mapReady) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (filtered.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const c of filtered) {
      if (typeof c.lat !== "number" || typeof c.lng !== "number") continue;
      const { country, state, city } = parseCityKey(c.cityKey);
      const popup = new mapboxgl.Popup({ offset: 22, closeButton: true, maxWidth: "260px" }).setHTML(
        popupHtml(c, courtPath(country, state, city, c.slug)),
      );
      const marker = new mapboxgl.Marker({ element: makePinElement(), anchor: "bottom" })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([c.lng, c.lat]);
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 600 });
  }, [filtered, mapReady]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      {/* Search input + More Filters, aligned on one row (button pinned upper-right). */}
      <div className="flex items-center justify-between gap-3">
        <div className="max-w-xl grow">
          <SearchTypeahead />
        </div>
        <button
          type="button"
          onClick={filtersDrawer.open}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
          </svg>
          More Filters
          {activeCount > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {(["indoor", "lighted"] as const).map((f) => {
          const active = filters.types.includes(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(f)}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-foreground hover:bg-surface-secondary"
              }`}
            >
              {f}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-muted" aria-live="polite">
          {coords && !isLoading ? `${filtered.length} court${filtered.length === 1 ? "" : "s"} nearby` : ""}
        </span>
      </div>

      {/* Search radius — expand/reduce how far "nearby" reaches. */}
      <div className="flex items-center gap-4">
        <span className="shrink-0 text-sm font-medium text-foreground">
          Radius: <span className="tabular-nums">{radiusDisplay}</span> mi
        </span>
        <Slider
          aria-label="Search radius in miles"
          value={radiusDisplay}
          onChange={(v) => setRadiusDisplay(Array.isArray(v) ? v[0] : v)}
          onChangeEnd={(v) => setRadiusMi(Array.isArray(v) ? v[0] : v)}
          minValue={1}
          maxValue={MAX_RADIUS_MI}
          step={1}
          className="w-full max-w-sm"
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
      </div>

      <MoreFiltersDrawer
        isOpen={filtersDrawer.isOpen}
        onOpenChange={filtersDrawer.setOpen}
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
      />

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
            <p className="text-muted">No courts found within {radiusMi} mi.</p>
          )}
          <ul className="flex flex-col gap-3">
            {filtered.map((c) => {
              const { country, state, city } = parseCityKey(c.cityKey);
              return (
                <li key={c.courtId} className="rounded-xl border border-border bg-surface p-4 hover:bg-surface-secondary">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={courtPath(country, state, city, c.slug)} className="font-display font-bold text-accent hover:underline">
                      {c.name}
                    </Link>
                    <FacilityRating variant="compact" score={c.facilityScore} tier={c.facilityTier} className="mt-0.5 shrink-0" />
                  </div>
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

        {/* Map (the list on the left is its accessible equivalent) */}
        <div className="sticky top-20 hidden h-[70vh] overflow-hidden rounded-2xl border border-border bg-surface-secondary lg:block" aria-hidden="true">
          {publicEnv.mapboxToken ? (
            <div className="relative h-full w-full">
              <div ref={mapContainerRef} className="h-full w-full" />
              {!mapReady && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted">
                  Map loading…
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-muted">
              Interactive map view. The list on the left is the accessible equivalent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
