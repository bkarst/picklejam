/**
 * Minimal item factories for the ladder component tests.
 */

import type { LadderItem, RungItem, ChallengeItem, StoredMoney } from "@/lib/db/types";

export const usd = (amount: number): StoredMoney => ({ amount, currency: "usd" });

export function makeLadder(over: Partial<LadderItem> = {}): LadderItem {
  return {
    pk: "LADDER#lad1",
    sk: "META",
    entity: "LADDER",
    lid: "lad1",
    title: "Monday Night Ladder",
    slug: "monday-night-ladder",
    cityKey: "us#tx#austin",
    organizerId: "org1",
    status: "published",
    startDate: "2026-07-06",
    currency: "usd",
    feeMode: "passThrough",
    feePercentBps: 500,
    feeFixed: 30,
    price: usd(1500),
    challengeRange: 3,
    responseWindowDays: 3,
    playMode: "singles",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeRung(over: Partial<RungItem> = {}): RungItem {
  const position = over.position ?? 1;
  return {
    pk: "LADDER#lad1",
    sk: `RUNG#${String(position).padStart(2, "0")}`,
    entity: "RUNG",
    lid: "lad1",
    position,
    uid: `u${position}`,
    displayName: `Player ${position}`,
    rating: 1500,
    paymentStatus: "paid",
    wins: 3,
    losses: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeChallenge(over: Partial<ChallengeItem> = {}): ChallengeItem {
  const cid = over.cid ?? "c1";
  return {
    pk: "LADDER#lad1",
    sk: `CHALLENGE#${cid}`,
    entity: "CHALLENGE",
    lid: "lad1",
    cid,
    challengerUid: "u3",
    challengedUid: "u1",
    challengerPos: 3,
    challengedPos: 1,
    status: "open",
    dueDate: "2030-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}
