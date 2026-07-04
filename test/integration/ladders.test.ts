// Aggregates apply inline and TransactWrite is emulated sequentially (dynalite has
// no TransactWriteItems); both must be set BEFORE the data layer reads them. The
// webhook secret matches the Stripe seam default; no STRIPE_SECRET_KEY ⇒ the
// deterministic FakeGateway backs Checkout / Connect.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_pickleloko";

import { describe, it, expect, vi } from "vitest";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getDocClient } from "@/lib/db/table";
import { money } from "@/lib/money";
import { getGateway } from "@/lib/stripe";
import { getOrCreateConnectAccount, markConnectComplete } from "@/lib/data/connect";
import { getMyPayments } from "@/lib/data/payments";
import { getMyNotifications } from "@/lib/data/notifications";
import { applyResult } from "@/lib/ladders/rerank";
import {
  createLadder,
  publishLadder,
  getLadder,
  getLadderBySlug,
  getLaddersInCity,
  getMyChallenges,
  registerForLadder,
  confirmLadderPayment,
  markLadderRefunded,
  issueChallenge,
  respondChallenge,
  reportChallengeResult,
  confirmChallengeResult,
  expireChallenges,
} from "@/lib/data/ladders";

/**
 * Stage 7 Ladders data layer against DynamoDB Local (§7.4, §9.5 pattern 22). Skipped
 * without DYNAMODB_ENDPOINT. Every ladder/player id is namespaced per-run, so the
 * suite is parallel-safe + re-runnable. Covers the pattern-22 one-query read, paid
 * placement, challenge eligibility, the ACCEPT RACE, the report→confirm re-rank,
 * response-window expiry, and notification fan-out.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY = `zz#ladder#${RUN}`;
const START = "2099-06-15";
const uid = (s: string) => `l-${RUN}-${s}`;

/** Count how many DynamoDB `Query` operations a call issues (§9.5 "one query" rule). */
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

async function makePublishedLadder(
  organizer: string,
  opts: { challengeRange?: number; responseWindowDays?: number; price?: number } = {},
) {
  const ladder = await createLadder({
    organizerId: organizer,
    title: `Test Ladder ${RUN}`,
    cityKey: CITY,
    startDate: START,
    price: money(opts.price ?? 2000),
    challengeRange: opts.challengeRange ?? 3,
    responseWindowDays: opts.responseWindowDays ?? 7,
  });
  const published = await publishLadder(ladder.lid);
  return { ladder: published, lid: ladder.lid };
}

/** Register + confirm payment (simulating the webhook) → the placed rung. */
async function placePlayer(lid: string, player: string, rating?: number) {
  const reg = await registerForLadder(lid, player, rating !== undefined ? { rating } : {});
  const res = await confirmLadderPayment({
    lid,
    uid: player,
    paymentIntentId: reg.paymentIntentId,
    amountTotal: reg.amount.amount,
    currency: reg.amount.currency,
  });
  return res;
}

/** Place N players in order; returns their uids (bottom placement → positions 1..N). */
async function placeMany(lid: string, names: string[]): Promise<string[]> {
  const players = names.map((n) => uid(n));
  for (const p of players) await placePlayer(lid, p);
  return players;
}

d("ladders data layer (DynamoDB Local)", () => {
  it("uses the deterministic FakeGateway (no STRIPE_SECRET_KEY)", () => {
    expect(getGateway().mode).toBe("fake");
  });

  it("pattern 22: ladder + rungs (rank-ordered) + challenges resolve in ONE Query", async () => {
    const organizer = uid("org1");
    await connectComplete(organizer);
    const { lid, ladder } = await makePublishedLadder(organizer, { challengeRange: 3 });
    const [p1, , p3] = await placeMany(lid, ["a1", "a2", "a3"]);
    await issueChallenge(lid, p3, p1); // p3 (rung 3) → p1 (rung 1), within range 3

    const q22 = await countQueries(() => getLadder(lid));
    expect(q22.queries).toBe(1);
    expect(q22.result?.ladder.lid).toBe(lid);
    expect(q22.result?.rungs.map((r) => r.position)).toEqual([1, 2, 3]); // rank-ordered
    expect(q22.result?.rungs.map((r) => r.uid)).toEqual([p1, uid("a2"), p3]);
    expect(q22.result?.challenges).toHaveLength(1);

    // Slug (GSI3) + city finder (GSI2) resolve the published ladder.
    expect((await getLadderBySlug(ladder.slug))?.lid).toBe(lid);
    expect((await getLaddersInCity(CITY)).map((l) => l.lid)).toContain(lid);
  });

  it("register → confirmLadderPayment places a paid rung + writes exactly one Payment (idempotent)", async () => {
    const organizer = uid("org2");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { price: 2500 });
    const player = uid("p2");

    const res = await placePlayer(lid, player);
    expect(res.ok).toBe(true);
    expect(res.rung?.paymentStatus).toBe("paid");
    expect(res.rung?.position).toBe(1); // bottom of an empty ladder = rung 1

    const payments = (await getMyPayments(player)).filter((p) => p.refId === lid);
    expect(payments).toHaveLength(1);
    expect(payments[0].kind).toBe("ladder");
    expect(payments[0].amount.amount).toBe(2500);
    expect(payments[0].status).toBe("paid");

    // Idempotent replay (sibling webhook event) → no second rung, no second Payment.
    const replay = await confirmLadderPayment({ lid, uid: player, paymentIntentId: res.payment?.paymentIntentId });
    expect(replay.alreadyPaid).toBe(true);
    expect((await getMyPayments(player)).filter((p) => p.refId === lid)).toHaveLength(1);
    expect((await getLadder(lid))!.rungs.filter((r) => r.uid === player)).toHaveLength(1);
  });

  it("rejoin after a refund REUSES the rung (one rung per uid) and the new payment confirms", async () => {
    const organizer = uid("org-rejoin");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { price: 2000 });
    const player = uid("rejoiner");

    // Join + pay → a paid rung.
    const first = await placePlayer(lid, player);
    expect(first.rung?.paymentStatus).toBe("paid");
    const pos = first.rung!.position;

    // charge.refunded webhook → the rung goes terminal (refunded).
    await markLadderRefunded({ lid, uid: player, paymentIntentId: first.payment?.paymentIntentId });
    const afterRefund = (await getLadder(lid))!.rungs.filter((r) => r.uid === player);
    expect(afterRefund).toHaveLength(1);
    expect(afterRefund[0].paymentStatus).toBe("refunded");

    // Rejoin + pay → must REUSE the slot (no second rung) and confirm the NEW payment
    // (pre-fix: a duplicate rung was appended, the webhook confirmed the OLD refunded
    // rung, and this payment was silently dropped as `alreadyPaid`).
    const rejoin = await registerForLadder(lid, player, {});
    const confirmed = await confirmLadderPayment({
      lid,
      uid: player,
      paymentIntentId: rejoin.paymentIntentId,
      amountTotal: rejoin.amount.amount,
      currency: rejoin.amount.currency,
    });
    expect(confirmed.alreadyPaid).toBeFalsy();
    expect(confirmed.rung?.paymentStatus).toBe("paid");

    // Exactly ONE rung for the uid, paid, in the reused slot — no duplicate, no board corruption.
    const rungs = (await getLadder(lid))!.rungs.filter((r) => r.uid === player);
    expect(rungs).toHaveLength(1);
    expect(rungs[0].paymentStatus).toBe("paid");
    expect(rungs[0].position).toBe(pos);

    // Two receipts total: the refunded first join + the paid rejoin (money accounted for).
    const payments = (await getMyPayments(player)).filter((p) => p.refId === lid);
    expect(payments).toHaveLength(2);
    expect(payments.filter((p) => p.status === "paid")).toHaveLength(1);
  });

  it("M11: two concurrent first-joins create exactly ONE rung + one 409 (no double rung / double charge)", async () => {
    const organizer = uid("org-m11");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { price: 2000 });
    const player = uid("m11-dblclick");

    // A double-clicked "Register": two concurrent joins for the SAME uid. RUNG rows are
    // keyed by position, so pre-fix appendRung hands each a DISTINCT seat → two rungs, two
    // payable Checkout sessions, a double charge. The per-uid MEMBER marker serializes them.
    const results = await Promise.allSettled([
      registerForLadder(lid, player, {}),
      registerForLadder(lid, player, {}),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1); // exactly one join wins
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

    // The board holds exactly ONE rung for this uid (pre-fix under the race: two).
    const rungs = (await getLadder(lid))!.rungs.filter((r) => r.uid === player);
    expect(rungs).toHaveLength(1);
    expect(rungs[0].paymentStatus).toBe("pending");

    // And that single rung confirms to exactly one paid rung + one Payment.
    const winner = (ok[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof registerForLadder>>>).value;
    await confirmLadderPayment({
      lid,
      uid: player,
      paymentIntentId: winner.paymentIntentId,
      amountTotal: winner.amount.amount,
      currency: winner.amount.currency,
    });
    expect((await getLadder(lid))!.rungs.filter((r) => r.uid === player)).toHaveLength(1);
    expect((await getMyPayments(player)).filter((p) => p.refId === lid)).toHaveLength(1);
  });

  it("M24: a FREE ladder (price 0) joins immediately — no $0 Checkout, rung paid", async () => {
    const organizer = uid("org-m24");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { price: 0 });
    const player = uid("m24-p");

    const res = await registerForLadder(lid, player, {});
    // No Checkout session — a $0 session is rejected by real Stripe (~$0.50 min).
    expect(res.checkoutSessionId).toBe("");
    expect(res.paymentIntentId).toBe("");
    // The rung is already paid + placed with NO webhook (pre-fix: a $0 session was created
    // and the rung stayed `pending`, so real Stripe would 500 the join).
    const rungs = (await getLadder(lid))!.rungs.filter((r) => r.uid === player);
    expect(rungs).toHaveLength(1);
    expect(rungs[0].paymentStatus).toBe("paid");
  });

  it("DUPR-seeded placement: a rated joiner is inserted above lower-rated players", async () => {
    const organizer = uid("org2b");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer);
    // Seed an established board by rating: 4.5 (top), 3.5 (bottom).
    await placePlayer(lid, uid("hi"), 4.5);
    await placePlayer(lid, uid("lo"), 3.5);
    // A 4.0 joiner should land BETWEEN them (rung 2), not at the bottom.
    await placePlayer(lid, uid("mid"), 4.0);
    const order = (await getLadder(lid))!.rungs.map((r) => r.uid);
    expect(order).toEqual([uid("hi"), uid("mid"), uid("lo")]);
  });

  it("issueChallenge eligibility: self / below / out-of-range rejected; a valid upward challenge is accepted", async () => {
    const organizer = uid("org3");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 2 });
    const [p1, p2, p3, p4] = await placeMany(lid, ["b1", "b2", "b3", "b4"]);

    await expect(issueChallenge(lid, p3, p3)).rejects.toMatchObject({ status: 400 }); // self
    await expect(issueChallenge(lid, p1, p4)).rejects.toMatchObject({ status: 400 }); // target below
    await expect(issueChallenge(lid, p4, p1)).rejects.toMatchObject({ status: 400 }); // out of range (3 > 2)
    await expect(issueChallenge(lid, p3, uid("ghost"))).rejects.toMatchObject({ status: 400 }); // not a player

    const ch = await issueChallenge(lid, p3, p1); // rung 3 → rung 1, diff 2 == range
    expect(ch.status).toBe("open");
    expect(ch.challengerUid).toBe(p3);
    expect(ch.challengedUid).toBe(p1);
    // Duplicate active challenge between the same pair is rejected.
    await expect(issueChallenge(lid, p3, p1)).rejects.toMatchObject({ status: 409 });
    void p2;
  });

  it("ACCEPT RACE: two concurrent responses → exactly one wins (conditional write)", async () => {
    const organizer = uid("org4");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 3 });
    const [p1, , p3] = await placeMany(lid, ["c1", "c2", "c3"]);
    const challenge = await issueChallenge(lid, p3, p1); // p1 is the challenged player

    const results = await Promise.allSettled([
      respondChallenge(lid, challenge.cid, p1, true),
      respondChallenge(lid, challenge.cid, p1, true),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1); // only one response can win
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

    const after = (await getLadder(lid))!.challenges.find((c) => c.cid === challenge.cid);
    expect(after?.status).toBe("accepted");
  });

  it("report + both-confirm → RUNG re-rank matches applyResult (upset moves challenger up)", async () => {
    const organizer = uid("org5");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 3 });
    const [p1, p2, p3, p4] = await placeMany(lid, ["e1", "e2", "e3", "e4"]);
    const before = [p1, p2, p3, p4];

    const ch = await issueChallenge(lid, p4, p2); // rung 4 challenges rung 2
    await respondChallenge(lid, ch.cid, p2, true); // challenged accepts
    const reported = await reportChallengeResult(lid, ch.cid, p4, 11, 5); // challenger wins
    expect(reported.status).toBe("reported");
    expect(reported.winnerUid).toBe(p4);
    expect(reported.reportedBy).toBe(p4);

    // The reporter cannot self-confirm; the other party finalizes.
    await expect(confirmChallengeResult(lid, ch.cid, p4)).rejects.toMatchObject({ status: 400 });
    const confirmed = await confirmChallengeResult(lid, ch.cid, p2);
    expect(confirmed.status).toBe("confirmed");

    const rungs = (await getLadder(lid))!.rungs;
    const order = rungs.map((r) => r.uid);
    expect(order).toEqual(applyResult(before, p4, p2, p4)); // == [p1, p4, p2, p3]
    expect(order).toEqual([p1, p4, p2, p3]);
    // Win/loss tally.
    expect(rungs.find((r) => r.uid === p4)?.wins).toBe(1);
    expect(rungs.find((r) => r.uid === p2)?.losses).toBe(1);
  });

  it("M12: a re-rank failure during confirm leaves the challenge RETRYABLE (not stuck confirmed)", async () => {
    const organizer = uid("org-m12");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 3 });
    const [p1, p2, p3, p4] = await placeMany(lid, ["m12a", "m12b", "m12c", "m12d"]);
    const before = [p1, p2, p3, p4];

    const ch = await issueChallenge(lid, p4, p2); // rung 4 challenges rung 2
    await respondChallenge(lid, ch.cid, p2, true);
    await reportChallengeResult(lid, ch.cid, p4, 11, 5); // challenger wins the upset

    // Force the re-rank to fail: reject the board's optimistic version bump (the first item
    // of reorderBoard's transaction) on EVERY attempt, exhausting its 6 retries so
    // applyOutcome throws — exactly the "busy ladder" contention the bug hinges on.
    const client = getDocClient();
    const realSend = client.send.bind(client);
    const spy = vi.spyOn(client, "send").mockImplementation((async (cmd: { constructor: { name: string }; input?: { UpdateExpression?: string } }) =>
      cmd?.constructor?.name === "UpdateCommand" && (cmd.input?.UpdateExpression ?? "").includes("rungsVersion")
        ? Promise.reject(new ConditionalCheckFailedException({ message: "forced contention", $metadata: {} }))
        : realSend(cmd as never)) as never);

    // The confirm throws (the re-rank couldn't commit)…
    await expect(confirmChallengeResult(lid, ch.cid, p2)).rejects.toMatchObject({ status: 409 });
    spy.mockRestore();

    // …but the challenge was ROLLED BACK to `reported` and the board is untouched. Pre-fix
    // it stayed stuck `confirmed` with the upset never applied, and every retry 409'd on the
    // `#st = :reported` gate → the result was lost with no way to recover.
    expect((await getLadder(lid))!.challenges.find((c) => c.cid === ch.cid)?.status).toBe("reported");
    expect((await getLadder(lid))!.rungs.map((r) => r.uid)).toEqual(before);

    // Retry now that contention has cleared → confirms AND applies the upset.
    const confirmed = await confirmChallengeResult(lid, ch.cid, p2);
    expect(confirmed.status).toBe("confirmed");
    expect((await getLadder(lid))!.rungs.map((r) => r.uid)).toEqual([p1, p4, p2, p3]);
  });

  it("response-window expiry: an unanswered challenge expires to a challenger forfeit-win + re-ranks", async () => {
    const organizer = uid("org6");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 3, responseWindowDays: 3 });
    const [p1, p2, p3] = await placeMany(lid, ["f1", "f2", "f3"]);

    const ch = await issueChallenge(lid, p3, p1); // rung 3 → rung 1
    // Not yet due → nothing expires.
    expect(await expireChallenges(lid, new Date().toISOString())).toBe(0);

    // Past the window → the challenge expires (challenger wins by forfeit).
    const past = new Date(new Date(ch.dueDate).getTime() + 1).toISOString();
    expect(await expireChallenges(lid, past)).toBe(1);

    const detail = await getLadder(lid);
    expect(detail!.challenges.find((c) => c.cid === ch.cid)?.status).toBe("expired");
    expect(detail!.rungs.map((r) => r.uid)).toEqual(applyResult([p1, p2, p3], p3, p1, p3)); // [p3, p1, p2]
  });

  it("M12: an expire re-rank failure leaves the challenge OPEN (retryable next sweep), not stuck expired", async () => {
    const organizer = uid("org-m12b");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 3, responseWindowDays: 3 });
    const [p1, p2, p3] = await placeMany(lid, ["m12e", "m12f", "m12g"]);
    const before = [p1, p2, p3];

    const ch = await issueChallenge(lid, p3, p1); // rung 3 → rung 1
    const past = new Date(new Date(ch.dueDate).getTime() + 1).toISOString();

    // Force the forfeit re-rank to fail (same version-bump rejection as the confirm case).
    const client = getDocClient();
    const realSend = client.send.bind(client);
    const spy = vi.spyOn(client, "send").mockImplementation((async (cmd: { constructor: { name: string }; input?: { UpdateExpression?: string } }) =>
      cmd?.constructor?.name === "UpdateCommand" && (cmd.input?.UpdateExpression ?? "").includes("rungsVersion")
        ? Promise.reject(new ConditionalCheckFailedException({ message: "forced contention", $metadata: {} }))
        : realSend(cmd as never)) as never);

    // The sweep can't apply the forfeit → it rolls the status back to `open` and reports 0
    // expired (pre-fix: the flip to `expired` committed, then applyOutcome threw and the
    // whole sweep rejected, leaving the challenge stuck `expired` with no forfeit applied).
    expect(await expireChallenges(lid, past)).toBe(0);
    spy.mockRestore();

    expect((await getLadder(lid))!.challenges.find((c) => c.cid === ch.cid)?.status).toBe("open");
    expect((await getLadder(lid))!.rungs.map((r) => r.uid)).toEqual(before);

    // Next sweep (contention cleared) expires + re-ranks it.
    expect(await expireChallenges(lid, past)).toBe(1);
    expect((await getLadder(lid))!.rungs.map((r) => r.uid)).toEqual(applyResult(before, p3, p1, p3));
  });

  it("notifications: the challenged player is notified, and the challenge lands in their inbox (GSI1)", async () => {
    const organizer = uid("org7");
    await connectComplete(organizer);
    const { lid } = await makePublishedLadder(organizer, { challengeRange: 3 });
    const [p1, , p3] = await placeMany(lid, ["g1", "g2", "g3"]);

    const ch = await issueChallenge(lid, p3, p1);

    const notifs = await getMyNotifications(p1);
    expect(notifs.some((n) => n.type === "system" && /challenged/i.test(n.title))).toBe(true);

    // getMyChallenges (GSI1) returns challenges where I'm the CHALLENGED player.
    const inbox = await getMyChallenges(p1);
    expect(inbox.map((c) => c.cid)).toContain(ch.cid);
    // The challenger is NOT the challenged party → their inbox is empty of this one.
    expect((await getMyChallenges(p3)).map((c) => c.cid)).not.toContain(ch.cid);
  });
});
