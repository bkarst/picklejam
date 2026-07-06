/**
 * map.ts — pure seed→COURT mappers (PRD §9.8). No I/O, so exhaustively testable.
 *
 * Maps a `data/<state>.yml` court record to a `CourtItem` with all key
 * projections (GSI2/3/4) and computed attrs: geohash, cityKey, `dedicated` (N8),
 * `lighted`, `openPlay[]` parsed from `schedule_details` (N13), `popularityRank`
 * (a score — higher = more popular), and the §14.4 `indexable` decision.
 */

import { courtKeys, cityKeyOf } from "@/lib/db/keys";
import { encodeGeohash } from "@/lib/geo/geohash";
import { slugify } from "@/lib/util/slug";
import { courtIsIndexable } from "@/lib/seo/noindex";
import type { CourtItem, CourtPhoto, OpenPlayBlock, CourtLines, CourtNets, CourtAccess, FacilityType } from "@/lib/db/types";

/** A court record as it appears in `data/<state>.yml` `courts[]`. */
export interface SeedCourt {
  id: string;
  title: string;
  address?: string;
  lat: number;
  lng: number;
  coords?: string;
  phone?: string | null;
  email?: string | null;
  url?: string | null;
  reservation_url?: string | null;
  facility_type?: string | null;
  access?: string | null;
  access_details?: string | null;
  has_reservations?: boolean;
  indoor_courts?: number;
  outdoor_courts?: number;
  total_courts?: number;
  has_pickleball?: boolean;
  surface?: string[];
  lines?: string | null;
  nets?: string | null;
  amenities?: string[];
  description?: string;
  schedule_details?: string;
  images?: { url: string; source?: string; visible?: boolean; attribution_url?: string; attribution_html?: string; attribution_name?: string }[];
  country_slug?: string;
  state_slug?: string;
  city_slug?: string;
  city_id?: string | number;
  slug?: string;
  path?: string;
  is_hidden?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  schedule_sources_updated_at?: string | null;
}

const DAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** "3:30pm" / "9 am" / "14:00" → "HH:mm" (24h). Returns null if unparseable. */
function normalizeTime(raw: string): string | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (h > 23 || min > 59) return null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Expand a day token/range ("mon", "mon-fri") to day indices (0–6). */
function expandDays(token: string): number[] {
  const t = token.trim().toLowerCase().replace(/\./g, "");
  const range = t.match(/^([a-z]+)\s*[-–]\s*([a-z]+)$/);
  if (range) {
    const a = DAY_INDEX[range[1]];
    const b = DAY_INDEX[range[2]];
    if (a === undefined || b === undefined) return [];
    const out: number[] = [];
    for (let i = a; ; i = (i + 1) % 7) {
      out.push(i);
      if (i === b) break;
      if (out.length > 7) break;
    }
    return out;
  }
  const single = DAY_INDEX[t];
  return single === undefined ? [] : [single];
}

/**
 * Best-effort parse of free-text `schedule_details` into structured open-play
 * blocks (N13). Handles patterns like "Mon-Fri 9:00 AM - 11:00 AM" and
 * "Sat, Sun 1-3pm". Returns [] when nothing parses (caller keeps the free text).
 */
export function parseOpenPlay(scheduleDetails?: string): OpenPlayBlock[] {
  if (!scheduleDetails) return [];
  try {
    const blocks: OpenPlayBlock[] = [];
    const segments = scheduleDetails.split(/[;\n]+/);
    const timeRe = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
    for (const seg of segments) {
      const timeMatch = seg.match(timeRe);
      if (!timeMatch) continue;
      let rawStart = timeMatch[1].trim();
      const rawEnd = timeMatch[2].trim();
      // "1-3pm" → the meridiem on the end applies to a bare start too.
      const endAp = rawEnd.match(/(am|pm)$/i)?.[1];
      if (endAp && !/(am|pm)$/i.test(rawStart)) rawStart = `${rawStart}${endAp}`;
      const start = normalizeTime(rawStart);
      const end = normalizeTime(rawEnd);
      if (!start || !end) continue;
      // Day tokens are whatever precedes the time range.
      const dayPart = seg.slice(0, timeMatch.index ?? 0);
      const dayTokens = dayPart.split(/[,&/]+/).map((s) => s.trim()).filter(Boolean);
      const days = new Set<number>();
      for (const tok of dayTokens) for (const d of expandDays(tok)) days.add(d);
      for (const d of days) blocks.push({ dayOfWeek: d, start, end });
    }
    return blocks.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.start.localeCompare(b.start));
  } catch {
    return [];
  }
}

/** Derived: a "dedicated" court has permanent nets AND permanent lines (N8). */
export function deriveDedicated(lines?: string | null, nets?: string | null): boolean {
  return lines === "permanent" && nets === "permanent";
}

/**
 * A popularity SCORE (higher = more popular) used to order courts in a city
 * (read layer sorts desc). Seeded by court count + photos + dedicated/indoor +
 * amenity richness (§9.8: "seed by totalCourts + has-photos, refine later").
 */
export function computePopularityRank(input: {
  totalCourts: number;
  hasPhotos: boolean;
  dedicated: boolean;
  indoorCourts: number;
  amenitiesCount: number;
}): number {
  return (
    input.totalCourts * 10 +
    (input.hasPhotos ? 20 : 0) +
    (input.dedicated ? 15 : 0) +
    (input.indoorCourts > 0 ? 5 : 0) +
    input.amenitiesCount
  );
}

// ── facility-quality score (§9.8, N8) — setup-only, NOT reviews ──────────────

/** Per-field quality points (0–100) feeding the weighted facility score. */
const NET_QUALITY: Record<NonNullable<CourtNets>, number> = {
  permanent: 100, portable: 65, byo: 25, tennis: 10,
};
const LINE_QUALITY: Record<NonNullable<CourtLines>, number> = {
  permanent: 100, temporary: 55, tape: 45, chalk: 20,
};
const SURFACE_QUALITY: Record<string, number> = {
  acrylic: 100, wood: 90, hard: 70, concrete: 65, asphalt: 60, carpet: 45, clay: 40, grass: 25,
};
/** Amenities that materially improve on-court experience (each worth 25 pts). */
const KEY_AMENITIES = new Set(["restrooms", "water", "locker rooms", "pro shop", "food"]);

/** Component weights — sum to 1. Nets dominate; `dedicated` gates the tier below. */
const FACILITY_WEIGHTS = {
  nets: 0.30, lines: 0.15, surface: 0.15, capacity: 0.15,
  amenities: 0.10, lighted: 0.08, indoor: 0.07,
} as const;

/** totalCourts → 0–100 with diminishing returns (1→30, 2→50, 4→75, 8→~95). */
function capacityQuality(totalCourts: number): number {
  if (!totalCourts || totalCourts <= 0) return 40; // unknown / bad data → neutral-low
  return Math.min(100, 30 + 40 * Math.log2(totalCourts));
}

/** Best listed surface wins (a court may list several); unknown → neutral 55. */
function surfaceQuality(surface?: string[]): number {
  if (!surface?.length) return 55;
  return Math.max(...surface.map((s) => SURFACE_QUALITY[s.toLowerCase()] ?? 55));
}

function amenityQuality(amenities?: string[]): number {
  const n = (amenities ?? []).filter((a) => KEY_AMENITIES.has(a.toLowerCase())).length;
  return Math.min(100, 20 + n * 25);
}

/** Fields the facility score reads — a `CourtItem` satisfies this structurally. */
export interface FacilityScoreInput {
  nets?: CourtNets;
  lines?: CourtLines;
  surface?: string[];
  totalCourts?: number;
  indoorCourts?: number;
  amenities?: string[];
  lighted?: boolean;
  dedicated?: boolean;
}

/**
 * Facility-quality rating from the "courts/play" setup fields ONLY — no reviews
 * or check-ins. Returns a weighted 0–100 `score` and a 1–5 `tier`.
 *
 * `dedicated` (permanent nets ∧ permanent lines) is the dividing line for a real
 * pickleball court, so it GATES the tier: a non-dedicated (shared / converted)
 * court can never exceed tier 4, however nice its surface or amenities are.
 * Missing fields score at a neutral midpoint rather than as zero, so a sparsely
 * populated court isn't unfairly sunk.
 */
export function courtFacilityScore(c: FacilityScoreInput): { score: number; tier: number } {
  const w = FACILITY_WEIGHTS;
  const raw =
    (c.nets ? NET_QUALITY[c.nets] : 50) * w.nets +
    (c.lines ? LINE_QUALITY[c.lines] : 50) * w.lines +
    surfaceQuality(c.surface) * w.surface +
    capacityQuality(c.totalCourts ?? 0) * w.capacity +
    amenityQuality(c.amenities) * w.amenities +
    (c.lighted ? 100 : 40) * w.lighted +
    ((c.indoorCourts ?? 0) > 0 ? 100 : 55) * w.indoor;

  const score = Math.round(raw);
  const base = score >= 85 ? 5 : score >= 72 ? 4 : score >= 58 ? 3 : score >= 45 ? 2 : 1;
  // Dedicated-gate: a shared/converted court caps at tier 4 regardless of score.
  const tier = c.dedicated ? base : Math.min(base, 4);
  return { score, tier };
}

function mapPhotos(images?: SeedCourt["images"]): CourtPhoto[] {
  if (!images?.length) return [];
  return images.map((img) => ({
    url: img.url,
    source: img.source ?? "user",
    visible: img.visible ?? true,
    ...(img.attribution_url || img.attribution_html || img.attribution_name
      ? {
          attribution: {
            url: img.attribution_url,
            html: img.attribution_html,
            name: img.attribution_name,
          },
        }
      : {}),
  }));
}

const asOneOf = <T extends string>(v: string | null | undefined, allowed: readonly T[]): T | null =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : null;

/** Map one seed court to a fully-keyed COURT item. */
export function mapSeedCourtToItem(seed: SeedCourt): CourtItem {
  const country = seed.country_slug ?? "us";
  const state = seed.state_slug ?? "";
  const city = seed.city_slug ?? "";
  const cityKey = cityKeyOf(country, state, city);
  const slug = seed.slug ?? slugify(seed.title);
  const geohash = encodeGeohash(seed.lat, seed.lng, 9);

  const indoorCourts = seed.indoor_courts ?? 0;
  const outdoorCourts = seed.outdoor_courts ?? 0;
  const totalCourts = seed.total_courts ?? indoorCourts + outdoorCourts;
  const amenities = seed.amenities ?? [];
  const lighted = amenities.some((a) => a.toLowerCase() === "lighted");
  const lines = asOneOf<NonNullable<CourtLines>>(seed.lines, ["permanent", "temporary", "tape", "chalk"]);
  const nets = asOneOf<NonNullable<CourtNets>>(seed.nets, ["permanent", "portable", "byo", "tennis"]);
  const dedicated = deriveDedicated(seed.lines, seed.nets);
  const facility = courtFacilityScore({
    nets, lines, surface: seed.surface, totalCourts, indoorCourts, amenities, lighted, dedicated,
  });
  const photos = mapPhotos(seed.images);

  const item: CourtItem = {
    ...courtKeys.meta(seed.id),
    ...courtKeys.inCity(seed.id, cityKey),
    ...courtKeys.bySlug(cityKey, slug),
    ...courtKeys.geo(seed.id, geohash),
    entity: "COURT",

    courtId: seed.id,
    name: seed.title,
    slug,
    cityKey,
    cityId: seed.city_id !== undefined ? String(seed.city_id) : undefined,
    lat: seed.lat,
    lng: seed.lng,
    geohash,
    address: seed.address,

    indoorCourts,
    outdoorCourts,
    totalCourts,
    hasPickleball: seed.has_pickleball ?? true,
    surface: seed.surface,
    lines,
    nets,
    amenities,
    lighted,

    access: asOneOf<NonNullable<CourtAccess>>(seed.access, ["free", "membership", "one-time", "reservation"]),
    accessDetails: seed.access_details ?? undefined,
    hasReservations: seed.has_reservations,
    reservationUrl: seed.reservation_url ?? undefined,
    facilityType: asOneOf<NonNullable<FacilityType>>(seed.facility_type, ["public", "club", "school", "private"]),
    scheduleDetails: seed.schedule_details,
    openPlay: parseOpenPlay(seed.schedule_details),

    phone: seed.phone ?? undefined,
    email: seed.email ?? undefined,
    website: seed.url ?? undefined,

    photos,
    description: seed.description,

    reviewCount: 0,
    ratingAvg: 0,
    checkinsTodayCount: 0,
    playerCount: 0,
    groupCount: 0,
    dedicated,
    facilityScore: facility.score,
    facilityTier: facility.tier,
    popularityRank: computePopularityRank({
      totalCourts,
      hasPhotos: photos.length > 0,
      dedicated,
      indoorCourts,
      amenitiesCount: amenities.length,
    }),

    sourceId: seed.id,
    source: "pickleheads.com",
    hidden: seed.is_hidden ?? false,
    deleted: seed.is_deleted ?? false,
    scheduleSourcesUpdatedAt: seed.schedule_sources_updated_at ?? null,
    importedAt: seed.updated_at,
    createdAt: seed.created_at,
    updatedAt: seed.updated_at,
  };

  item.indexable = courtIsIndexable(item);
  return item;
}
