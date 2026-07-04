// Aggregates apply inline (no real Streams over DynamoDB Local) and TransactWrite
// is emulated sequentially with rollback (dynalite has no TransactWriteItems). Both
// must be set BEFORE the data layer reads them at call time.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getItem, putItem } from "@/lib/db/client";
import { courtKeys, geoKeys, outingKeys, parseCityKey } from "@/lib/db/keys";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import {
  createOuting,
  getOuting,
  getCityGames,
  getCourtGames,
  getMyOutings,
  getOutingMeta,
  rsvp,
  cancelRsvp,
} from "@/lib/data/outings";
import type { CourtItem, OutingRefItem, Counts } from "@/lib/db/types";

/**
 * Stage 4 outings data + Streams wiring against DynamoDB Local (§6.7, §9.5 #8–#11).
 * Skipped without DYNAMODB_ENDPOINT. Parallel-safe + re-runnable: synthetic courts
 * + a per-run cityKey/ids isolate every counter and index partition.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY_KEY = `zz#ogtest#${RUN}`;
// Far-future start so "upcoming" filters always include it, whatever the clock is.
const START_TS = "2099-06-15T18:00:00.000Z";
const DAY = courtLocalDay({ lng: 0 }, Date.parse(START_TS)); // lng 0 → UTC day

async function makeCourt(courtId: string, cityKey = CITY_KEY): Promise<void> {
  await putItem({
    ...courtKeys.meta(courtId),
    entity: "COURT",
    courtId,
    name: `Outing Test Court ${courtId}`,
    slug: courtId,
    cityKey,
    lat: 0,
    lng: 0,
    geohash: "000000000",
    totalCourts: 4,
    hasPickleball: true,
  });
}

const COURT_MAIN = `court-og-${RUN}-main`;
const COURT_CAP = `court-og-${RUN}-cap`;
const COURT_CNT = `court-og-${RUN}-cnt`;
const CITY_CNT = `zz#ogcnt#${RUN}`;

d("outings data + streams wiring (DynamoDB Local)", () => {
  beforeAll(async () => {
    await Promise.all([
      makeCourt(COURT_MAIN),
      makeCourt(COURT_CAP),
      makeCourt(COURT_CNT, CITY_CNT),
    ]);
  });

  it("#8/#9/#10/#11 — one query each; outing appears on its court AND its city", async () => {
    const organizer = `og-${RUN}-host`;
    const outing = await createOuting({
      title: "Morning Open Play",
      courtId: COURT_MAIN,
      organizerId: organizer,
      startTs: START_TS,
      tz: "America/Chicago",
      capacity: 8,
      visibility: "public",
    });

    // #10 — outing detail + RSVPs in ONE Query on PK=OUTING#id.
    const detail = await getOuting(outing.outingId);
    expect(detail?.outing.outingId).toBe(outing.outingId);
    // H13 — the organizer's zone round-trips onto the stored outing (so times render
    // in court-local time, not the server's UTC).
    expect(detail?.outing.tz).toBe("America/Chicago");
    expect(detail?.rsvps).toEqual([]);

    // #8 — city games on the court-local day (GSI2). Invariant: appears in its city.
    const city = await getCityGames(CITY_KEY, DAY);
    expect(city.map((o) => o.outingId)).toContain(outing.outingId);

    // #9 — games at the court (OUTINGREF pointer). Invariant: appears on its court.
    const atCourt = await getCourtGames(COURT_MAIN);
    expect(atCourt.map((o) => o.outingId)).toContain(outing.outingId);

    // #11 — my outings: this one is under "hosting".
    const mine = await getMyOutings(organizer);
    expect(mine.hosting.map((o) => o.outingId)).toContain(outing.outingId);
    expect(mine.attending).toEqual([]);
  });

  it("private meet-up NEVER surfaces on a public court/city query (visibility projection)", async () => {
    const priv = await createOuting({
      title: "Private Squad Game",
      courtId: COURT_MAIN,
      organizerId: `og-${RUN}-priv`,
      startTs: START_TS,
      visibility: "private",
      type: "private",
    });
    expect(priv.inviteToken).toBeTruthy(); // private outings get an invite token

    const city = await getCityGames(CITY_KEY, DAY);
    expect(city.map((o) => o.outingId)).not.toContain(priv.outingId);

    const atCourt = await getCourtGames(COURT_MAIN);
    expect(atCourt.map((o) => o.outingId)).not.toContain(priv.outingId);

    // …but it is still directly fetchable by id (token-gated in the UI).
    expect((await getOutingMeta(priv.outingId))?.visibility).toBe("private");
  });

  it("OUTING+OUTINGREF+SERIES TransactWrite is all-or-nothing (no partial on mid-tx failure)", async () => {
    const outingId = `fixed-${RUN}-tx`;
    // Pre-create the OUTINGREF (2nd tx item) so its create-only condition fails
    // MID-transaction, after the OUTING meta (1st item) has been applied.
    const conflicting: OutingRefItem = {
      ...courtKeys.outingRef(COURT_MAIN, START_TS, outingId),
      entity: "OUTINGREF",
      courtId: COURT_MAIN,
      outingId,
      startTs: START_TS,
      visibility: "public",
      hostType: "USER",
      groupId: null,
    };
    await putItem(conflicting as unknown as Record<string, unknown>);

    await expect(
      createOuting({
        title: "Recurring Clinic",
        courtId: COURT_MAIN,
        organizerId: `og-${RUN}-tx`,
        startTs: START_TS,
        outingId,
        rrule: "FREQ=WEEKLY;COUNT=6", // would also write a SERIES row
      }),
    ).rejects.toBeTruthy();

    // The OUTING meta (applied first) must have been ROLLED BACK — no partial item.
    expect(await getOutingMeta(outingId)).toBeUndefined();
    // And no SERIES row leaked either.
    expect(await getItem(outingKeys.series(outingId))).toBeUndefined();
  });

  it("capacity race — two concurrent going RSVPs for the last spot → one going, one waitlist", async () => {
    const outing = await createOuting({
      title: "One Spot Only",
      courtId: COURT_CAP,
      organizerId: `og-${RUN}-cap`,
      startTs: START_TS,
      capacity: 1,
      visibility: "public",
    });

    const [a, b] = await Promise.all([
      rsvp(outing.outingId, `og-${RUN}-p1`, "going"),
      rsvp(outing.outingId, `og-${RUN}-p2`, "going"),
    ]);

    const statuses = [a.rsvp.status, b.rsvp.status].sort();
    expect(statuses).toEqual(["going", "waitlist"]); // exactly one of each
    const waitlisted = [a, b].find((r) => r.rsvp.status === "waitlist");
    expect(waitlisted?.rsvp.waitlistPos).toBe(1);

    // No oversell: goingCount never exceeds capacity.
    const meta = await getOutingMeta(outing.outingId);
    expect(meta?.goingCount).toBe(1);
    expect(meta?.waitlistCount).toBe(1);

    // Cancelling the going RSVP promotes the head of the waitlist into the spot.
    const goingUid = a.rsvp.status === "going" ? `og-${RUN}-p1` : `og-${RUN}-p2`;
    await cancelRsvp(outing.outingId, goingUid);
    const after = await getOuting(outing.outingId);
    const promotedUid = a.rsvp.status === "waitlist" ? `og-${RUN}-p1` : `og-${RUN}-p2`;
    const promoted = after?.rsvps.find((r) => r.uid === promotedUid);
    expect(promoted?.status).toBe("going");
    const freshMeta = await getOutingMeta(outing.outingId);
    expect(freshMeta?.goingCount).toBe(1);
    expect(freshMeta?.waitlistCount).toBe(0);
  });

  it("RSVP appears under my outings 'attending' (GSI1, hydrated)", async () => {
    const outing = await createOuting({
      title: "Attendee View",
      courtId: COURT_MAIN,
      organizerId: `og-${RUN}-ahost`,
      startTs: START_TS,
      capacity: 8,
      visibility: "public",
    });
    const attendee = `og-${RUN}-attendee`;
    await rsvp(outing.outingId, attendee, "going");

    const mine = await getMyOutings(attendee);
    expect(mine.attending.map((a) => a.outing.outingId)).toContain(outing.outingId);
    expect(mine.attending.find((a) => a.outing.outingId === outing.outingId)?.rsvp.status).toBe(
      "going",
    );
  });

  it("streams-inline: OUTING create bumps counts.games (geo) + court gamesCount", async () => {
    // Dedicated court + city so the counters equal exactly the outings created here.
    const n = 2;
    for (let i = 0; i < n; i++) {
      await createOuting({
        title: `Counted Game ${i}`,
        courtId: COURT_CNT,
        organizerId: `og-${RUN}-cnt-${i}`,
        startTs: START_TS,
        visibility: "public",
      });
    }

    const court = await getItem<CourtItem>(courtKeys.meta(COURT_CNT));
    expect(court?.gamesCount).toBe(n); // COURT gamesCount via OUTINGREF insert

    const { country, state, city } = parseCityKey(CITY_CNT);
    const cityItem = await getItem<{ counts?: Counts }>(geoKeys.city(country, state, city));
    expect(cityItem?.counts?.games).toBe(n); // geo counts.games via OUTING meta insert
  });
});
