/**
 * court-filters.ts — the /search facet model (client-safe, pure).
 *
 * One source of truth for the More Filters panel: the option lists that render the
 * UI AND the predicate that filters the `NearCourt` results. Kept framework-free so
 * it's unit-testable and shared by `MapFinder` + `MoreFiltersDrawer`.
 *
 * Semantics (§6.1): across facets = AND (a court must satisfy every active facet);
 * within a facet = OR (any selected value matches). Number is a min-courts floor.
 * Flip a facet to AND by swapping its `.some(...)` for `.every(...)` below.
 */

/** The structural shape the predicate needs — `NearCourt` satisfies it. */
export interface FilterableCourt {
  totalCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  lighted: boolean;
  dedicated?: boolean;
  hasReservations?: boolean;
  access?: string | null;
  facilityType?: string | null;
  amenities?: string[] | null;
  surface?: string[] | null;
  // Community frontier facets (§G12.10)
  reviewCount?: number;
  hasTrailblazer?: boolean;
}

export interface CourtFilters {
  /** Minimum total courts (0 = Any). */
  minCourts: number;
  /** Subset of TYPE_OPTIONS values. */
  types: string[];
  /** Subset of ACCESS_OPTIONS values. */
  access: string[];
  /** Subset of AMENITY_OPTIONS values. */
  amenities: string[];
  /** Subset of SURFACE_OPTIONS values (lowercased surface tokens). */
  surfaces: string[];
  /** Subset of COMMUNITY_OPTIONS values (the G7.3 exploration frontier). */
  community: string[];
}

export const EMPTY_FILTERS: CourtFilters = {
  minCourts: 0,
  types: [],
  access: [],
  amenities: [],
  surfaces: [],
  community: [],
};

// ── option lists (drive the panel UI) ───────────────────────────────────────

export const NUMBER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Any" },
  { value: 2, label: "2+" },
  { value: 4, label: "4+" },
  { value: 6, label: "6+" },
  { value: 8, label: "8+" },
  { value: 10, label: "10+" },
];

export interface TypeOption {
  value: string;
  label: string;
}

export const TYPE_OPTIONS: TypeOption[] = [
  { value: "dedicated", label: "Dedicated Courts" },
  { value: "reservable", label: "Reservable Courts" },
  { value: "lighted", label: "Lighted Courts" },
  { value: "indoor", label: "Indoor Courts" },
  { value: "outdoor", label: "Outdoor Courts" },
];

export const ACCESS_OPTIONS: { value: string; label: string }[] = [
  { value: "public", label: "Public Court" },
  { value: "private", label: "Private Court" },
];

export interface AmenityOption {
  value: string;
  label: string;
  /** Accepted seed tokens (normalized) — the vocab uses both spaces and hyphens. */
  tokens: string[];
}

export const AMENITY_OPTIONS: AmenityOption[] = [
  { value: "food", label: "Food and Drinks", tokens: ["food", "food and drinks"] },
  { value: "lighted", label: "Lighted Courts", tokens: ["lighted"] },
  { value: "locker-rooms", label: "Locker Rooms", tokens: ["locker rooms", "locker-rooms", "lockers"] },
  { value: "pro-shop", label: "Pro Shop", tokens: ["pro shop", "pro-shop"] },
  { value: "restrooms", label: "Restrooms", tokens: ["restrooms", "restroom"] },
  { value: "training", label: "Trainers & Lessons", tokens: ["training", "trainers", "lessons"] },
  { value: "water", label: "Water", tokens: ["water"] },
  { value: "wheelchair", label: "Wheelchair Accessibility", tokens: ["wheelchair accessible", "wheelchair"] },
  { value: "youth", label: "Youth Programming", tokens: ["youth"] },
  { value: "adaptive", label: "Adaptive Programming", tokens: ["adaptive"] },
];

export const SURFACE_OPTIONS: { value: string; label: string }[] = [
  "Wood",
  "Concrete",
  "Asphalt",
  "Carpet",
  "Hard",
  "Clay",
  "Acrylic",
  "Grass",
].map((label) => ({ value: label.toLowerCase(), label }));

/** The G7.3 exploration frontier — courts that need a first review / first check-in. */
export const COMMUNITY_OPTIONS: { value: string; label: string }[] = [
  { value: "unreviewed", label: "Unreviewed courts" },
  { value: "no-trailblazer", label: "No Trailblazer yet" },
];

// ── matching ─────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().trim();

function typeMatches(c: FilterableCourt, t: string): boolean {
  switch (t) {
    case "dedicated":
      return c.dedicated === true;
    case "reservable":
      return c.hasReservations === true;
    case "lighted":
      return c.lighted === true;
    case "indoor":
      return c.indoorCourts > 0;
    case "outdoor":
      return c.outdoorCourts > 0;
    default:
      return false;
  }
}

function accessMatches(c: FilterableCourt, a: string): boolean {
  // "Public / Private Court" is a facility-type facet (not the cost `access` field,
  // which is a separate dimension). Public folds in school; private folds in club.
  const ft = c.facilityType ? norm(c.facilityType) : null;
  if (a === "public") return ft === "public" || ft === "school";
  if (a === "private") return ft === "private" || ft === "club";
  return false;
}

function amenityMatches(c: FilterableCourt, value: string): boolean {
  // `lighted` is stored both as its own boolean and (sometimes) in the amenity list.
  if (value === "lighted" && c.lighted) return true;
  const opt = AMENITY_OPTIONS.find((o) => o.value === value);
  if (!opt) return false;
  const have = new Set((c.amenities ?? []).map(norm));
  return opt.tokens.some((tok) => have.has(tok));
}

function surfaceMatches(c: FilterableCourt, value: string): boolean {
  return (c.surface ?? []).some((s) => norm(s) === value);
}

function communityMatches(c: FilterableCourt, value: string): boolean {
  if (value === "unreviewed") return (c.reviewCount ?? 0) === 0;
  if (value === "no-trailblazer") return !c.hasTrailblazer;
  return false;
}

/** Whether a court satisfies every active facet (AND across facets, OR within). */
export function courtMatchesFilters(c: FilterableCourt, f: CourtFilters): boolean {
  if (f.minCourts > 0 && (c.totalCourts ?? 0) < f.minCourts) return false;
  if (f.types.length && !f.types.some((t) => typeMatches(c, t))) return false;
  if (f.access.length && !f.access.some((a) => accessMatches(c, a))) return false;
  if (f.amenities.length && !f.amenities.some((v) => amenityMatches(c, v))) return false;
  if (f.surfaces.length && !f.surfaces.some((v) => surfaceMatches(c, v))) return false;
  if (f.community.length && !f.community.some((v) => communityMatches(c, v))) return false;
  return true;
}

export function filterCourts<T extends FilterableCourt>(courts: T[], f: CourtFilters): T[] {
  return courts.filter((c) => courtMatchesFilters(c, f));
}

/** Count of active facets — drives the "Filters (N)" badge. */
export function activeFilterCount(f: CourtFilters): number {
  return (
    (f.minCourts > 0 ? 1 : 0) +
    f.types.length +
    f.access.length +
    f.amenities.length +
    f.surfaces.length +
    f.community.length
  );
}
