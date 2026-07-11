/**
 * discover.ts — the read layer for the unified "near me" finder (groups / leagues /
 * ladders / tournaments), PRD §6.9/§7.x discovery.
 *
 * These four entities are indexed by CITY (GSI2 `*LOC#<cityKey>`), NOT by geohash
 * (only courts carry a GSI4 geo index). So "near me" resolves the viewer to a city
 * (edge geo-IP / browser geolocation → `nearestCity`, exactly like the court geo-IP
 * path), then queries that city plus its precomputed `nearbyCityKeys` — a metro-area
 * fan-out — and merges. Each result is labelled with its own city so a metro list is
 * legible.
 *
 * The three filterable metrics the finder needs are NOT denormalized anywhere, so we
 * compute them on read from real rows:
 *   • size          — members (groups) / Σ division `registeredCount` (leagues,
 *                     tournaments) / rung count (ladders)
 *   • avgDupr       — mean of participants' `RATING#DUPR` (one batched fan-out)
 *   • gamesLastMonth— rows in the last 30 days: group MEETUPs, confirmed league
 *                     MATCHes (`playedAt`), confirmed ladder CHALLENGEs (`updatedAt`).
 *                     Not applicable to tournaments (one-off events).
 *
 * Work is bounded (one keyed partition Query per returned entity + one batched
 * rating read) — never a scan. It is heavier than a single indexed read, which is
 * fine for a city-scoped finder; a hot production city would want these three
 * numbers denormalized onto the entity item via Streams. Documented, not hidden.
 */

import { queryAll, batchGet } from "@/lib/db/client";
import {
  groupKeys,
  leagueKeys,
  ladderKeys,
  tourneyKeys,
  userKeys,
  parseCityKey,
} from "@/lib/db/keys";
import { getGroupsInCity } from "@/lib/data/groups";
import { getLeaguesInCity } from "@/lib/data/leagues";
import { getLaddersInCity } from "@/lib/data/ladders";
import { getTournamentsInCity } from "@/lib/data/tournaments";
import { getCitiesByKeys } from "@/lib/data/geo";
import { nearestCity } from "@/lib/geo/geoip";
import { stateAbbr } from "@/lib/geo/us-states";
import { groupPath, leaguePath, ladderPath, tournamentPath } from "@/lib/urls";
import type { DiscoverEntityType, DiscoverItem } from "@/lib/search/discover-filters";
import type { RatingItem } from "@/lib/db/types";

/** Activity window: "games played in the last month". */
const ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Primary city + up to this many precomputed nearby cities (bounds the fan-out). */
const MAX_CITIES = 6;

export interface DiscoverResult {
  cityKey: string;
  cityLabel: string;
  items: DiscoverItem[];
}

/** A card whose `avgDupr` is filled in a second pass from the batched rating read. */
interface Pending {
  item: DiscoverItem;
  uids: string[];
}

// ── labels ───────────────────────────────────────────────────────────────────

function titleize(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** "Lawrence, KS" from a cityKey (+ its city item when available). */
function labelForCity(cityKey: string, name?: string): string {
  const { state, city } = parseCityKey(cityKey);
  return `${name ?? titleize(city)}, ${stateAbbr(state).toUpperCase()}`;
}

// ── location resolution ────────────────────────────────────────────────────────

/** The primary city + its nearby cities to search, with a label for each. */
async function resolveCitySet(
  cityKey: string,
): Promise<{ label: string; cityKeys: string[]; labels: Map<string, string> }> {
  const [primary] = await getCitiesByKeys([cityKey]);
  const nearby = (primary?.nearbyCityKeys ?? []).slice(0, MAX_CITIES - 1);
  const cityKeys = [cityKey, ...nearby];
  const cityItems = await getCitiesByKeys(cityKeys);
  const nameByKey = new Map(cityItems.map((c) => [c.cityKey, c.name]));
  const labels = new Map(cityKeys.map((ck) => [ck, labelForCity(ck, nameByKey.get(ck))]));
  return { label: labels.get(cityKey) ?? labelForCity(cityKey), cityKeys, labels };
}

/** Resolve a coordinate to its nearest discoverable city (for "use my location"). */
export async function nearestCityKey(
  lat: number,
  lng: number,
): Promise<{ cityKey: string; label: string } | null> {
  const city = await nearestCity(lat, lng);
  if (!city) return null;
  return { cityKey: city.cityKey, label: labelForCity(city.cityKey, city.name) };
}

// ── rating fan-out ─────────────────────────────────────────────────────────────

/** One batched read of every participant's DUPR value → `uid → value`. */
async function duprByUid(uids: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(uids)];
  const map = new Map<string, number>();
  if (unique.length === 0) return map;
  const rows = await batchGet<RatingItem>(unique.map((u) => userKeys.rating(u, "DUPR")));
  for (const r of rows) if (typeof r.value === "number") map.set(r.uid, r.value);
  return map;
}

function fillAvgDupr(pending: Pending[], dupr: Map<string, number>): void {
  for (const p of pending) {
    const vals = p.uids.map((u) => dupr.get(u)).filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      p.item.avgDupr = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
  }
}

// ── per-type collection (one keyed partition query per entity) ──────────────────

function dedupeBy<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Parse the ISO `startTs` out of a `MEETUP#<startTs>#<outingId>` sort key. */
function meetupStartTs(sk: string): string {
  return sk.split("#")[1] ?? "";
}

function inWindow(iso: string | undefined, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= now && t >= now - ACTIVITY_WINDOW_MS;
}

async function collectGroups(
  cityKeys: string[],
  labels: Map<string, string>,
  now: number,
): Promise<Pending[]> {
  const metas = dedupeBy((await Promise.all(cityKeys.map(getGroupsInCity))).flat(), (g) => g.groupId);
  return Promise.all(
    metas.map(async (g) => {
      const rows = await queryAll<Record<string, unknown>>({ pk: groupKeys.meta(g.groupId).pk });
      const uids: string[] = [];
      let games = 0;
      for (const r of rows) {
        const sk = String(r.sk);
        if (sk.startsWith("MEMBER#")) {
          if (r.status === "active") uids.push(String(r.uid));
        } else if (sk.startsWith("MEETUP#") && inWindow(meetupStartTs(sk), now)) {
          games++;
        }
      }
      const item: DiscoverItem = {
        type: "groups",
        id: g.groupId,
        name: g.name,
        url: groupPath(g.groupId),
        cityKey: g.cityKey,
        cityLabel: labels.get(g.cityKey) ?? labelForCity(g.cityKey),
        ...(g.avatarUrl ? { avatarUrl: g.avatarUrl } : {}),
        // Count the active MEMBER rows directly (exact, independent of the async
        // `memberCount` aggregator) — these are the same uids we average DUPR over.
        size: uids.length,
        gamesLastMonth: games,
      };
      return { item, uids };
    }),
  );
}

async function collectLeagues(
  cityKeys: string[],
  labels: Map<string, string>,
  now: number,
): Promise<Pending[]> {
  const metas = dedupeBy((await Promise.all(cityKeys.map(getLeaguesInCity))).flat(), (l) => l.lid);
  return Promise.all(
    metas.map(async (l) => {
      const rows = await queryAll<Record<string, unknown>>({ pk: leagueKeys.meta(l.lid).pk });
      const uids: string[] = [];
      let size = 0;
      let games = 0;
      for (const r of rows) {
        switch (r.entity) {
          case "LEAGUEDIVISION":
            size += Number(r.registeredCount ?? 0);
            break;
          case "LEAGUEREG":
            uids.push(String(r.uid));
            break;
          case "SCHEDULEMATCH":
            if (r.confirmStatus === "confirmed" && inWindow(r.playedAt as string, now)) games++;
            break;
        }
      }
      const item: DiscoverItem = {
        type: "leagues",
        id: l.lid,
        name: l.title,
        url: leaguePath(l.lid),
        cityKey: l.cityKey,
        cityLabel: labels.get(l.cityKey) ?? labelForCity(l.cityKey),
        ...(l.avatarUrl ? { avatarUrl: l.avatarUrl } : {}),
        size,
        gamesLastMonth: games,
        startDate: l.startDate,
        playMode: l.playMode,
        ...(l.venueName ? { detail: l.venueName } : {}),
      };
      return { item, uids };
    }),
  );
}

async function collectLadders(
  cityKeys: string[],
  labels: Map<string, string>,
  now: number,
): Promise<Pending[]> {
  const metas = dedupeBy((await Promise.all(cityKeys.map(getLaddersInCity))).flat(), (l) => l.lid);
  return Promise.all(
    metas.map(async (l) => {
      const rows = await queryAll<Record<string, unknown>>({ pk: ladderKeys.meta(l.lid).pk });
      const uids: string[] = [];
      let size = 0;
      let games = 0;
      for (const r of rows) {
        if (r.entity === "RUNG") {
          size++;
          uids.push(String(r.uid));
        } else if (r.entity === "CHALLENGE") {
          if (r.status === "confirmed" && inWindow(r.updatedAt as string, now)) games++;
        }
      }
      const item: DiscoverItem = {
        type: "ladders",
        id: l.lid,
        name: l.title,
        url: ladderPath(l.lid),
        cityKey: l.cityKey,
        cityLabel: labels.get(l.cityKey) ?? labelForCity(l.cityKey),
        ...(l.avatarUrl ? { avatarUrl: l.avatarUrl } : {}),
        size,
        gamesLastMonth: games,
        startDate: l.startDate,
        playMode: l.playMode,
        ...(l.venueName ? { detail: l.venueName } : {}),
      };
      return { item, uids };
    }),
  );
}

const ELIM_LABEL: Record<string, string> = { single: "Single elim", double: "Double elim" };

async function collectTournaments(
  cityKeys: string[],
  labels: Map<string, string>,
): Promise<Pending[]> {
  const metas = dedupeBy(
    (await Promise.all(cityKeys.map(getTournamentsInCity))).flat(),
    (t) => t.tid,
  );
  return Promise.all(
    metas.map(async (t) => {
      const rows = await queryAll<Record<string, unknown>>({ pk: tourneyKeys.meta(t.tid).pk });
      const uids: string[] = [];
      let size = 0;
      for (const r of rows) {
        if (r.entity === "DIVISION") size += Number(r.registeredCount ?? 0);
        else if (r.entity === "REGISTRATION") uids.push(String(r.uid));
      }
      const detailBits = [ELIM_LABEL[t.elim] ?? undefined, t.venueName].filter(Boolean) as string[];
      const item: DiscoverItem = {
        type: "tournaments",
        id: t.tid,
        name: t.title,
        url: tournamentPath(t.tid),
        cityKey: t.cityKey,
        cityLabel: labels.get(t.cityKey) ?? labelForCity(t.cityKey),
        ...(t.avatarUrl ? { avatarUrl: t.avatarUrl } : {}),
        size,
        startDate: t.startDate,
        // Tournaments are one-off events → no "games last month".
        ...(detailBits.length ? { detail: detailBits.join(" · ") } : {}),
      };
      return { item, uids };
    }),
  );
}

// ── entry point ────────────────────────────────────────────────────────────────

/**
 * Discover entities of one `type` near a `cityKey` (the city + its nearby cities),
 * each enriched with size / avgDupr / gamesLastMonth. Sorted largest-first as a
 * stable default; the client re-sorts/filters over the returned set.
 */
export async function discover(type: DiscoverEntityType, cityKey: string): Promise<DiscoverResult> {
  const { label, cityKeys, labels } = await resolveCitySet(cityKey);
  const now = Date.now();

  let pending: Pending[];
  switch (type) {
    case "groups":
      pending = await collectGroups(cityKeys, labels, now);
      break;
    case "leagues":
      pending = await collectLeagues(cityKeys, labels, now);
      break;
    case "ladders":
      pending = await collectLadders(cityKeys, labels, now);
      break;
    case "tournaments":
      pending = await collectTournaments(cityKeys, labels);
      break;
  }

  fillAvgDupr(pending, await duprByUid(pending.flatMap((p) => p.uids)));

  const items = pending
    .map((p) => p.item)
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));

  return { cityKey, cityLabel: label, items };
}
