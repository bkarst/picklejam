/**
 * Minimal item factories for the tournament component tests. Only the fields the
 * components read are meaningful; keys/stamps are filled to satisfy the types.
 */

import type { DivisionItem, BracketMatchItem, StoredMoney } from "@/lib/db/types";

export const usd = (amount: number): StoredMoney => ({ amount, currency: "usd" });

export function makeDivision(over: Partial<DivisionItem> = {}): DivisionItem {
  const did = over.did ?? "d1";
  return {
    pk: "TOURNEY#t1",
    sk: `DIVISION#${did}`,
    entity: "DIVISION",
    tid: "t1",
    did,
    name: "Men's Doubles 3.5",
    price: usd(3000),
    playMode: "doubles",
    gender: "mens",
    registeredCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeBracketMatch(over: Partial<BracketMatchItem> = {}): BracketMatchItem {
  const round = over.round ?? 1;
  const index = over.index ?? 0;
  return {
    pk: "TOURNEY#t1",
    sk: `BRACKET#d1#R${String(round).padStart(3, "0")}#M${String(index).padStart(2, "0")}`,
    entity: "BRACKETMATCH",
    tid: "t1",
    did: "d1",
    round,
    index,
    ...over,
  };
}
