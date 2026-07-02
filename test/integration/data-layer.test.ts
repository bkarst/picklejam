import { describe, it, expect, beforeAll } from "vitest";
import { loadFixture, fixture } from "@/test/fixtures/fixture";
import { getItem, query } from "@/lib/db/client";
import { courtKeys, cityKeyOf } from "@/lib/db/keys";
import { GSI } from "@/lib/db/table";
import type { CourtItem } from "@/lib/db/types";

/**
 * Integration (PRD §14.6): each §9.5 pattern resolves in ONE Query/GetItem, no
 * scans. Runs against DynamoDB Local — skipped locally when DYNAMODB_ENDPOINT is
 * unset (CI provides it + provisions PickleLokoAppTest via the workflow).
 */
const hasLocal = !!process.env.DYNAMODB_ENDPOINT;
const d = hasLocal ? describe : describe.skip;

d("single-table access patterns (DynamoDB Local)", () => {
  beforeAll(async () => {
    await loadFixture();
  });

  it("#1 court by slug (GSI3) — one Query", async () => {
    const cityKey = cityKeyOf("zz", "testland", "alpha");
    const { gsi3pk } = courtKeys.bySlug(cityKey, "a-team-sports");
    const res = await query<CourtItem>({ index: GSI.bySlug, pk: gsi3pk, skEquals: "META" });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].name).toBe("A-team Sports");
  });

  it("#2 courts in a city (GSI2) — one Query, returns both Alpha courts", async () => {
    const cityKey = cityKeyOf("zz", "testland", "alpha");
    const res = await query<CourtItem>({
      index: GSI.byLocation,
      pk: courtKeys.cityCourtsPk(cityKey),
      skBeginsWith: "COURT#",
    });
    expect(res.items.length).toBe(2);
    expect(res.items.every((c) => c.cityKey === cityKey)).toBe(true);
  });

  it("GetItem resolves a court by primary key", async () => {
    const court = await getItem<CourtItem>(courtKeys.meta("court-riverside"));
    expect(court?.outdoorCourts).toBe(4);
  });

  it("#12 public profile by username (GSI3)", async () => {
    const res = await query({ index: GSI.bySlug, pk: "USERSLUG#benk", skEquals: "META" });
    expect(res.items).toHaveLength(1);
  });

  it("fixture is deterministic (same ids/values every load)", () => {
    expect(fixture.courts[0].courtId).toBe("court-ateam");
    expect(fixture.courts[0].geohash).toHaveLength(9);
  });
});
