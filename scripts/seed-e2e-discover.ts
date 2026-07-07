#!/usr/bin/env tsx
/**
 * seed-e2e-discover.ts — real, filter-distinguishable test data for the unified
 * "near me" finder (/find). Everything lives in Lawrence, KS (`us#kansas#lawrence`,
 * the same city the other e2e seeds use), so the finder surfaces it near that
 * metro. Idempotent (skips anything already present).
 *
 * The dataset is deliberately spread so EVERY filter is demonstrable:
 *   • size          — groups 4–10, leagues 4/6, ladders 4/6, tournaments 4/8
 *   • avg DUPR      — a high-level cohort (~4.4–4.6) vs a rec cohort (~3.2)
 *   • games / month — an ACTIVE variant (recent meetups/matches/challenges) and an
 *                     INACTIVE variant of each type (tournaments have no activity)
 *
 * Twelve players get real `RATING#DUPR` rows; groups/leagues/ladders/tournaments
 * reference them as members/registrants/rungs so `avgDupr` computes for real.
 *
 * Run — local (dynalite): provision + `npm run ingest -- --state kansas` first, then
 *   APP_ENV=Test DYNAMODB_ENDPOINT=http://localhost:8000 \
 *   DYNAMO_EMULATE_TRANSACTIONS=1 STREAMS_INLINE=1 \
 *   npx tsx scripts/seed-e2e-discover.ts
 * Run — real AWS Dev table: `npx tsx --env-file=.env scripts/seed-e2e-discover.ts`
 *   (drop DYNAMO_EMULATE_TRANSACTIONS / STREAMS_INLINE — real DynamoDB handles both).
 */

import { getCourtBySlug } from "@/lib/data/courts";
import { getOrCreateConnectAccount, markConnectComplete } from "@/lib/data/connect";
import { createGroup, joinGroup, approveMember, getGroup } from "@/lib/data/groups";
import { createOuting, getOutingMeta } from "@/lib/data/outings";
import {
  createLeague,
  addLeagueDivision,
  publishLeague,
  registerForLeague,
  confirmLeaguePayment,
  generateSchedule,
  getLeague,
} from "@/lib/data/leagues";
import {
  createLadder,
  publishLadder,
  registerForLadder,
  confirmLadderPayment,
  getLadder,
} from "@/lib/data/ladders";
import {
  createTournament,
  addDivision,
  publishTournament,
  registerForDivision,
  confirmRegistrationPayment,
  getTournament,
} from "@/lib/data/tournaments";
import { putItem, queryAll } from "@/lib/db/client";
import { userKeys, leagueKeys, ladderKeys } from "@/lib/db/keys";
import { devUid } from "@/lib/auth/dev";
import { money } from "@/lib/money";
import type { RatingItem, RungItem, ScheduleMatchItem } from "@/lib/db/types";

const SLUG = { country: "us", state: "kansas", city: "lawrence", slug: "sports-pavilion-at-rock-chalk-park" };
const FUTURE = "2026-10-01"; // yyyy-mm-dd start for the events

/** The rated player pool (name → email + DUPR). */
const PLAYERS: Record<string, { email: string; dupr: number }> = {
  ava: { email: "d-ava@dev.local", dupr: 4.7 },
  ben: { email: "d-ben@dev.local", dupr: 4.5 },
  cy: { email: "d-cy@dev.local", dupr: 4.3 },
  kai: { email: "d-kai@dev.local", dupr: 4.9 },
  dee: { email: "d-dee@dev.local", dupr: 4.1 },
  eli: { email: "d-eli@dev.local", dupr: 3.9 },
  fin: { email: "d-fin@dev.local", dupr: 3.7 },
  lux: { email: "d-lux@dev.local", dupr: 4.0 },
  gus: { email: "d-gus@dev.local", dupr: 3.5 },
  hana: { email: "d-hana@dev.local", dupr: 3.3 },
  ivy: { email: "d-ivy@dev.local", dupr: 3.1 },
  jo: { email: "d-jo@dev.local", dupr: 2.9 },
};
const uidOf = (k: string): string => devUid(PLAYERS[k].email);

/** ISO for `days` ago at `hourUtc` — for real "games in the last month". */
function daysAgoIso(days: number, hourUtc = 18): string {
  const d = new Date(Date.now() - days * 86_400_000);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  const court = await getCourtBySlug(SLUG.country, SLUG.state, SLUG.city, SLUG.slug);
  if (!court) throw new Error(`Discover-seed court not found: ${SLUG.slug} (ingest Kansas first)`);
  const CITY = court.cityKey;
  const VENUE = court.name;

  // ── Player ratings (RATING#DUPR) ──
  for (const key of Object.keys(PLAYERS)) {
    const uid = uidOf(key);
    const rating: RatingItem = {
      ...userKeys.rating(uid, "DUPR"),
      entity: "RATING",
      uid,
      system: "DUPR",
      value: PLAYERS[key].dupr,
      verified: true,
      source: "seed",
    };
    await putItem(rating as unknown as Record<string, unknown>);
  }

  // ── A Connect-complete organizer for the paid events ──
  const organizer = devUid("d-organizer@dev.local");
  await getOrCreateConnectAccount(organizer, "d-organizer@dev.local");
  await markConnectComplete(organizer);

  // ── Groups (owner is members[0]) ──
  async function seedGroup(id: string, name: string, members: string[], meetups: number) {
    if (await getGroup(id)) return;
    const owner = uidOf(members[0]);
    await createGroup({
      groupId: id,
      name,
      creatorId: owner,
      cityKey: CITY,
      homeCourtId: court!.courtId,
      visibility: "public",
      // Public groups are request-to-join: a non-member requests and an owner/admin
      // approves before they're in (and can see meet-up times/locations) (§6.9).
      joinPolicy: "request",
      description: `${name} — plays at ${VENUE}.`,
      // Keep the cap above the seeded roster so every join lands.
      maxMembers: 60,
    });
    // Build the roster: each member requests (pending), then the owner approves (active).
    for (const k of members.slice(1)) {
      const uid = uidOf(k);
      await joinGroup(id, uid);
      await approveMember(id, owner, uid);
    }
    for (let i = 0; i < meetups; i++) {
      const oid = `${id}-meet-${i}`;
      if (await getOutingMeta(oid)) continue;
      await createOuting({
        outingId: oid,
        title: `${name} Open Play`,
        courtId: court!.courtId,
        organizerId: owner,
        startTs: daysAgoIso(i * 3 + 2, 18),
        endTs: daysAgoIso(i * 3 + 2, 20),
        type: "open",
        visibility: "public",
        hostType: "GROUP",
        groupId: id,
        capacity: 12,
        waitlist: true,
      });
    }
  }

  await seedGroup("dg-dinkers", "Lawrence Dinkers Club",
    ["gus", "hana", "ivy", "jo", "dee", "eli", "fin", "lux", "cy", "ben"], 6);
  await seedGroup("dg-aces", "Rock Chalk Aces", ["ava", "kai", "ben", "cy"], 3);
  await seedGroup("dg-social", "Sunflower Social Pickleball",
    ["jo", "ivy", "hana", "dee", "eli", "fin"], 0);

  // ── Leagues (singles; one active, one not) ──
  async function seedLeague(id: string, title: string, players: string[], confirmedGames: number) {
    if (await getLeague(id)) return;
    await createLeague({
      lid: id,
      organizerId: organizer,
      title,
      cityKey: CITY,
      startDate: FUTURE,
      seasonWeeks: 4,
      playMode: "singles",
      feeMode: "absorb",
      currency: "usd",
      venueName: VENUE,
    });
    await addLeagueDivision(id, { did: "d1", name: "Open Singles", price: money(1000, "usd"), capacity: 64, playMode: "singles" });
    await publishLeague(id);
    for (const k of players) {
      const uid = uidOf(k);
      await registerForLeague(id, "d1", uid, {});
      await confirmLeaguePayment({ lid: id, did: "d1", uid });
    }
    await generateSchedule(id);
    if (confirmedGames > 0) {
      const rows = await queryAll<ScheduleMatchItem>({ pk: leagueKeys.meta(id).pk });
      const playable = rows.filter(
        (r) => r.entity === "SCHEDULEMATCH" && (r.sideA?.length ?? 0) > 0 && (r.sideB?.length ?? 0) > 0,
      );
      for (let i = 0; i < Math.min(confirmedGames, playable.length); i++) {
        const iso = daysAgoIso(i * 2 + 1);
        await putItem({
          ...playable[i],
          confirmStatus: "confirmed",
          scoreA: 11,
          scoreB: 8,
          reportedBy: "seed",
          confirmedBy: "seed",
          playedAt: iso,
          updatedAt: iso,
        } as unknown as Record<string, unknown>);
      }
    }
  }

  await seedLeague("dl-spring", "Lawrence Spring League", ["ava", "ben", "cy", "kai", "dee", "lux"], 5);
  await seedLeague("dl-jhawk", "Jayhawk Rec League", ["jo", "ivy", "hana", "gus"], 0);

  // ── Ladders (one active, one not) ──
  async function seedLadder(id: string, title: string, players: string[], confirmedChallenges: number) {
    if (await getLadder(id)) return;
    await createLadder({
      lid: id,
      organizerId: organizer,
      title,
      cityKey: CITY,
      startDate: FUTURE,
      price: money(1000, "usd"),
      challengeRange: 3,
      responseWindowDays: 7,
      playMode: "singles",
      feeMode: "absorb",
      currency: "usd",
      venueName: VENUE,
    });
    await publishLadder(id);
    for (const k of players) {
      const uid = uidOf(k);
      await registerForLadder(id, uid, {});
      await confirmLadderPayment({ lid: id, uid });
    }
    if (confirmedChallenges > 0) {
      const rungs = (await queryAll<RungItem>({ pk: ladderKeys.meta(id).pk }))
        .filter((r) => r.entity === "RUNG")
        .sort((a, b) => a.position - b.position);
      for (let i = 0; i < Math.min(confirmedChallenges, rungs.length - 1); i++) {
        const challenged = rungs[i]; // higher rung
        const challenger = rungs[i + 1]; // lower rung challenges up
        const cid = `${id}-ch-${i}`;
        const iso = daysAgoIso(i * 2 + 1);
        await putItem({
          ...ladderKeys.challenge(id, cid, challenged.uid, iso),
          entity: "CHALLENGE",
          lid: id,
          cid,
          challengerUid: challenger.uid,
          challengedUid: challenged.uid,
          challengerPos: challenger.position,
          challengedPos: challenged.position,
          status: "confirmed",
          dueDate: iso,
          scoreChallenger: 11,
          scoreChallenged: 7,
          reportedBy: challenger.uid,
          confirmedBy: challenged.uid,
          winnerUid: challenger.uid,
          createdAt: iso,
          updatedAt: iso,
        } as unknown as Record<string, unknown>);
      }
    }
  }

  await seedLadder("dld-open", "Lawrence Open Ladder", ["ben", "cy", "dee", "eli", "fin", "lux"], 3);
  await seedLadder("dld-rec", "Sunflower Rec Ladder", ["gus", "hana", "ivy", "jo"], 0);

  // ── Tournaments (no activity concept) ──
  async function seedTournament(id: string, title: string, players: string[]) {
    if (await getTournament(id)) return;
    await createTournament({
      tid: id,
      organizerId: organizer,
      title,
      cityKey: CITY,
      startDate: FUTURE,
      elim: "single",
      feeMode: "absorb",
      currency: "usd",
      venueName: VENUE,
    });
    await addDivision(id, { did: "d1", name: "Open Singles", price: money(1500, "usd"), capacity: 32, playMode: "singles" });
    await publishTournament(id);
    for (const k of players) {
      const uid = uidOf(k);
      await registerForDivision(id, "d1", uid, {});
      await confirmRegistrationPayment({ tid: id, did: "d1", uid });
    }
  }

  await seedTournament("dt-fall", "Lawrence Fall Open", ["ava", "ben", "cy", "kai", "dee", "eli", "fin", "lux"]);
  await seedTournament("dt-slam", "Sunflower Slam", ["gus", "hana", "ivy", "jo"]);

  console.log(
    "Seeded discover test data in Lawrence, KS:\n" +
      "  groups: dg-dinkers (10, active), dg-aces (4, high DUPR), dg-social (6, inactive)\n" +
      "  leagues: dl-spring (6, active), dl-jhawk (4, rec)\n" +
      "  ladders: dld-open (6, active), dld-rec (4)\n" +
      "  tournaments: dt-fall (8), dt-slam (4)",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
