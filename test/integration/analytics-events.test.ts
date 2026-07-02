// Aggregates apply inline (no real Streams over DynamoDB Local) and TransactWrite
// is emulated sequentially. The webhook secret matches the Stripe seam default so
// signed fixtures round-trip; no STRIPE_SECRET_KEY ⇒ the deterministic FakeGateway.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_pickleloko";
delete process.env.STRIPE_SECRET_KEY;

import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Replace the PostHog transport with a spy. The data layer emits ⚙ server events
 * (§2.1) via `trackServerEvent` → `captureServerEvent`, so spying here observes
 * every confirmed event exactly as it is fired — while keeping analytics a no-op
 * for real delivery (getPostHogServer → null).
 */
vi.mock("@/lib/posthog-server", () => ({
  captureServerEvent: vi.fn(),
  getPostHogServer: vi.fn(() => null),
}));

import { captureServerEvent } from "@/lib/posthog-server";
import { putItem } from "@/lib/db/client";
import { courtKeys } from "@/lib/db/keys";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { money } from "@/lib/money";
import { createCheckin, getCourtCheckinsToday } from "@/lib/data/checkins";
import { createOuting, rsvp } from "@/lib/data/outings";
import { createRrEvent, getRrEvent, recordScore } from "@/lib/data/roundrobin";
import {
  createTournament,
  addDivision,
  publishTournament,
  registerForDivision,
  confirmRegistrationPayment,
} from "@/lib/data/tournaments";
import {
  getOrCreateConnectAccount,
  markConnectComplete,
  refreshConnectStatus,
} from "@/lib/data/connect";
import { writePayment, refundPayment } from "@/lib/data/payments";
import type { StoredMoney } from "@/lib/db/types";

/**
 * Stage 10 analytics event wiring (PRD §2.1). Asserts each ⚙ SERVER event fires
 * from its real trigger point, that events fire ONCE (no double-emit), and that an
 * analytics failure can NEVER break the underlying write (fire-and-forget). Needs
 * DynamoDB Local; skipped without DYNAMODB_ENDPOINT. Every id is per-run so the
 * suite is parallel-safe + re-runnable.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY = `zz#analytics#${RUN}`;
const START_TS = "2099-06-15T18:00:00.000Z";
const DAY = courtLocalDay({ lng: 0 }, Date.parse(START_TS));
const uid = (s: string) => `an-${RUN}-${s}`;

const captureSpy = vi.mocked(captureServerEvent);
/** All (distinctId, props) tuples captured for a given event name. */
const callsFor = (event: string) =>
  captureSpy.mock.calls.filter((c) => c[1] === event).map((c) => ({ distinctId: c[0], props: c[2] }));

async function makeCourt(courtId: string): Promise<void> {
  await putItem({
    ...courtKeys.meta(courtId),
    entity: "COURT",
    courtId,
    name: `Analytics Court ${courtId}`,
    slug: courtId,
    cityKey: CITY,
    lat: 0,
    lng: 0,
    geohash: "000000000",
    totalCourts: 4,
    hasPickleball: true,
  });
}

beforeEach(() => {
  captureSpy.mockReset();
});

d("analytics: server (⚙) events fire from their trigger sites", () => {
  it("court_checkin — createCheckin emits after the write", async () => {
    const courtId = `court-${RUN}-checkin`;
    captureSpy.mockClear();
    const item = await createCheckin({ courtId, anonymous: true, day: DAY });

    const calls = callsFor("court_checkin");
    expect(calls).toHaveLength(1);
    expect(calls[0].distinctId).toBe("anonymous"); // anonymous check-in → no uid
    expect(calls[0].props).toMatchObject({ courtId, anonymous: true, checkinDay: DAY });
    // The write itself succeeded regardless of analytics.
    expect(item.courtId).toBe(courtId);
  });

  it("rsvp_set — rsvp emits with the outing + resulting status", async () => {
    const courtId = `court-${RUN}-rsvp`;
    await makeCourt(courtId);
    const outing = await createOuting({
      title: "Analytics Open Play",
      courtId,
      organizerId: uid("host"),
      startTs: START_TS,
      capacity: 8,
      visibility: "public",
    });
    const player = uid("rsvp-p1");

    captureSpy.mockClear();
    await rsvp(outing.outingId, player, "going");

    const calls = callsFor("rsvp_set");
    expect(calls).toHaveLength(1);
    expect(calls[0].distinctId).toBe(player);
    expect(calls[0].props).toMatchObject({ outingId: outing.outingId, status: "going" });
  });

  it("match_played — recordScore emits once per confirmed score, carrying rrCreatorToken", async () => {
    const { eventId, creatorToken } = await createRrEvent({
      title: "Analytics RR",
      config: {
        format: "roundRobin",
        mode: "singles",
        entrants: Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, name: `P${i}`, seed: i + 1 })),
        courts: 2,
        scoring: { pointsToWin: 11, winBy: 2 },
        rngSeed: 42,
      },
    });
    const full = await getRrEvent(eventId);
    const matchId = full!.rounds[0].matches[0].id;

    captureSpy.mockClear();
    await recordScore(eventId, { matchId, scoreA: 11, scoreB: 4 }, { token: creatorToken });

    const calls = callsFor("match_played");
    expect(calls).toHaveLength(1);
    expect(calls[0].props).toMatchObject({
      kind: "roundRobin",
      eventId,
      matchId,
      rrCreatorToken: creatorToken, // §2.1 N2 anon-organizer attribution
    });
  });

  it("payment_succeeded + registration_confirmed — confirmRegistrationPayment emits BOTH, once", async () => {
    const organizer = uid("org");
    await getOrCreateConnectAccount(organizer, `${organizer}@example.com`);
    await markConnectComplete(organizer);
    const t = await createTournament({
      organizerId: organizer,
      title: `Analytics Cup ${RUN}`,
      cityKey: CITY,
      startDate: "2099-06-15",
    });
    const div = await addDivision(t.tid, { name: "Open", price: money(2500), playMode: "singles" });
    await publishTournament(t.tid);
    const player = uid("payer");
    const { registration } = await registerForDivision(t.tid, div.did, player, {});

    captureSpy.mockClear();
    const res = await confirmRegistrationPayment({
      tid: t.tid,
      did: div.did,
      uid: player,
      paymentIntentId: registration.paymentIntentId,
      amountTotal: registration.amount!.amount,
      currency: registration.amount!.currency,
    });
    expect(res.ok).toBe(true);

    const paid = callsFor("payment_succeeded");
    const confirmed = callsFor("registration_confirmed");
    expect(paid).toHaveLength(1);
    expect(confirmed).toHaveLength(1);
    for (const c of [paid[0], confirmed[0]]) {
      expect(c.distinctId).toBe(player);
      expect(c.props).toMatchObject({
        kind: "tournament",
        refId: t.tid,
        divisionId: div.did,
        amount: registration.amount!.amount,
        currency: registration.amount!.currency,
      });
    }

    // Idempotent replay (already paid) must NOT re-emit either event.
    captureSpy.mockClear();
    const replay = await confirmRegistrationPayment({ tid: t.tid, did: div.did, uid: player });
    expect(replay.alreadyPaid).toBe(true);
    expect(replay.registration?.paymentStatus).toBe("paid");
    expect(callsFor("payment_succeeded")).toHaveLength(0);
    expect(callsFor("registration_confirmed")).toHaveLength(0);
  });

  it("connect_onboarding_completed — refreshConnectStatus emits ONCE on the transition to complete", async () => {
    const organizer = uid("connect-org");
    await getOrCreateConnectAccount(organizer, `${organizer}@example.com`);

    captureSpy.mockClear();
    await markConnectComplete(organizer); // pending → complete (via refreshConnectStatus)

    const calls = callsFor("connect_onboarding_completed");
    expect(calls).toHaveLength(1);
    expect(calls[0].distinctId).toBe(organizer);

    // A subsequent refresh of an already-complete account must NOT re-emit.
    captureSpy.mockClear();
    await refreshConnectStatus(organizer);
    expect(callsFor("connect_onboarding_completed")).toHaveLength(0);
  });

  it("refund_issued — refundPayment emits with amount + currency + kind", async () => {
    const payer = uid("refund-payer");
    const ts = "2099-06-10T00:00:00.000Z";
    await writePayment({
      uid: payer,
      kind: "tournament",
      refId: `tid-${RUN}`,
      amount: { amount: 2000, currency: "usd" } satisfies StoredMoney,
      applicationFee: { amount: 88, currency: "usd" } satisfies StoredMoney,
      paymentIntentId: `pi-${RUN}-refund`,
      ts,
    });

    captureSpy.mockClear();
    await refundPayment({ uid: payer, ts, refundApplicationFee: true });

    const calls = callsFor("refund_issued");
    expect(calls).toHaveLength(1);
    expect(calls[0].distinctId).toBe(payer);
    expect(calls[0].props).toMatchObject({
      kind: "tournament",
      amount: 2000,
      currency: "usd",
      status: "refunded",
    });
  });

  // ── fire-and-forget: an analytics failure must NOT break the underlying action ──
  it("a throwing capture NEVER fails (or blocks) the write it is attached to", async () => {
    const courtId = `court-${RUN}-throw`;
    // The very next capture throws — simulating a broken analytics transport.
    captureSpy.mockClear();
    captureSpy.mockImplementationOnce(() => {
      throw new Error("boom: analytics is down");
    });

    // The check-in write must still resolve despite the capture throwing.
    const item = await createCheckin({ courtId, anonymous: true, day: DAY });
    expect(item.courtId).toBe(courtId);

    // And it is durably persisted — the write was not rolled back or skipped.
    const today = await getCourtCheckinsToday(courtId, DAY);
    expect(today.some((c) => c.courtId === courtId)).toBe(true);
  });
});
