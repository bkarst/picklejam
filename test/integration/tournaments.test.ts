// Aggregates apply inline (no real Streams over DynamoDB Local) and TransactWrite
// is emulated sequentially (dynalite has no TransactWriteItems). Both must be set
// BEFORE the data layer reads them at call time. The webhook signing secret matches
// the parallel Stripe seam's default so signed fixtures round-trip; no STRIPE_SECRET_KEY
// ⇒ the deterministic FakeGateway backs Checkout / Connect / refunds.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_pickleloko";

import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient } from "@/lib/db/table";
import { userKeys } from "@/lib/db/keys";
import { money, computeFees } from "@/lib/money";
import { getGateway, FakeGateway, signTestPayload, buildEvent } from "@/lib/stripe";
import {
  getOrCreateConnectAccount,
  markConnectComplete,
  getConnectAccount,
} from "@/lib/data/connect";
import { getMyPayments } from "@/lib/data/payments";
import {
  createTournament,
  addDivision,
  publishTournament,
  getTournament,
  getTournamentBySlug,
  getTournamentsInCity,
  getMyRegistrations,
  getOrganizerDashboard,
  getDivision,
  registerForDivision,
  cancelRegistration,
  refundRegistration,
  cancelTournament,
  seedBracket,
  advanceBracket,
  getBracket,
  buildBracketPlan,
  seedSlots,
  type AddDivisionInput,
} from "@/lib/data/tournaments";
import { POST as webhookRoute } from "@/app/api/stripe/webhook/route";
import type { RatingItem } from "@/lib/db/types";

/**
 * Stage 6 Tournaments data layer + Stripe webhook fulfilment against DynamoDB Local
 * (§7.1, §10, §9.5 patterns 17/18/19/23). Skipped without DYNAMODB_ENDPOINT. Every
 * organizer/tournament/player id is namespaced per-run, so the suite is parallel-safe
 * + re-runnable. MONEY MUST BE EXACT and NEVER OVERSOLD — the heaviest coverage.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY = `zz#tourney#${RUN}`;
const START = "2099-06-15";
const uid = (s: string) => `t-${RUN}-${s}`;

/** Count how many DynamoDB `Query` operations a call issues (the §9.5 "one query" rule). */
async function countQueries<T>(fn: () => Promise<T>): Promise<{ result: T; queries: number }> {
  const spy = vi.spyOn(getDocClient(), "send");
  const start = spy.mock.calls.length;
  const result = await fn();
  const queries = spy.mock.calls
    .slice(start)
    .filter((c) => c[0] instanceof QueryCommand).length;
  spy.mockRestore();
  return { result, queries };
}

/** Create + graduate an organizer's fake Connect account to `complete`. */
async function connectComplete(organizer: string): Promise<void> {
  await getOrCreateConnectAccount(organizer, `${organizer}@example.com`);
  await markConnectComplete(organizer);
}

interface FeeOpts {
  feeMode?: "absorb" | "passThrough";
  feePercentBps?: number;
  feeFixed?: number;
}

/** Create + publish a tournament with the given divisions (organizer already connected). */
async function makePublished(
  organizer: string,
  divisions: AddDivisionInput[],
  fee: FeeOpts = {},
) {
  const tourney = await createTournament({
    organizerId: organizer,
    title: `Test Cup ${RUN}`,
    cityKey: CITY,
    startDate: START,
    feeMode: fee.feeMode ?? "absorb",
    feePercentBps: fee.feePercentBps ?? 0,
    feeFixed: fee.feeFixed ?? 0,
  });
  const created = [];
  for (const div of divisions) created.push(await addDivision(tourney.tid, div));
  const published = await publishTournament(tourney.tid);
  return { tourney: published, tid: tourney.tid, dids: created.map((c) => c.did) };
}

/** POST a signed event through the REAL webroute (raw body + `stripe-signature`). */
async function postWebhook(evtObject: Record<string, unknown>, type: string, id?: string) {
  const evt = buildEvent(type, evtObject, id ? { id } : {});
  const payload = JSON.stringify(evt);
  const sig = signTestPayload(payload);
  const req = new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig, "content-type": "application/json" },
    body: payload,
  });
  const res = await webhookRoute(req as unknown as NextRequest);
  return { res, payload, sig };
}

/** Drive register → paid (webhook) for one player; returns the confirmed REG. */
async function registerAndPay(tid: string, did: string, player: string) {
  const { regKey, registration } = await registerForDivision(tid, did, player, {});
  const obj = {
    id: registration.checkoutSessionId,
    payment_intent: registration.paymentIntentId,
    amount_total: registration.amount!.amount,
    currency: registration.amount!.currency,
    metadata: { tid, did, uid: player, regKey, kind: "tournament" },
  };
  // Event ids must be unique per RUN — the STRIPEEVENT# dedupe rows persist in the
  // shared table across runs (a reused id would be treated as an already-seen replay).
  const { res } = await postWebhook(obj, "checkout.session.completed", `evt-${RUN}-pay-${player}`);
  expect(res.status).toBe(200);
  return registration;
}

d("tournaments data + payments (DynamoDB Local)", () => {
  it("uses the deterministic FakeGateway (no STRIPE_SECRET_KEY)", () => {
    expect(getGateway().mode).toBe("fake");
  });

  it("patterns 17/18/19 each resolve in ONE Query (no scans)", async () => {
    const organizer = uid("org1");
    await connectComplete(organizer);
    const { tourney, tid, dids } = await makePublished(organizer, [
      { name: "3.5 Singles", price: money(2500), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const player = uid("p1");
    await registerForDivision(tid, did, player, {});

    // Pattern 18 — detail + divisions + regs in ONE Query on PK=TOURNEY#<tid>.
    const q18 = await countQueries(() => getTournament(tid));
    expect(q18.queries).toBe(1);
    expect(q18.result?.tourney.tid).toBe(tid);
    expect(q18.result?.divisions).toHaveLength(1);
    expect(q18.result?.registrations.map((r) => r.uid)).toContain(player);

    // Pattern 17 — tournaments in a city (GSI2) in ONE Query.
    const q17 = await countQueries(() => getTournamentsInCity(CITY));
    expect(q17.queries).toBe(1);
    expect(q17.result.map((t) => t.tid)).toContain(tid);

    // Slug resolves the published meta (GSI3).
    expect((await getTournamentBySlug(tourney.slug))?.tid).toBe(tid);

    // Pattern 19 — my registrations (GSI1) in ONE Query (+ a BatchGet hydration).
    const q19 = await countQueries(() => getMyRegistrations(player));
    expect(q19.queries).toBe(1);
    expect(q19.result.map((r) => r.registration.tid)).toContain(tid);
    expect(q19.result.find((r) => r.registration.tid === tid)?.tourney?.title).toBe(tourney.title);
  });

  it("Connect gate: publish blocked without a complete account + ≥1 division; allowed once both hold", async () => {
    const organizer = uid("org2");
    const draft = await createTournament({
      organizerId: organizer,
      title: "Gated Cup",
      cityKey: CITY,
      startDate: START,
    });

    // No divisions yet → 400.
    await expect(publishTournament(draft.tid)).rejects.toMatchObject({ status: 400 });

    await addDivision(draft.tid, { name: "Open", price: money(1000), playMode: "singles" });

    // Division present but no Connect account → 403.
    await expect(publishTournament(draft.tid)).rejects.toMatchObject({ status: 403 });

    // Connect account exists but is still PENDING → 403.
    await getOrCreateConnectAccount(organizer, `${organizer}@example.com`);
    expect((await getConnectAccount(organizer))?.status).toBe("pending");
    await expect(publishTournament(draft.tid)).rejects.toMatchObject({ status: 403 });

    // Graduate to complete → publishes, stamps the connected account.
    await markConnectComplete(organizer);
    expect((await getConnectAccount(organizer))?.status).toBe("complete");
    const published = await publishTournament(draft.tid);
    expect(published.status).toBe("published");
    expect(published.connectedAccountId).toBeTruthy();
  });

  it("capacity race: N concurrent registrations for the LAST spot → exactly capacity succeed, no oversell", async () => {
    const organizer = uid("org3");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "One Spot", price: money(1500), capacity: 1, playMode: "singles" },
    ]);
    const did = dids[0];

    const N = 6;
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => registerForDivision(tid, did, uid(`race-${i}`), {})),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1); // capacity 1 → exactly one wins
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    }

    // No oversell: the atomic counter never exceeds capacity.
    const div = await getDivision(tid, did);
    expect(div?.registeredCount).toBe(1);
  });

  it("deferred-capture: a full division with waitlist:true holds an authorization (no spot claimed)", async () => {
    const organizer = uid("org3b");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "Full Soon", price: money(1500), capacity: 1, playMode: "singles" },
    ]);
    const did = dids[0];

    const first = await registerForDivision(tid, did, uid("wl-1"), {});
    expect(first.status).toBe("pending");
    expect((await getDivision(tid, did))?.registeredCount).toBe(1);

    // Second registrant opts into the waitlist → authorized-not-captured hold, no spot.
    const held = await registerForDivision(tid, did, uid("wl-2"), { waitlist: true });
    expect(held.status).toBe("waitlisted");
    expect(held.registration.authorizedNotCaptured).toBe(true);
    expect((await getDivision(tid, did))?.registeredCount).toBe(1); // still no oversell
  });

  it("partner-pending: a doubles registration with a partner starts partnerPending", async () => {
    const organizer = uid("org3c");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "Mixed Doubles", price: money(4000), capacity: 8, playMode: "doubles" },
    ]);
    const did = dids[0];
    const result = await registerForDivision(tid, did, uid("d-1"), { partnerUid: uid("d-2") });
    expect(result.registration.paymentStatus).toBe("partnerPending");
    expect(result.registration.partnerStatus).toBe("pending");
    expect(result.registration.partnerUid).toBe(uid("d-2"));
  });

  it("DUPR gate: a rated division rejects out-of-range / unrated players and accepts in-range", async () => {
    const organizer = uid("org3d");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "4.0-4.5", price: money(2000), capacity: 8, playMode: "singles", duprMin: 4.0, duprMax: 4.5 },
    ]);
    const did = dids[0];

    // No rating → 403.
    await expect(registerForDivision(tid, did, uid("g-none"), {})).rejects.toMatchObject({ status: 403 });
    // Out of range → 403.
    await expect(
      registerForDivision(tid, did, uid("g-low"), { dupr: 3.2 }),
    ).rejects.toMatchObject({ status: 403 });
    // In range → ok.
    const ok = await registerForDivision(tid, did, uid("g-ok"), { dupr: 4.25 });
    expect(ok.status).toBe("pending");

    // The gate also reads a persisted RATING# row (not just the passed override).
    const rated = uid("g-rated");
    const rating: RatingItem = {
      ...userKeys.rating(rated, "DUPR"),
      entity: "RATING",
      uid: rated,
      system: "DUPR",
      value: 4.1,
      verified: true,
    };
    const { putItem } = await import("@/lib/db/client");
    await putItem(rating as unknown as Record<string, unknown>);
    const okRated = await registerForDivision(tid, did, rated, {});
    expect(okRated.status).toBe("pending");
  });

  it("register → Checkout → webhook: idempotent replay ⇒ REG paid ONCE, one Payment, count unchanged", async () => {
    const organizer = uid("org4");
    await connectComplete(organizer);
    // absorb, 5% + $0.30 platform fee on a $30 entry.
    const { tid, dids } = await makePublished(
      organizer,
      [{ name: "Webhook Div", price: money(3000), capacity: 8, playMode: "singles" }],
      { feeMode: "absorb", feePercentBps: 500, feeFixed: 30 },
    );
    const did = dids[0];
    const player = uid("p4");

    const { regKey, registration } = await registerForDivision(tid, did, player, {});
    // Fee math (absorb): fee = 5%*3000 + 30 = 180; total = face = 3000.
    const breakdown = computeFees(money(3000), { mode: "absorb", percentBps: 500, fixed: 30 });
    expect(breakdown.applicationFee.amount).toBe(180);
    expect(breakdown.total.amount).toBe(3000);
    expect(registration.amount?.amount).toBe(3000);
    expect(registration.applicationFee?.amount).toBe(180);
    expect(registration.paymentStatus).toBe("pending");
    // The spot is reserved up-front (count already 1 before payment).
    expect((await getDivision(tid, did))?.registeredCount).toBe(1);

    const obj = {
      id: registration.checkoutSessionId,
      payment_intent: registration.paymentIntentId,
      amount_total: 3000,
      currency: "usd",
      metadata: { tid, did, uid: player, regKey, kind: "tournament" },
    };
    const dupId = `evt-${RUN}-dup`;
    const first = await postWebhook(obj, "checkout.session.completed", dupId);
    expect(first.res.status).toBe(200);
    expect((await first.res.json()).received).toBe(true);

    // Replay the SAME signed event id → de-duped (pattern 23), acked, no re-processing.
    const replay = await postWebhook(obj, "checkout.session.completed", dupId);
    expect(replay.res.status).toBe(200);
    expect((await replay.res.json()).duplicate).toBe(true);

    // Ledger consistency: REG paid ↔ one Payment ↔ registeredCount (never double).
    const detail = await getTournament(tid);
    const reg = detail!.registrations.find((r) => r.uid === player);
    expect(reg?.paymentStatus).toBe("paid");
    expect((await getDivision(tid, did))?.registeredCount).toBe(1);
    const payments = (await getMyPayments(player)).filter((p) => p.refId === tid);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount.amount).toBe(3000);
    expect(payments[0].applicationFee?.amount).toBe(180);
    expect(payments[0].status).toBe("paid");
  });

  it("sibling events (checkout.session.completed + payment_intent.succeeded) fulfil at most once", async () => {
    const organizer = uid("org4b");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "Sibling Div", price: money(2000), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const player = uid("p4b");
    const { regKey, registration } = await registerForDivision(tid, did, player, {});
    const meta = { tid, did, uid: player, regKey, kind: "tournament" };

    // Two DIFFERENT events for the same PI (both would flip paid + writePayment).
    const a = await postWebhook(
      { id: registration.checkoutSessionId, payment_intent: registration.paymentIntentId, metadata: meta },
      "checkout.session.completed",
      `evt-${RUN}-sib-a`,
    );
    const b = await postWebhook(
      { id: registration.paymentIntentId, metadata: meta },
      "payment_intent.succeeded",
      `evt-${RUN}-sib-b`,
    );
    expect(a.res.status).toBe(200);
    expect(b.res.status).toBe(200);

    // The REG `paid` guard means exactly ONE Payment despite two distinct events.
    const payments = (await getMyPayments(player)).filter((p) => p.refId === tid);
    expect(payments).toHaveLength(1);
    expect((await getDivision(tid, did))?.registeredCount).toBe(1);
  });

  it("bad signature ⇒ 400 (and nothing is processed)", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" },
      body: JSON.stringify(buildEvent("checkout.session.completed", { metadata: {} })),
    });
    const res = await webhookRoute(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("pass-through fee mode: the registrant pays face + fee; organizer nets the face", async () => {
    const organizer = uid("org5");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(
      organizer,
      [{ name: "PT Div", price: money(3000), capacity: 8, playMode: "singles" }],
      { feeMode: "passThrough", feePercentBps: 500, feeFixed: 30 },
    );
    const did = dids[0];
    const player = uid("p5");
    const { registration } = await registerForDivision(tid, did, player, {});
    // passThrough: fee = 180; total = 3000 + 180 = 3180; organizerNet = 3000.
    expect(registration.amount?.amount).toBe(3180);
    expect(registration.applicationFee?.amount).toBe(180);

    const dash = await getOrganizerDashboard(tid);
    // Only a pending reg so far → no paid revenue yet.
    expect(dash?.totals.paidCount).toBe(0);
  });

  it("organizer dashboard tallies gross / application fees / organizer-net from PAID regs", async () => {
    const organizer = uid("org6");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(
      organizer,
      [{ name: "Rev Div", price: money(2000), capacity: 8, playMode: "singles" }],
      { feeMode: "absorb", feePercentBps: 1000, feeFixed: 0 }, // 10% platform fee
    );
    const did = dids[0];
    // Two players register + pay.
    await registerAndPay(tid, did, uid("rev-1"));
    await registerAndPay(tid, did, uid("rev-2"));

    const dash = await getOrganizerDashboard(tid);
    expect(dash?.totals.paidCount).toBe(2);
    // gross = 2 * 2000 = 4000; fee = 2 * (10%*2000) = 400; net = 3600.
    expect(dash?.totals.gross.amount).toBe(4000);
    expect(dash?.totals.applicationFees.amount).toBe(400);
    expect(dash?.totals.organizerNet.amount).toBe(3600);
    const tally = dash!.divisions.find((t) => t.division.did === did)!;
    expect(tally.paidCount).toBe(2);
    expect(tally.organizerNet.amount).toBe(3600);
  });

  it("refunds: registrant-initiated RETAINS the platform fee; organizer refund REFUNDS it; ledger reconciled", async () => {
    const organizer = uid("org7");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(
      organizer,
      [{ name: "Refund Div", price: money(5000), capacity: 8, playMode: "singles" }],
      { feeMode: "absorb", feePercentBps: 500, feeFixed: 0 },
    );
    const did = dids[0];
    const gateway = getGateway() as FakeGateway;

    // Player A pays, then cancels (registrant-initiated → fee retained, full refund).
    const playerA = uid("ref-a");
    await registerAndPay(tid, did, playerA);
    const beforeA = gateway.refunds.length;
    const regA = await cancelRegistration(tid, did, playerA);
    expect(regA?.paymentStatus).toBe("refunded");
    const recA = gateway.refunds[gateway.refunds.length - 1];
    expect(gateway.refunds.length).toBe(beforeA + 1);
    expect(recA.refundApplicationFee).toBe(false); // fee RETAINED
    expect(recA.amount.amount).toBe(5000); // full refund of the total charged

    // Player B pays, organizer issues a PARTIAL refund (fee refunded, org-initiated).
    const playerB = uid("ref-b");
    await registerAndPay(tid, did, playerB);
    const beforeB = gateway.refunds.length;
    const regB = await refundRegistration(tid, did, playerB, {
      amount: money(1500),
      refundApplicationFee: true,
    });
    expect(regB?.paymentStatus).toBe("partiallyRefunded");
    const recB = gateway.refunds[gateway.refunds.length - 1];
    expect(gateway.refunds.length).toBe(beforeB + 1);
    expect(recB.refundApplicationFee).toBe(true); // fee REFUNDED
    expect(recB.amount.amount).toBe(1500); // partial

    // Ledger reconciled: Payment rows carry the refund status + amounts.
    const payA = (await getMyPayments(playerA)).find((p) => p.refId === tid);
    expect(payA?.status).toBe("refunded");
    expect(payA?.refundedAmount?.amount).toBe(5000);
    const payB = (await getMyPayments(playerB)).find((p) => p.refId === tid);
    expect(payB?.status).toBe("partiallyRefunded");
    expect(payB?.refundedAmount?.amount).toBe(1500);
  });

  it("cancelTournament mass-refunds every paid registration (organizer-cancel ⇒ fee refunded) + reconciles", async () => {
    const organizer = uid("org8");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "Cancel Div", price: money(2500), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const gateway = getGateway() as FakeGateway;

    const players = [uid("c-1"), uid("c-2"), uid("c-3")];
    for (const p of players) await registerAndPay(tid, did, p);

    const before = gateway.refunds.length;
    const result = await cancelTournament(tid);
    expect(result.tourney.status).toBe("cancelled");
    expect(result.refunded).toBe(players.length);

    // One organizer refund (fee refunded) per paid registration.
    const newRefunds = gateway.refunds.slice(before);
    expect(newRefunds).toHaveLength(players.length);
    expect(newRefunds.every((r) => r.refundApplicationFee === true)).toBe(true);

    // Every REG reconciled to refunded; cancelled tournaments drop from the finder.
    const detail = await getTournament(tid);
    expect(detail!.registrations.every((r) => r.paymentStatus === "refunded")).toBe(true);
    expect((await getTournamentsInCity(CITY)).map((t) => t.tid)).not.toContain(tid);
  });

  it("bracket: pure builder snake-seeds + auto-advances byes; seedBracket persists it; advanceBracket propagates", async () => {
    // Pure helper — standard single-elim seeding order (1 v 4, 2 v 3 for a 4-bracket).
    expect(seedSlots(4)).toEqual([1, 4, 2, 3]);
    // 3 entrants → a 4-slot bracket with one bye that auto-advances into the final.
    const plan3 = buildBracketPlan(["A", "B", "C"]);
    const r1 = plan3.filter((m) => m.round === 1);
    expect(r1).toHaveLength(2);
    const bye = r1.find((m) => (m.sideA && !m.sideB) || (!m.sideA && m.sideB));
    expect(bye?.status).toBe("scored"); // a bye is pre-resolved

    // Persisted + advanced with 4 paid registrations (+ a 3rd-place match).
    const organizer = uid("org9");
    await connectComplete(organizer);
    const { tid, dids } = await makePublished(organizer, [
      { name: "Bracket Div", price: money(1000), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const players = [uid("b-1"), uid("b-2"), uid("b-3"), uid("b-4")];
    for (const p of players) await registerAndPay(tid, did, p);

    const bracket = await seedBracket(tid, did, { thirdPlace: true });
    // 4 entrants → round 1 (2 semis) + final + 3rd-place = 4 matches.
    expect(bracket).toHaveLength(4);
    const semis = bracket.filter((m) => m.round === 1);
    expect(semis).toHaveLength(2);
    expect(semis.every((m) => m.sideA && m.sideB)).toBe(true);
    const finalRound = Math.max(...bracket.map((m) => m.round));
    expect(bracket.find((m) => m.round === finalRound && m.index === 0)?.label).toBe("Final");
    expect(bracket.find((m) => m.round === finalRound && m.index === 1)?.label).toBe("3rd Place");

    // Score semifinal 0: the winner advances into the Final, the loser into 3rd place.
    const semi0 = semis.find((m) => m.index === 0)!;
    const winner = semi0.sideA!; // A scores higher
    const loser = semi0.sideB!;
    await advanceBracket(tid, did, 1, 0, 11, 5);

    const after = await getBracket(tid, did);
    const final = after.find((m) => m.round === finalRound && m.index === 0)!;
    const third = after.find((m) => m.round === finalRound && m.index === 1)!;
    expect(final.sideA).toEqual(winner); // semi 0 winner → Final slot A
    expect(third.sideA).toEqual(loser); // semi 0 loser → 3rd-place slot A
    const scored = after.find((m) => m.round === 1 && m.index === 0)!;
    expect(scored.status).toBe("scored");
    expect(scored.scoreA).toBe(11);
  });
});
