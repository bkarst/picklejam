"use client";

/**
 * DiscoverFinder — the unified "near me" finder for groups / leagues / ladders /
 * tournaments (PRD §6.9/§7.x). A single page, four entity types via a segmented
 * switch. Location is a city (these entities are city-indexed, not geohash-indexed):
 * pick a city with the typeahead, or "Use my location" resolves your coordinates to
 * the nearest city. Filters — min size, min average DUPR, and min games-last-month
 * (activity, hidden for one-off tournaments) — apply client-side over the enriched
 * results, exactly like the court finder filters its `useCourtsNear` set.
 *
 * All controls are HeroUI where one fits (ToggleButtonGroup, Select) and the city
 * picker reuses the account combobox. Mobile + desktop; Skeletons while loading.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListBox, Select, Skeleton, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { CityPicker } from "@/components/account/CityPicker";
import { DiscoverCard } from "@/components/discover/DiscoverCard";
import { useDiscover, useNearestCity } from "@/lib/api/discover";
import { groupNewPath, organizeLeagueNew, organizeTournamentNew } from "@/lib/urls";
import {
  ACTIVITY_OPTIONS,
  activeDiscoverFilterCount,
  activityApplies,
  DUPR_OPTIONS,
  EMPTY_DISCOVER_FILTERS,
  ENTITY_TYPES,
  filterDiscoverItems,
  matchesNameQuery,
  SIZE_OPTIONS,
  type DiscoverEntityType,
  type DiscoverFilters,
} from "@/lib/search/discover-filters";

const TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-field px-3 text-left text-sm text-field-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <label className="flex min-w-32 flex-1 flex-col gap-1 sm:flex-none">
      <span className="text-xs font-medium text-muted">{label}</span>
      <Select
        aria-label={label}
        selectedKey={String(value)}
        onSelectionChange={(k) => onChange(Number(k))}
        className="w-full sm:w-40"
      >
        <Select.Trigger className={TRIGGER}>
          <Select.Value className="truncate" />
          <Select.Indicator className="size-4 shrink-0 text-muted" />
        </Select.Trigger>
        <Select.Popover className="rounded-xl border border-border bg-overlay p-1 shadow-overlay">
          <ListBox aria-label={label} className="max-h-64 overflow-auto outline-none">
            {options.map((o) => (
              <ListBox.Item
                key={o.value}
                id={String(o.value)}
                textValue={o.label}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[focused]:bg-surface-secondary"
              >
                {o.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </label>
  );
}

function LocationIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** The size facet's label per entity type ("Members" for groups, else "Players"). */
function sizeLabel(type: DiscoverEntityType): string {
  return type === "groups" ? "Members" : "Players";
}

/** "Create your own" CTA per entity — shown when the finder turns up nothing.
 *  Leagues + ladders share the organizer wizard (a format toggle). */
const CREATE_CTA: Record<DiscoverEntityType, { href: string; label: string }> = {
  groups: { href: groupNewPath(), label: "Start a group" },
  leagues: { href: organizeLeagueNew(), label: "Run a league" },
  ladders: { href: organizeLeagueNew(), label: "Run a ladder" },
  tournaments: { href: organizeTournamentNew(), label: "Run a tournament" },
};

export function DiscoverFinder(): JSX.Element {
  const params = useSearchParams();
  const initialType = ENTITY_TYPES.find((t) => t.id === params.get("type"))?.id ?? "groups";

  const [type, setType] = useState<DiscoverEntityType>(initialType);
  const [cityKey, setCityKey] = useState<string | undefined>(undefined);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_DISCOVER_FILTERS);
  const [query, setQuery] = useState("");
  // We auto-default the city to the viewer's nearest city exactly ONCE; after that the
  // user owns the field (pick / clear freely). `applyNextResolve` lets the explicit
  // "Use my location" button apply a fresh resolution.
  const didAutoLocate = useRef(false);
  const applyNextResolve = useRef(false);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoError("Location isn't available here — pick a city instead.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("We couldn't get your location — pick a city instead."),
      { timeout: 8000 },
    );
  }, []);

  // Ask once on mount so the page prepopulates to the visitor's metro when allowed.
  // Inlined (not via requestLocation) so setState only fires in the async callbacks.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError("We couldn't get your location — pick a city instead."),
      { timeout: 8000 },
    );
  }, []);

  const nearest = useNearestCity(coords);

  // Keyed on `nearest.data` ONLY (not cityKey), so clearing the field never snaps
  // back: apply an explicit "Use my location" resolution, else auto-default the city
  // just once on the first geolocation (and only if none is chosen yet).
  useEffect(() => {
    const near = nearest.data;
    if (!near) return;
    if (applyNextResolve.current) {
      applyNextResolve.current = false;
      didAutoLocate.current = true;
      setCityKey(near.cityKey);
      return;
    }
    if (!didAutoLocate.current) {
      didAutoLocate.current = true;
      setCityKey((cur) => cur ?? near.cityKey);
    }
  }, [nearest.data]);

  const useMyLocation = () => {
    applyNextResolve.current = true; // apply the next (possibly fresh) resolution
    if (nearest.data) setCityKey(nearest.data.cityKey); // and immediately if cached
    requestLocation();
  };

  const { data, isLoading, isError } = useDiscover(type, cityKey ?? null);
  const filtered = filterDiscoverItems(data?.items ?? [], filters).filter((it) =>
    matchesNameQuery(it, query),
  );
  const activeCount = activeDiscoverFilterCount(filters, type);
  const typeMeta = ENTITY_TYPES.find((t) => t.id === type)!;
  const typeLabel = typeMeta.label.toLowerCase();
  const countNoun = filtered.length === 1 ? typeMeta.singular : typeLabel;
  // Whether results are narrowed (by a name search or a facet) — tunes the empty-state copy.
  const narrowed = activeCount > 0 || query.trim().length > 0;
  const locating = !!coords && nearest.isLoading && !cityKey;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Find your people</h1>
        <p className="mt-1 text-sm text-muted">
          Groups, leagues, ladders, and tournaments near you.
        </p>
      </header>

      {/* What to find */}
      <ToggleButtonGroup
        aria-label="What to find"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([type])}
        onSelectionChange={(keys) => {
          const first = [...keys][0];
          if (first) setType(first as DiscoverEntityType);
        }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {ENTITY_TYPES.map((t) => (
          <ToggleButton key={t.id} id={t.id} className="h-11 rounded-xl text-sm font-semibold">
            {t.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Location */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <CityPicker value={cityKey} onChange={setCityKey} />
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <LocationIcon />
            {locating ? "Locating…" : "Use my location"}
          </button>
        </div>
        {geoError && <p className="text-xs text-muted">{geoError}</p>}
      </div>

      {/* Search results by name */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        >
          <path d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${typeLabel} by name`}
          aria-label={`Search ${typeLabel} by name`}
          className="h-11 w-full rounded-xl border border-border bg-field pl-10 pr-4 text-sm text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label={sizeLabel(type)}
          options={SIZE_OPTIONS}
          value={filters.minSize}
          onChange={(v) => setFilters((f) => ({ ...f, minSize: v }))}
        />
        <FilterSelect
          label="Avg level (DUPR)"
          options={DUPR_OPTIONS}
          value={filters.minAvgDupr}
          onChange={(v) => setFilters((f) => ({ ...f, minAvgDupr: v }))}
        />
        {activityApplies(type) && (
          <FilterSelect
            label="Games last month"
            options={ACTIVITY_OPTIONS}
            value={filters.minGamesLastMonth}
            onChange={(v) => setFilters((f) => ({ ...f, minGamesLastMonth: v }))}
          />
        )}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_DISCOVER_FILTERS)}
            className="h-11 rounded-xl px-3 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto self-center text-sm text-muted" aria-live="polite">
          {cityKey && !isLoading
            ? `${filtered.length} ${countNoun}${data?.cityLabel ? ` near ${data.cityLabel}` : ""}`
            : ""}
        </span>
      </div>

      {/* Results */}
      {!cityKey ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted">
            Pick a city above, or use your location, to see {typeLabel} near you.
          </p>
        </div>
      ) : isLoading ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-32 w-full rounded-2xl" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div className="rounded-2xl border border-border p-8 text-center">
          <p className="text-sm text-muted">Something went wrong loading results. Please try again.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted">
            No {typeLabel} found{data?.cityLabel ? ` near ${data.cityLabel}` : ""}
            {narrowed ? " for that search" : ""}. Try another city
            {narrowed ? " or adjust your search" : ""}.
          </p>
          {/* Couldn't find one? Start your own (§6.9/§7.x). */}
          <Link
            href={CREATE_CTA[type].href}
            className="inline-flex h-11 items-center justify-center rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {CREATE_CTA[type].label}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((it) => (
            <li key={`${it.type}:${it.id}`}>
              <DiscoverCard item={it} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
