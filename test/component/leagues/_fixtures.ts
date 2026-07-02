/**
 * Minimal item factories for the league component tests. Only the fields the
 * components read are meaningful; keys/stamps are filled to satisfy the types.
 */

import type {
  LeagueItem,
  LeagueDivisionItem,
  LeagueTeamItem,
  ScheduleMatchItem,
  LeagueStandingItem,
  StoredMoney,
} from "@/lib/db/types";

export const usd = (amount: number): StoredMoney => ({ amount, currency: "usd" });

export function makeLeague(over: Partial<LeagueItem> = {}): LeagueItem {
  return {
    pk: "LEAGUE#l1",
    sk: "META",
    entity: "LEAGUE",
    lid: "l1",
    title: "Wednesday Night 3.5 Doubles",
    slug: "wednesday-night-35-doubles",
    cityKey: "us#ks#lenexa",
    organizerId: "org1",
    status: "published",
    startDate: "2026-07-08",
    seasonWeeks: 8,
    currency: "usd",
    feeMode: "passThrough",
    feePercentBps: 500,
    feeFixed: 30,
    playMode: "doubles",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeLeagueDivision(over: Partial<LeagueDivisionItem> = {}): LeagueDivisionItem {
  const did = over.did ?? "d1";
  return {
    pk: "LEAGUE#l1",
    sk: `DIVISION#${did}`,
    entity: "LEAGUEDIVISION",
    lid: "l1",
    did,
    name: "A Division",
    price: usd(8000),
    playMode: "doubles",
    registeredCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeTeam(over: Partial<LeagueTeamItem> = {}): LeagueTeamItem {
  const teamId = over.teamId ?? "t1";
  return {
    pk: "LEAGUE#l1",
    sk: `TEAM#${teamId}`,
    entity: "LEAGUETEAM",
    lid: "l1",
    teamId,
    did: "d1",
    name: "Pickle Pros",
    memberUids: ["u1", "u2"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeScheduleMatch(over: Partial<ScheduleMatchItem> = {}): ScheduleMatchItem {
  const week = over.week ?? 1;
  const mid = over.mid ?? "m1";
  return {
    pk: "LEAGUE#l1",
    sk: `WEEK#${String(week).padStart(3, "0")}#MATCH#${mid}`,
    entity: "SCHEDULEMATCH",
    lid: "l1",
    did: "d1",
    week,
    mid,
    sideA: ["t1"],
    sideB: ["t2"],
    confirmStatus: "scheduled",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function makeStanding(over: Partial<LeagueStandingItem> = {}): LeagueStandingItem {
  const rank = over.rank ?? 1;
  return {
    pk: "LEAGUE#l1",
    sk: `STANDING#d1#${String(rank).padStart(2, "0")}`,
    entity: "LEAGUESTANDING",
    lid: "l1",
    did: "d1",
    entrantId: "t1",
    rank,
    wins: 6,
    losses: 1,
    ties: 0,
    pointsFor: 27,
    pointsAgainst: 12,
    pointDiff: 15,
    played: 7,
    ...over,
  };
}
