// Aggregates apply inline and TransactWrite is emulated sequentially (dynalite has
// no TransactWriteItems); both must be set BEFORE the data layer reads them. The
// webhook secret matches the Stripe seam default; no STRIPE_SECRET_KEY ⇒ the
// deterministic FakeGateway backs Checkout / Connect.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_pickleloko";

import { describe, it, expect, vi } from "vitest";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
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
