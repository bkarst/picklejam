/**
 * types.ts — typed entity models (PRD §9.3).
 *
 * Stage 0 fully types the entities the early stages read/write immediately:
 * the geo directory (country/state/city), courts (Stage 1 ingestion), and
 * users/ratings (Stage 2). Later stages add their own entity interfaces beside
 * their features. Every item extends `BaseItem` (keys + discriminator + stamps).
 */

// ── shared unions (mirror the seed vocab, §9.8) ─────────────────────────────

export type CourtAccess = "free" | "membership" | "one-time" | "reservation" | null;
export type FacilityType = "public" | "club" | "school" | "private" | null;
export type CourtLines = "permanent" | "temporary" | "tape" | "chalk" | null;
export type CourtNets = "permanent" | "portable" | "byo" | "tennis" | null;
export type Visibility = "public" | "unlisted" | "private";
export type JoinPolicy = "invite" | "request" | "open";
export type RatingSystem = "DUPR" | "UTRP" | "WPR" | "CTPR" | "SELF";
export type PhotoSource = "user" | "google-places" | string;

/** Denormalized aggregate counters (§9.4), reconciled by Streams. */
export interface Counts {
  /** Distinct court VENUES (COURT items) — the city H1 "N Best ... Courts" count. */
  locations?: number;
  /** Sum of physical courts across venues — "with N courts". */
  courts?: number;
  cities?: number;
  states?: number;
  games?: number;
  players?: number;
  groups?: number;
}

// ── base ────────────────────────────────────────────────────────────────────

export interface BaseItem {
  pk: string;
  sk: string;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
  gsi3pk?: string;
  gsi3sk?: string;
  gsi4pk?: string;
  gsi4sk?: string;
  /** Entity discriminator for Stream routing + debugging. */
  entity: string;
  createdAt?: string;
  updatedAt?: string;
  /** Epoch-seconds TTL (only ephemeral items: anon tokens, stripe dedupe). */
  ttl?: number;
}

// ── geo directory ─────────────────────────────────────────────────────────

export interface CountryItem extends BaseItem {
  entity: "COUNTRY";
  code: string;
  name: string;
  counts?: Counts;
}

export interface StateItem extends BaseItem {
  entity: "STATE";
  country: string;
  code: string;
  name: string;
  slug: string;
  counts?: Counts;
}

export interface CityItem extends BaseItem {
  entity: "CITY";
  cityKey: string;
  name: string;
  slug: string;
  country: string;
  state: string;
  centroidLat?: number;
  centroidLng?: number;
  geohash?: string;
  nearbyCityKeys?: string[];
  counts?: Counts;
}

/** Day-bucketed metro check-in rollup (§9.4 CITYDAY). */
export interface CityDayItem extends BaseItem {
  entity: "CITYDAY";
  cityKey: string;
  day: string;
  checkinsCount: number;
  playerCount: number;
}

// ── court ─────────────────────────────────────────────────────────────────

export interface OpenPlayBlock {
  dayOfWeek: number; // 0–6
  start: string; // "HH:mm"
  end: string;
  skillMin?: number;
  skillMax?: number;
}

export interface CourtPhoto {
  url: string;
  source: PhotoSource;
  visible: boolean;
  attribution?: { url?: string; html?: string; name?: string };
}

export interface CourtItem extends BaseItem {
  entity: "COURT";

  // identity / geo
  courtId: string;
  name: string;
  slug: string;
  cityKey: string;
  cityId?: string;
  lat: number;
  lng: number;
  geohash: string;
  address?: string;

  // courts / play
  indoorCourts: number;
  outdoorCourts: number;
  totalCourts: number;
  hasPickleball: boolean;
  surface?: string[];
  lines?: CourtLines;
  nets?: CourtNets;
  amenities?: string[];
  lighted?: boolean;

  // access
  access?: CourtAccess;
  accessDetails?: string;
  hasReservations?: boolean;
  reservationUrl?: string;
  facilityType?: FacilityType;
  scheduleDetails?: string;
  /** Structured open-play, parsed from scheduleDetails at ingest where feasible (N13). */
  openPlay?: OpenPlayBlock[];

  // contact
  phone?: string;
  email?: string;
  website?: string;

  // media / content
  photos?: CourtPhoto[];
  photoKeys?: string[];
  description?: string;

  // computed / denormalized (§9.4)
  reviewCount?: number;
  ratingAvg?: number;
  checkinsTodayCount?: number;
  playerCount?: number;
  groupCount?: number;
  /** Games/outings ever held here (denormalized; Stage 4 populates via Streams). */
  gamesCount?: number;
  popularityRank?: number;
  /** Derived: nets=permanent ∧ lines=permanent (N8). */
  dedicated?: boolean;

  // provenance / lifecycle (§9.8)
  sourceId?: string;
  source?: string;
  hidden?: boolean;
  deleted?: boolean;
  scheduleSourcesUpdatedAt?: string | null;
  importedAt?: string;
  /** Whether the court clears the §14.4 content threshold (else `noindex`). */
  indexable?: boolean;
}

// ── user & ratings ──────────────────────────────────────────────────────────

export interface UserProfileItem extends BaseItem {
  entity: "USER";
  uid: string;
  username: string;
  displayName: string;
  gender?: string;
  homeCityKey?: string;
  homeCourtId?: string;
  avatarUrl?: string;
  visibility: Visibility;
  defaultRatingSource?: RatingSystem;
  /** Onboarding (§13.8). */
  onboarded?: boolean;
  completedSteps?: string[];
}

export interface RatingItem extends BaseItem {
  entity: "RATING";
  uid: string;
  system: RatingSystem;
  value: number;
  verified: boolean;
  source?: string;
}
