// Aggregates apply inline and TransactWrite is emulated sequentially (dynalite has
// no TransactWriteItems). Both are read at call time, so set them BEFORE any call.
// No STRIPE_SECRET_KEY ⇒ the deterministic FakeGateway backs Checkout / Connect /
// refunds. (APP_ENV=Test + DYNAMODB_ENDPOINT come from the CLI env — they are read
// at import time, so they cannot be set here.)
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_pickleloko";

import { describe, it, expect, vi } from "vitest";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient } from "@/lib/db/table";
import { money, computeFees } from "@/lib/money";
import { getGateway, FakeGateway } from "@/lib/stripe";
import { getOrCreateConnectAccount, markConnectComplete } from "@/lib/data/connect";
import { getMyPayments } from "@/lib/data/payments";
import { getMyNotifications } from "@/lib/data/notifications";
import {
  createLeague,
  addLeagueDivision,
  publishLeague,
  getLeague,
  getLeagueBySlug,
  getLeaguesInCity,
  getMyLeagueRegistrations,
  getLeagueDivision,
  addLeagueTeam,
  registerForLeague,
  confirmLeaguePayment,
  markLeagueRegRefunded,
  generateSchedule,
  materializeStandings,
  reportScore,
  confirmScore,
  setAvailability,
  cancelLeague,
  type AddLeagueDivisionInput,
} from "@/lib/data/leagues";
import type { ScheduleMatchItem } from "@/lib/db/types";

/**
 * Stage 7 Leagues data layer against DynamoDB Local (§7.2–7.3, §10, §9.5 patterns
 * 20/21). Skipped without DYNAMODB_ENDPOINT. Every id is namespaced per-run so the
 * suite is parallel-safe + re-runnable on the shared Test table.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY = `zz#league#${RUN}`;
const START = "2099-06-15";
const uid = (s: string) => `l-${RUN}-${s}`;

/** Count DynamoDB `Query` ops a call issues (the §9.5 "one query" rule). */
async function countQueries<T>(fn: () => Promise<T>): Promise<{ result: T; queries: number }> {
  const spy = vi.spyOn(getDocClient(), "send");
  const start = spy.mock.calls.length;
  const result = await fn();
  const queries = spy.mock.calls.slice(start).filter((c) => c[0] instanceof QueryCommand).length;
  spy.mockRestore();
  return { result, queries };
}

async function connectComplete(organizer: string): Promise<void> {
  await getOrCreateConnectAccount(organizer, `${organizer}@example.com`);
  await markConnectComplete(organizer);
}

interface FeeOpts {
  feeMode?: "absorb" | "passThrough";
  feePercentBps?: number;
  feeFixed?: number;
}

async function makePublished(
  organizer: string,
  divisions: AddLeagueDivisionInput[],
  fee: FeeOpts = {},
  seasonWeeks = 3,
) {
  const league = await createLeague({
    organizerId: organizer,
    title: `Test League ${RUN}`,
    cityKey: CITY,
    startDate: START,
    seasonWeeks,
    feeMode: fee.feeMode ?? "absorb",
    feePercentBps: fee.feePercentBps ?? 0,
    feeFixed: fee.feeFixed ?? 0,
  });
  const created = [];
  for (const div of divisions) created.push(await addLeagueDivision(league.lid, div));
  const published = await publishLeague(league.lid);
  return { league: published, lid: league.lid, dids: created.map((c) => c.did) };
}

/** register → paid (confirmLeaguePayment, the integrator wires this into the webhook). */
async function registerAndPay(lid: string, did: string, player: string) {
  const { registration } = await registerForLeague(lid, did, player, {});
  const res = await confirmLeaguePayment({
    lid,
    did,
    uid: player,
    paymentIntentId: registration.paymentIntentId,
    amountTotal: registration.amount!.amount,
    currency: registration.amount!.currency,
  });
  expect(res.ok).toBe(true);
  return registration;
}

d("leagues data layer (DynamoDB Local)", () => {
  it("uses the deterministic FakeGateway (no STRIPE_SECRET_KEY)", () => {
    expect(getGateway().mode).toBe("fake");
  });

  it("patterns 20/21 resolve in ONE Query (no scans)", async () => {
    const organizer = uid("org1");
    await connectComplete(organizer);
    const { league, lid, dids } = await makePublished(organizer, [
      { name: "3.5 Singles", price: money(2500), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const player = uid("p1");
    await registerForLeague(lid, did, player, {});

    // Pattern 21 — league + divisions + regs + schedule + standings in ONE Query.
    const q21 = await countQueries(() => getLeague(lid));
    expect(q21.queries).toBe(1);
    expect(q21.result?.league.lid).toBe(lid);
    expect(q21.result?.divisions).toHaveLength(1);
    expect(q21.result?.registrations.map((r) => r.uid)).toContain(player);

    // Pattern 20 — leagues in a city (GSI2) in ONE Query.
    const q20 = await countQueries(() => getLeaguesInCity(CITY));
    expect(q20.queries).toBe(1);
    expect(q20.result.map((l) => l.lid)).toContain(lid);

    // Slug resolves the published meta (GSI3).
    expect((await getLeagueBySlug(league.slug))?.lid).toBe(lid);

    // My registrations (GSI1) in ONE Query (+ a BatchGet hydration).
    const q = await countQueries(() => getMyLeagueRegistrations(player));
    expect(q.queries).toBe(1);
    expect(q.result.map((r) => r.registration.lid)).toContain(lid);
    expect(q.result.find((r) => r.registration.lid === lid)?.league?.title).toBe(league.title);
  });

  it("Connect gate: publish blocked without a complete account + ≥1 division", async () => {
    const organizer = uid("org2");
    const draft = await createLeague({
      organizerId: organizer,
      title: "Gated League",
      cityKey: CITY,
      startDate: START,
    });

    // No divisions yet → 400.
    await expect(publishLeague(draft.lid)).rejects.toMatchObject({ status: 400 });
    await addLeagueDivision(draft.lid, { name: "Open", price: money(1000), playMode: "singles" });
    // Division present but no complete Connect account → 403.
    await expect(publishLeague(draft.lid)).rejects.toMatchObject({ status: 403 });
    await getOrCreateConnectAccount(organizer, `${organizer}@example.com`);
    await expect(publishLeague(draft.lid)).rejects.toMatchObject({ status: 403 }); // still pending
    await markConnectComplete(organizer);
    const published = await publishLeague(draft.lid);
    expect(published.status).toBe("published");
    expect(published.connectedAccountId).toBeTruthy();
  });

  it("capacity race: N concurrent registrations for the LAST spot → exactly one wins, no oversell", async () => {
    const organizer = uid("org3");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "One Spot", price: money(1500), capacity: 1, playMode: "singles" },
    ]);
    const did = dids[0];

    const N = 6;
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => registerForLeague(lid, did, uid(`race-${i}`), {})),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    }
    expect((await getLeagueDivision(lid, did))?.registeredCount).toBe(1);
  });

  it("register variants: solo pending, doubles partner-pending, team, and free-agent", async () => {
    const organizer = uid("org4");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "Singles", price: money(2000), capacity: 20, playMode: "singles" },
      { name: "Doubles", price: money(4000), capacity: 20, playMode: "doubles" },
    ]);
    const [singlesDid, doublesDid] = dids;

    const solo = await registerForLeague(lid, singlesDid, uid("s-solo"), {});
    expect(solo.status).toBe("pending");
    expect(solo.registration.paymentStatus).toBe("pending");

    const partnered = await registerForLeague(lid, doublesDid, uid("d-1"), {
      partnerUid: uid("d-2"),
    });
    expect(partnered.status).toBe("partnerPending");
    expect(partnered.registration.partnerStatus).toBe("pending");
    expect(partnered.registration.partnerUid).toBe(uid("d-2"));

    // A team entry references a REAL team in that division whose member is the registrant
    // (an arbitrary teamId is now rejected — L4).
    const teamer = uid("t-1");
    const team = await addLeagueTeam(lid, doublesDid, { name: "Team A", memberUids: [teamer] });
    const teamed = await registerForLeague(lid, doublesDid, teamer, { teamId: team.teamId });
    expect(teamed.registration.teamId).toBe(team.teamId);

    const freeAgent = await registerForLeague(lid, singlesDid, uid("fa-1"), { freeAgent: true });
    expect(freeAgent.registration.freeAgent).toBe(true);
    expect(freeAgent.status).toBe("pending");
  });

  it("register → Checkout → confirmLeaguePayment: REG paid ↔ exactly ONE Payment (idempotent)", async () => {
    const organizer = uid("org5");
    await connectComplete(organizer);
    // absorb, 5% + $0.30 on a $30 entry.
    const { lid, dids } = await makePublished(
      organizer,
      [{ name: "Pay Div", price: money(3000), capacity: 8, playMode: "singles" }],
      { feeMode: "absorb", feePercentBps: 500, feeFixed: 30 },
    );
    const did = dids[0];
    const player = uid("p5");

    const { regKey, registration } = await registerForLeague(lid, did, player, {});
    const breakdown = computeFees(money(3000), { mode: "absorb", percentBps: 500, fixed: 30 });
    expect(breakdown.applicationFee.amount).toBe(180);
    expect(registration.amount?.amount).toBe(3000);
    expect(registration.applicationFee?.amount).toBe(180);
    expect(registration.paymentStatus).toBe("pending");
    expect(regKey).toBe(`${did}#${player}`);
    // Checkout carries the destination + application fee + kind:"league" metadata.
    expect(typeof registration.checkoutSessionId).toBe("string");
    // Spot reserved up-front (count already 1 before payment).
    expect((await getLeagueDivision(lid, did))?.registeredCount).toBe(1);

    const first = await confirmLeaguePayment({
      lid,
      did,
      uid: player,
      paymentIntentId: registration.paymentIntentId,
      amountTotal: 3000,
      currency: "usd",
    });
    expect(first.ok).toBe(true);
    expect(first.registration?.paymentStatus).toBe("paid");

    // Idempotent replay (a sibling event) → already-paid, no second Payment.
    const replay = await confirmLeaguePayment({ lid, did, uid: player });
    expect(replay.alreadyPaid).toBe(true);

    const detail = await getLeague(lid);
    expect(detail!.registrations.find((r) => r.uid === player)?.paymentStatus).toBe("paid");
    expect((await getLeagueDivision(lid, did))?.registeredCount).toBe(1);
    const payments = (await getMyPayments(player)).filter((p) => p.refId === lid);
    expect(payments).toHaveLength(1);
    expect(payments[0].kind).toBe("league");
    expect(payments[0].amount.amount).toBe(3000);
    expect(payments[0].applicationFee?.amount).toBe(180);
  });

  it("two-party handshake: report → notify opponent → confirm → standings; mismatch → conflict", async () => {
    const organizer = uid("org6");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(
      organizer,
      [{ name: "RR Div", price: money(1000), capacity: 8, playMode: "singles" }],
      {},
      3,
    );
    const did = dids[0];
    const players = [uid("h-1"), uid("h-2"), uid("h-3"), uid("h-4")];
    for (const p of players) await registerAndPay(lid, did, p);

    const schedule = await generateSchedule(lid);
    // 4 entrants over 3 weeks → 6 fixtures (a full round robin, each pair once).
    expect(schedule).toHaveLength(6);
    const week1: ScheduleMatchItem[] = (await getLeague(lid))!.schedule.filter((m) => m.week === 1);
    expect(week1).toHaveLength(2);

    // Fixture 0 — the happy path: report by side A, confirm by side B.
    const fx0 = week1[0];
    const reporter = fx0.sideA![0];
    const confirmer = fx0.sideB![0];
    const reported = await reportScore(lid, 1, fx0.mid, reporter, 11, 5);
    expect(reported.confirmStatus).toBe("reported");
    expect(reported.reportedBy).toBe(reporter);

    // The opponent is notified to confirm (handshake fan-out).
    const notifs = await getMyNotifications(confirmer);
    expect(notifs.some((n) => n.title.includes("Confirm"))).toBe(true);

    const confirmed = await confirmScore(lid, 1, fx0.mid, confirmer);
    expect(confirmed.confirmStatus).toBe("confirmed");
    expect(confirmed.confirmedBy).toBe(confirmer);

    // Standings were re-materialized: the winner (side A, 11-5) has a win.
    const standings = (await getLeague(lid))!.standings.filter((s) => s.did === did);
    expect(standings.length).toBeGreaterThan(0);
    expect(standings.find((s) => s.entrantId === reporter)?.wins).toBe(1);

    // Fixture 1 — the reporter cannot confirm their own report; a dispute → conflict.
    const fx1 = week1[1];
    const rep1 = fx1.sideA![0];
    const conf1 = fx1.sideB![0];
    await reportScore(lid, 1, fx1.mid, rep1, 9, 11);
    await expect(confirmScore(lid, 1, fx1.mid, rep1)).rejects.toMatchObject({ status: 403 });
    const conflicted = await confirmScore(lid, 1, fx1.mid, conf1, { agree: false });
    expect(conflicted.confirmStatus).toBe("conflict");
  });

  it("materializeStandings recomputes ranked rows from confirmed results", async () => {
    const organizer = uid("org7");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(
      organizer,
      [{ name: "Standings Div", price: money(1000), capacity: 8, playMode: "singles" }],
      {},
      3,
    );
    const did = dids[0];
    const players = [uid("st-1"), uid("st-2"), uid("st-3"), uid("st-4")];
    for (const p of players) await registerAndPay(lid, did, p);
    await generateSchedule(lid);

    // Confirm every week-1 fixture with side A winning big.
    const week1 = (await getLeague(lid))!.schedule.filter((m) => m.week === 1);
    for (const fx of week1) {
      await reportScore(lid, 1, fx.mid, fx.sideA![0], 11, 2);
      await confirmScore(lid, 1, fx.mid, fx.sideB![0]);
    }
    const rows = await materializeStandings(lid);
    const forDiv = rows.filter((r) => r.did === did).sort((a, b) => a.rank - b.rank);
    expect(forDiv).toHaveLength(4);
    expect(forDiv.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    // Two side-A winners share the top two ranks (each 1-0, +9).
    expect(forDiv[0].wins).toBe(1);
    expect(forDiv[1].wins).toBe(1);
    expect(forDiv[2].wins).toBe(0);
  });

  it("M10: regenerating for a SHRUNK roster deletes orphaned fixtures (no stale confirmed rows double-count)", async () => {
    const organizer = uid("org-m10");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(
      organizer,
      [{ name: "Reschedule Div", price: money(1000), capacity: 8, playMode: "singles" }],
      {},
      1, // one season week keeps the fixture set small + deterministic
    );
    const did = dids[0];

    // 6 paid → 3 fixtures in week 1 (mids did-0000..did-0002).
    const players = Array.from({ length: 6 }, (_, i) => uid(`m10-${i}`));
    for (const p of players) await registerAndPay(lid, did, p);
    await generateSchedule(lid);
    let week1 = (await getLeague(lid))!.schedule.filter((m) => m.week === 1);
    expect(week1).toHaveLength(3);

    // Play + confirm every week-1 fixture → 3 confirmed results.
    for (const fx of week1) {
      await reportScore(lid, 1, fx.mid, fx.sideA![0], 11, 2);
      await confirmScore(lid, 1, fx.mid, fx.sideB![0]);
    }
    expect(
      (await getLeague(lid))!.schedule.filter((m) => m.confirmStatus === "confirmed"),
    ).toHaveLength(3);

    // Two players are refunded → 4 paid remain → 2 fixtures/week. Regenerate.
    await markLeagueRegRefunded({ lid, did, uid: players[4], amountRefunded: 1000, currency: "usd" });
    await markLeagueRegRefunded({ lid, did, uid: players[5], amountRefunded: 1000, currency: "usd" });
    await generateSchedule(lid);

    // Pre-fix: the old 3rd fixture (did-0002, confirmed) survives as an orphan → week 1
    // still shows 3 rows, one still `confirmed`. Post-fix it's deleted: exactly 2 rows,
    // both freshly `scheduled`, so materializeStandings can't double-count a ghost result.
    week1 = (await getLeague(lid))!.schedule.filter((m) => m.week === 1);
    expect(week1).toHaveLength(2);
    expect(
      (await getLeague(lid))!.schedule.filter((m) => m.confirmStatus === "confirmed"),
    ).toHaveLength(0);

    const rows = (await materializeStandings(lid)).filter((r) => r.did === did);
    expect(rows.every((r) => r.wins === 0)).toBe(true); // clean slate after a full regen
  });

  it("M24: a FREE league (price 0) registers as PAID immediately — no $0 Checkout", async () => {
    const organizer = uid("org-m24");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "Free Div", price: money(0), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const player = uid("m24-p");

    // No webhook / confirm call — a free join must fulfil in registerForLeague itself.
    await registerForLeague(lid, did, player, {});

    const reg = (await getLeague(lid))!.registrations.find((r) => r.uid === player);
    expect(reg?.paymentStatus).toBe("paid"); // pre-fix: stuck `pending` (a $0 session, no webhook)
    expect((await getLeagueDivision(lid, did))?.registeredCount).toBe(1);
  });

  it("availability: upserts the member's weekly sub-pool flag", async () => {
    const organizer = uid("org8");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "Avail Div", price: money(1000), capacity: 8, playMode: "singles" },
    ]);
    const member = uid("a-1");
    // Only a registered player may set availability (§7.2) — register + pay first.
    await registerAndPay(lid, dids[0], member);
    const first = await setAvailability(lid, member, 2, "out", "away");
    expect(first.status).toBe("out");
    const second = await setAvailability(lid, member, 2, "sub");
    expect(second.status).toBe("sub");
    // Upsert (same key) — the availability rides in the one-query league detail.
    const avail = (await getLeague(lid))!.availability.filter((a) => a.uid === member);
    expect(avail).toHaveLength(1);
    expect(avail[0].status).toBe("sub");
    expect(avail[0].createdAt).toBe(first.createdAt); // preserved across the upsert

    // A non-registered user cannot set availability (access-control gate, §7.2).
    await expect(setAvailability(lid, uid("a-stranger"), 2, "in")).rejects.toThrow(/registered player/i);
  });

  it("M8: two concurrent full refunds for one league reg free the division spot exactly ONCE", async () => {
    const organizer = uid("org-m8");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "M8 Div", price: money(2000), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];

    const target = uid("m8-target");
    await registerAndPay(lid, did, target);
    await registerAndPay(lid, did, uid("m8-other"));
    expect((await getLeagueDivision(lid, did))?.registeredCount).toBe(2);

    // Duplicate charge.refunded webhooks race for the SAME reg. Post-fix the conditional
    // paid→refunded transition wins for exactly one caller → exactly one release, whatever
    // the interleaving (identical code path to the tournaments M8 case, which reproduces
    // the pre-fix double-release red→green; dynalite serializes this pair unpredictably).
    await Promise.all([
      markLeagueRegRefunded({ lid, did, uid: target, amountRefunded: 2000, currency: "usd" }),
      markLeagueRegRefunded({ lid, did, uid: target, amountRefunded: 2000, currency: "usd" }),
    ]);

    expect((await getLeagueDivision(lid, did))?.registeredCount).toBe(1); // freed exactly once
    const detail = await getLeague(lid);
    expect(detail!.registrations.find((r) => r.uid === target)?.paymentStatus).toBe("refunded");
  });

  it("L4: registration rejects a teamId the caller doesn't own in this division", async () => {
    const organizer = uid("org-l4");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "L4 Div", price: money(1000), capacity: 8, playMode: "doubles" },
    ]);
    const did = dids[0];
    const member = uid("l4-member");
    const outsider = uid("l4-outsider");
    const team = await addLeagueTeam(lid, did, { name: "Real Team", memberUids: [member] });

    // A made-up teamId → 400 (no such team).
    await expect(
      registerForLeague(lid, did, member, { teamId: `${team.teamId}-nope` }),
    ).rejects.toMatchObject({ status: 400 });
    // A real team, but the caller isn't a member → 403 (can't hijack another team's entrant).
    await expect(
      registerForLeague(lid, did, outsider, { teamId: team.teamId }),
    ).rejects.toMatchObject({ status: 403 });

    // The member registering with their OWN team succeeds.
    const ok = await registerForLeague(lid, did, member, { teamId: team.teamId });
    expect(ok.registration.teamId).toBe(team.teamId);
  });

  it("cancelLeague mass-refunds every paid registration (organizer-cancel ⇒ fee refunded)", async () => {
    const organizer = uid("org9");
    await connectComplete(organizer);
    const { lid, dids } = await makePublished(organizer, [
      { name: "Cancel Div", price: money(2500), capacity: 8, playMode: "singles" },
    ]);
    const did = dids[0];
    const gateway = getGateway() as FakeGateway;

    const players = [uid("c-1"), uid("c-2"), uid("c-3")];
    for (const p of players) await registerAndPay(lid, did, p);

    const before = gateway.refunds.length;
    const result = await cancelLeague(lid);
    expect(result.league.status).toBe("cancelled");
    expect(result.refunded).toBe(players.length);

    const newRefunds = gateway.refunds.slice(before);
    expect(newRefunds).toHaveLength(players.length);
    expect(newRefunds.every((r) => r.refundApplicationFee === true)).toBe(true);

    const detail = await getLeague(lid);
    expect(detail!.registrations.every((r) => r.paymentStatus === "refunded")).toBe(true);
    // Cancelled leagues drop from the city finder.
    expect((await getLeaguesInCity(CITY)).map((l) => l.lid)).not.toContain(lid);
  });
});
