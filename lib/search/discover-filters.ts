/**
 * discover-filters.ts — the pure, framework-free filter model for the unified
 * "near me" finder (groups / leagues / ladders / tournaments). Mirrors the shape
 * of `court-filters.ts`: one module owns the typed card + filter model, the option
 * lists that drive the UI, and the predicate — imported by BOTH the data layer
 * (server) and the finder UI (client), so there's one source of truth.
 *
 * Semantics: filters are AND-combined, each a "minimum" threshold. A filter that
 * doesn't apply to the current entity type is ignored (e.g. tournaments have no
 * "games last month" — they're one-off events, not an ongoing series).
 */

export type DiscoverEntityType = "groups" | "leagues" | "ladders" | "tournaments";

export const ENTITY_TYPES: { id: DiscoverEntityType; label: string; singular: string }[] = [
  { id: "groups", label: "Groups", singular: "group" },
  { id: "leagues", label: "Leagues", singular: "league" },
  { id: "ladders", label: "Ladders", singular: "ladder" },
  { id: "tournaments", label: "Tournaments", singular: "tournament" },
];

/**
 * A unified, list-ready card for any discoverable entity — the wire shape the
 * `/api/discover` route returns and the finder renders. Derived metrics
 * (`avgDupr`, `gamesLastMonth`) are computed server-side from real data and may be
 * `undefined` when there's nothing to compute (no rated players / not applicable).
 */
export interface DiscoverItem {
  type: DiscoverEntityType;
  id: string;
  name: string;
  /** Canonical internal detail path. */
  url: string;
  cityKey: string;
  /** Human city label, e.g. "Lawrence, KS". */
  cityLabel: string;
  /** members (groups) · registered players (leagues/tournaments) · rungs (ladders). */
  size: number;
  /** Average DUPR across participants who have a DUPR rating; `undefined` if none. */
  avgDupr?: number;
  /** Games played in the last 30 days; `undefined` where it doesn't apply (tournaments). */
  gamesLastMonth?: number;
  /** yyyy-mm-dd start (leagues/ladders/tournaments). */
  startDate?: string;
  /** singles / doubles / team. */
  playMode?: string;
  /** Extra one-liner shown on the card (e.g. "Single elim", venue name). */
  detail?: string;
}

export interface DiscoverFilters {
  /** Minimum members/participants/rungs (0 = any). */
  minSize: number;
  /** Minimum average player DUPR (0 = any). Items with no rated players are excluded when > 0. */
  minAvgDupr: number;
  /** Minimum games played in the last month (0 = any). Ignored for types without activity. */
  minGamesLastMonth: number;
}

export const EMPTY_DISCOVER_FILTERS: DiscoverFilters = {
  minSize: 0,
  minAvgDupr: 0,
  minGamesLastMonth: 0,
};

/** "Games last month" only applies to ongoing series — not one-off tournaments. */
export function activityApplies(type: DiscoverEntityType): boolean {
  return type !== "tournaments";
}

/** The size facet's noun per type — drives labels ("members" vs "players" vs "rungs"). */
export function sizeNoun(type: DiscoverEntityType, n: number): string {
  const one = n === 1;
  switch (type) {
    case "groups":
      return one ? "member" : "members";
    case "ladders":
      return one ? "player" : "players";
    default:
      return one ? "player" : "players"; // leagues + tournaments = registered players
  }
}

// ── option lists (drive the filter controls) ─────────────────────────────────

export const SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Any size" },
  { value: 4, label: "4+" },
  { value: 8, label: "8+" },
  { value: 16, label: "16+" },
  { value: 32, label: "32+" },
];

export const DUPR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Any level" },
  { value: 3.0, label: "3.0+" },
  { value: 3.5, label: "3.5+" },
  { value: 4.0, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

export const ACTIVITY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Any" },
  { value: 1, label: "1+ games" },
  { value: 4, label: "4+ games" },
  { value: 8, label: "8+ games" },
];

// ── predicate + active count ─────────────────────────────────────────────────

/** Does one card pass the filters, given the entity type context? */
export function itemMatchesFilters(item: DiscoverItem, f: DiscoverFilters): boolean {
  if (f.minSize > 0 && item.size < f.minSize) return false;
  // A DUPR floor excludes items with no rated players (we can't verify the bar).
  if (f.minAvgDupr > 0 && (item.avgDupr ?? -Infinity) < f.minAvgDupr) return false;
  if (f.minGamesLastMonth > 0 && activityApplies(item.type)) {
    if ((item.gamesLastMonth ?? 0) < f.minGamesLastMonth) return false;
  }
  return true;
}

export function filterDiscoverItems(items: DiscoverItem[], f: DiscoverFilters): DiscoverItem[] {
  return items.filter((it) => itemMatchesFilters(it, f));
}

/** Case-insensitive substring match of a name query against an item (empty query = match all). */
export function matchesNameQuery(item: DiscoverItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || item.name.toLowerCase().includes(q);
}

/** How many facets are set away from "any" — drives the filter-count badge. Activity
 *  isn't counted for a type it doesn't apply to, so the badge matches what's shown. */
export function activeDiscoverFilterCount(f: DiscoverFilters, type: DiscoverEntityType): number {
  let n = 0;
  if (f.minSize > 0) n++;
  if (f.minAvgDupr > 0) n++;
  if (f.minGamesLastMonth > 0 && activityApplies(type)) n++;
  return n;
}
