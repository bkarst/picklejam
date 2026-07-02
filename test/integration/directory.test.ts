import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { batchWrite } from "@/lib/db/client";
import { mapSeedCourtToItem, type SeedCourt } from "@/lib/ingest/map";
import { GeoAccumulator } from "@/lib/ingest/pipeline";
import {
  getCourtBySlug,
  getCourtsInCity,
  getCourtsNear,
} from "@/lib/data/courts";
import { getState, getCity, getStatesInCountry, getCitiesInState } from "@/lib/data/geo";
import { cityKeyOf } from "@/lib/db/keys";
import type { CourtItem } from "@/lib/db/types";

/**
 * Stage 1 directory integration against DynamoDB Local: ingests the REAL
 * data/kansas.yml, then verifies §9.5 patterns 1/2/3/7 (one query each), the
 * counts rollup, ingestion idempotency, and the noindex threshold.
 * Skipped when DYNAMODB_ENDPOINT is unset (CI provides it).
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

interface StateFile {
  state: string;
  state_slug: string;
  courts: SeedCourt[];
}

async function ingestKansas(): Promise<StateFile> {
  const raw = readFileSync(path.resolve(__dirname, "../../data/kansas.yml"), "utf8");
  const doc = loadYaml(raw) as StateFile;
  const geo = new GeoAccumulator();
  const items: CourtItem[] = [];
  for (const seed of doc.courts) {
    if (seed.is_deleted) continue;
    const item = mapSeedCourtToItem(seed);
    items.push(item);
    geo.ingest(item, doc.state);
  }
  await batchWrite(items as unknown as Record<string, unknown>[]);
  const { countries, states, cities } = geo.finalize();
  await batchWrite(cities as unknown as Record<string, unknown>[]);
  await batchWrite(states as unknown as Record<string, unknown>[]);
  await batchWrite(countries as unknown as Record<string, unknown>[]);
  return doc;
}

d("court directory (DynamoDB Local, real Kansas seed)", () => {
  beforeAll(async () => {
    await ingestKansas();
  });

  it("#2 courts in a city (GSI2), popularity-ordered, all visible", async () => {
    const courts = await getCourtsInCity("us", "kansas", "lawrence");
    expect(courts.length).toBeGreaterThan(0);
    for (let i = 1; i < courts.length; i++) {
      expect(courts[i - 1].popularityRank ?? 0).toBeGreaterThanOrEqual(courts[i].popularityRank ?? 0);
    }
    expect(courts.every((c) => !c.hidden && !c.deleted && c.hasPickleball)).toBe(true);
  });

  it("#1 court by slug (GSI3) resolves the exact venue", async () => {
    const [first] = await getCourtsInCity("us", "kansas", "lawrence");
    const { country, state, city } = { country: "us", state: "kansas", city: "lawrence" };
    const bySlug = await getCourtBySlug(country, state, city, first.slug);
    expect(bySlug?.courtId).toBe(first.courtId);
    expect(typeof bySlug?.indexable).toBe("boolean");
  });

  it("#3 near lat/lng (GSI4 cover-set) returns only courts within radius, nearest-first", async () => {
    const city = await getCity("us", "kansas", "lawrence");
    const near = await getCourtsNear(city!.centroidLat!, city!.centroidLng!, 8000);
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((c) => c.distanceMeters <= 8000)).toBe(true);
    for (let i = 1; i < near.length; i++) {
      expect(near[i - 1].distanceMeters).toBeLessThanOrEqual(near[i].distanceMeters);
    }
  });

  it("#7 states-in-country / cities-in-state (GSI2)", async () => {
    const states = await getStatesInCountry("us");
    expect(states.some((s) => s.code === "kansas")).toBe(true);
    const cities = await getCitiesInState("us", "kansas");
    expect(cities.some((c) => c.slug === "lawrence")).toBe(true);
  });

  it("counts rollup: city.locations == visible venue count; state aggregates", async () => {
    const courts = await getCourtsInCity("us", "kansas", "lawrence");
    const city = await getCity("us", "kansas", "lawrence");
    const indexableVenues = courts.filter((c) => c.indexable !== false).length;
    expect(city?.counts?.locations).toBe(indexableVenues);
    expect(city?.counts?.courts).toBe(
      courts.filter((c) => c.indexable !== false).reduce((s, c) => s + c.totalCourts, 0),
    );
    const state = await getState("us", "kansas");
    expect((state?.counts?.locations ?? 0)).toBeGreaterThanOrEqual(indexableVenues);
    expect((state?.counts?.cities ?? 0)).toBeGreaterThan(0);
  });

  it("ingestion is idempotent on courtId (re-run = no dupes)", async () => {
    const before = (await getCourtsInCity("us", "kansas", "lawrence")).length;
    await ingestKansas(); // second run
    const after = (await getCourtsInCity("us", "kansas", "lawrence")).length;
    expect(after).toBe(before);
  });

  it("noindex threshold: cityKey helper + indexable flags computed", async () => {
    const courts = await getCourtsInCity("us", "kansas", "lawrence");
    expect(courts[0].cityKey).toBe(cityKeyOf("us", "kansas", "lawrence"));
    // At least one seeded court clears the content threshold.
    expect(courts.some((c) => c.indexable === true)).toBe(true);
  });
});
