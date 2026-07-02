/**
 * suggest.ts — global search typeahead (PRD §6.1): PLACES (cities) + COURTS.
 *
 * v1 matches against the hourly-cached city + court-lite lists in memory (no
 * external search engine, §13 decision 5). Read-only. Ranks prefix matches above
 * substring matches, then by venue count / court size.
 */

import { getAllCities } from "@/lib/data/geo";
import { getAllCourtsLite } from "@/lib/data/courts";
import { cityUrlFromKey, courtPath } from "@/lib/urls";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";

export interface Suggestion {
  type: "city" | "court";
  label: string;
  sublabel?: string;
  url: string;
  /** Court id for `type:"court"` results (Stage 4 outing wizard court picker). */
  courtId?: string;
  /** `country#state#city` key for `type:"city"` results (league/ladder city picker). */
  cityKey?: string;
}

function score(name: string, q: string): number {
  const n = name.toLowerCase();
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

export async function suggestSearch(
  rawQ: string,
  country = "us",
  limit = 8,
): Promise<{ cities: Suggestion[]; courts: Suggestion[] }> {
  const q = rawQ.trim().toLowerCase();
  if (q.length < 2) return { cities: [], courts: [] };

  const [cities, courts] = await Promise.all([getAllCities(country), getAllCourtsLite(country)]);

  const cityHits = cities
    .map((c) => ({ c, s: score(c.name, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.c.counts?.locations ?? 0) - (a.c.counts?.locations ?? 0))
    .slice(0, limit)
    .map<Suggestion>(({ c }) => ({
      type: "city",
      label: `${c.name}, ${stateAbbr(c.state)}`,
      sublabel: `${c.counts?.locations ?? 0} locations`,
      url: cityUrlFromKey(c.cityKey),
      cityKey: c.cityKey,
    }));

  const courtHits = courts
    .map((c) => ({ c, s: score(c.name, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.totalCourts - a.c.totalCourts)
    .slice(0, limit)
    .map<Suggestion>(({ c }) => {
      const { country: co, state, city } = parseCityKey(c.cityKey);
      return {
        type: "court",
        label: c.name,
        sublabel: `${c.totalCourts} courts · ${city.replace(/-/g, " ")}, ${stateAbbr(state)}`,
        url: courtPath(co, state, city, c.slug),
        courtId: c.courtId,
      };
    });

  return { cities: cityHits, courts: courtHits };
}
