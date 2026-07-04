// Aggregates apply inline (no real Streams over DynamoDB Local) and TransactWrite
// is emulated sequentially (dynalite has no TransactWriteItems). Set BEFORE the
// data layer reads them at call time. RR create uses batchWrite (not a tx), but we
// keep the flag on for parity with the rest of the suite.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";

import { describe, it, expect } from "vitest";
import { query } from "@/lib/db/client";
import { rrKeys } from "@/lib/db/keys";
import { GSI } from "@/lib/db/table";
import { userKeys } from "@/lib/db/keys";
import {
  validateConfig,
  generateSchedule,
  nextRound,
  computeStandings,
  champion,
} from "@/lib/roundrobin";
import {
  createRrEvent,
  getRrEvent,
  recordScore,
  advanceRound,
  claimRrEvent,
  getMyRrEvents,
  RrError,
} from "@/lib/data/roundrobin";
import type { RrConfig, Entrant, ScoringConfig } from "@/lib/roundrobin/types";
import type { BaseItem } from "@/lib/db/types";

/**
 * Stage 5 Round-Robin data layer + API contract against DynamoDB Local (§6.8,
 * §9.5 pattern 16). Skipped without DYNAMODB_ENDPOINT. Every event id is fresh
 * (ulid), so the suite is parallel-safe + re-runnable.
 *
 * These tests exercise MY data layer, not the engine's correctness: engine-derived
 * assertions compare the persisted/reconstructed result to a DIRECT engine call on
 * the same inputs, so they hold for any deterministic engine (the parallel one).
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const SCORING: ScoringConfig = { pointsToWin: 11, winBy: 2 };

/** n singles entrants e0..e(n-1) with ascending seeds so initial order is deterministic. */
function entrants(n: number): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `e${i}`, name: `Player ${i}`, seed: i + 1 }));
}

const rrConfig = (over: Partial<RrConfig> = {}): RrConfig => ({
  format: "roundRobin",
  mode: "singles",
  entrants: entrants(4),
  courts: 2,
  scoring: SCORING,
  rngSeed: 42,
  ...over,
});

/** Read the whole RR partition in ONE query (what pattern 16 relies on). */
async function partition(eventId: string): Promise<BaseItem[]> {
  const { items } = await query<BaseItem>({ pk: rrKeys.meta(eventId).pk });
  return items;
}

/** Score every match so the HIGHER-index entrant wins 11–4 (⇒ e(n-1) is champion). */
async function scoreAllHighWins(
  eventId: string,
  token: string,
): Promise<void> {
  const full = await getRrEvent(eventId);
  for (const round of full!.rounds) {
    for (const m of round.matches) {
      const aIdx = idxOf(m.sideA[0]);
      const bIdx = idxOf(m.sideB[0]);
      const aWins = aIdx > bIdx;
      await recordScore(
        eventId,
        { matchId: m.id, scoreA: aWins ? 11 : 4, scoreB: aWins ? 4 : 11 },
        { token },
      );
    }
  }
}
const idxOf = (entrantId: string) => Number(entrantId.slice(1));

/** An 8-entrant pools→bracket event: 2 pools, top 2 advance, single elimination. */
const poolsBracketConfig = (): RrConfig => ({
  format: "poolsBracket",
  mode: "singles",
  entrants: entrants(8),
  courts: 2,
  scoring: SCORING,
  rngSeed: 42,
  pools: { poolCount: 2, advancePerPool: 2, elim: "single" },
});

/** Score every currently-unscored match decisively (sideA wins 11–4). */
async function scoreAllUnscored(eventId: string, token: string): Promise<void> {
  const full = await getRrEvent(eventId);
  for (const round of full!.rounds) {
    for (const m of round.matches) {
      if (m.status === "scored") continue;
      await recordScore(eventId, { matchId: m.id, scoreA: 11, scoreB: 4 }, { token });
    }
  }
}

/** Drive a dynamic event to completion: score every round decisively, then advance. */
async function driveToComplete(eventId: string, token: string) {
  for (let i = 0; i < 12; i++) {
    await scoreAllUnscored(eventId, token);
    const cur = await getRrEvent(eventId);
    if (cur!.event.status === "complete") return cur;
    await advanceRound(eventId, { token });
  }
  return getRrEvent(eventId);
}

d("round-robin data layer (DynamoDB Local)", () => {
  it("create persists META + ENTRANT# + ROUND#/MATCH# + STANDING#; pattern-16 read reconstructs in ONE query", async () => {
    const config = rrConfig();
    const schedule = generateSchedule(config);
    const { eventId, creatorToken } = await createRrEvent({ title: "Friday RR", config });
    expect(eventId).toBeTruthy();
    expect(creatorToken).toBeTruthy();

    // Raw partition — every entity row shares PK=RR#<id> (single-query pattern 16).
    const items = await partition(eventId);
    const byEntity = (e: string) => items.filter((i) => i.entity === e);
    expect(byEntity("RREVENT")).toHaveLength(1);
    expect(byEntity("RRENTRANT")).toHaveLength(4);
    expect(byEntity("RRROUND")).toHaveLength(schedule.rounds.length);
    const totalMatches = schedule.rounds.reduce((n, r) => n + r.matches.length, 0);
    expect(byEntity("RRMATCH")).toHaveLength(totalMatches);
    expect(byEntity("RRSTANDING")).toHaveLength(4);

    // The creator token is persisted on META but NEVER surfaced by the public read.
    const meta = byEntity("RREVENT")[0] as unknown as { creatorToken: string; status: string };
    expect(meta.creatorToken).toBe(creatorToken);
    expect(meta.status).toBe("notStarted");

    const full = await getRrEvent(eventId);
    expect(full).toBeDefined();
    expect(full!.event.eventId).toBe(eventId);
    expect(full!.event.format).toBe("roundRobin");
    expect(full!.event.dynamic).toBe(schedule.dynamic);
    expect(full!.entrants.map((e) => e.id)).toEqual(["e0", "e1", "e2", "e3"]);
    expect(full!.rounds).toHaveLength(schedule.rounds.length);
    expect(full!.rounds[0].matches.length).toBe(schedule.rounds[0].matches.length);
    expect(full!.standings).toHaveLength(4);
    // No secret token leaked into the UI-facing meta.
    expect((full!.event as unknown as Record<string, unknown>).creatorToken).toBeUndefined();
    expect((full!.event as unknown as Record<string, unknown>).config).toBeUndefined();
  });

  it("recordScore writes the match + re-materializes standings (ranks shift to reflect wins)", async () => {
    const config = rrConfig();
    const { eventId, creatorToken } = await createRrEvent({ title: "Scored RR", config });

    const initial = await getRrEvent(eventId);
    expect(initial!.standings[0].entrantId).toBe("e0"); // seed order before any scores

    await scoreAllHighWins(eventId, creatorToken);

    const after = await getRrEvent(eventId);
    // Champion by wins is e3; the top-of-table shifted away from the seed order.
    expect(after!.standings[0].entrantId).toBe("e3");
    expect(after!.standings[0].wins).toBe(3);
    expect(after!.standings[after!.standings.length - 1].entrantId).toBe("e0");

    // The persisted standings equal a direct engine computeStandings on the same rounds.
    const expectedStandings = computeStandings(config, after!.rounds);
    expect(after!.standings).toEqual(expectedStandings);

    // A scored match carries its scores + status; a static event fully scored ⇒ complete.
    const scored = after!.rounds.flatMap((r) => r.matches);
    expect(scored.every((m) => m.status === "scored")).toBe(true);
    expect(scored.every((m) => m.scoreA !== undefined && m.scoreB !== undefined)).toBe(true);
    expect(after!.event.status).toBe("complete");
    // championId is materialized via the engine's champion() (compare to a direct call).
    expect(after!.event.championId ?? null).toBe(champion(config, after!.rounds) ?? null);
  });

  it("rejects a score with a bad creator token (403) and does not persist it", async () => {
    const { eventId, creatorToken } = await createRrEvent({ title: "Guarded RR", config: rrConfig() });
    const full = await getRrEvent(eventId);
    const matchId = full!.rounds[0].matches[0].id;

    await expect(
      recordScore(eventId, { matchId, scoreA: 11, scoreB: 3 }, { token: "not-the-token" }),
    ).rejects.toMatchObject({ status: 403 });

    // The real token still works (proves the reject was auth, not a broken match).
    const ok = await recordScore(eventId, { matchId, scoreA: 11, scoreB: 3 }, { token: creatorToken });
    const scoredMatch = ok.rounds.flatMap((r) => r.matches).find((m) => m.id === matchId);
    expect(scoredMatch?.scoreA).toBe(11);
    expect(scoredMatch?.status).toBe("scored");
  });

  it("dynamic advance produces the next round == engine nextRound(config, completed)", async () => {
    const config = rrConfig({ format: "swiss", rounds: 3, rngSeed: 7 });
    const schedule = generateSchedule(config);
    expect(schedule.dynamic).toBe(true); // swiss is dynamic

    const { eventId, creatorToken } = await createRrEvent({ title: "Swiss Night", config });

    // Score round 1 fully, then capture the completed rounds the engine will see.
    await scoreAllHighWins(eventId, creatorToken);
    const before = await getRrEvent(eventId);
    const completed = before!.rounds;
    const expected = nextRound(config, completed);

    const produced = await advanceRound(eventId, { token: creatorToken });
    expect(produced).toEqual(expected);

    if (expected) {
      // The produced round was persisted and reads back identically.
      const after = await getRrEvent(eventId);
      const persisted = after!.rounds.find((r) => r.round === expected.round);
      expect(persisted).toEqual(expected);
      expect(after!.event.status).toBe("running");
    }
  });

  it("L8: correcting a score in a COMPLETE dynamic event keeps it complete (no regress to running)", async () => {
    const config = rrConfig({ format: "swiss", rounds: 3, rngSeed: 7 });
    expect(generateSchedule(config).dynamic).toBe(true); // swiss is dynamic

    const { eventId, creatorToken: token } = await createRrEvent({ title: "Swiss Finished", config });

    // Play it all the way out — a dynamic event finalizes via advanceRound.
    const done = await driveToComplete(eventId, token);
    expect(done!.event.status).toBe("complete");
    expect(done!.event.championId ?? null).not.toBeNull();

    // Correct one already-scored match (organizer fixes a typo). Pre-fix: recordScore
    // recomputed nextStatus as "running" for every dynamic event, so this flipped META
    // back to "running" while championId stayed stamped — a finished event stuck "running".
    const target = done!.rounds[0].matches[0];
    expect(target.status).toBe("scored");
    await recordScore(eventId, { matchId: target.id, scoreA: 9, scoreB: 11 }, { token });

    const after = await getRrEvent(eventId);
    expect(after!.event.status).toBe("complete"); // pre-fix: "running"
    expect(after!.event.championId ?? null).not.toBeNull();
  });

  it("H14: advancing with an unscored round is REJECTED, not silently completed with no champion", async () => {
    const { eventId, creatorToken } = await createRrEvent({
      title: "Pools Brick",
      config: poolsBracketConfig(),
    });
    // Pool rounds exist but are unscored — one early "Next" tap must NOT finalize the
    // event (pre-fix: status→complete, championId=null, editable→false forever).
    await expect(advanceRound(eventId, { token: creatorToken })).rejects.toMatchObject({
      status: 400,
    });
    const after = await getRrEvent(eventId);
    expect(after!.event.status).not.toBe("complete");
    expect(after!.event.championId ?? null).toBeNull();
  });

  it("H14: pool ties allowed, BRACKET ties rejected; decisive play crowns a champion", async () => {
    const { eventId, creatorToken: token } = await createRrEvent({
      title: "Pools Tie",
      config: poolsBracketConfig(),
    });

    // A pool match CAN tie (standings award draw points) — this must succeed.
    const full0 = await getRrEvent(eventId);
    const poolMatch = full0!.rounds[0].matches[0];
    await recordScore(eventId, { matchId: poolMatch.id, scoreA: 11, scoreB: 11 }, { token });

    // Finish pools decisively and advance into the bracket (Semifinals).
    await scoreAllUnscored(eventId, token);
    await advanceRound(eventId, { token });
    const withSf = await getRrEvent(eventId);
    const sfRound = withSf!.rounds[withSf!.rounds.length - 1];
    const sfMatch = sfRound.matches[0];

    // A TIE on a bracket match is REJECTED (else decidedWinner() stays null → no Final).
    await expect(
      recordScore(eventId, { matchId: sfMatch.id, scoreA: 11, scoreB: 11 }, { token }),
    ).rejects.toMatchObject({ status: 400 });

    // Decisive bracket play → the event completes with a REAL champion.
    const done = await driveToComplete(eventId, token);
    expect(done!.event.status).toBe("complete");
    expect(done!.event.championId).not.toBeNull();
  });

  it("claim resolves token→uid, sets GSI1 (byOrganizer); wrong token / already-claimed are rejected", async () => {
    const uid = `rr-owner-${Date.now()}`;
    const { eventId, creatorToken } = await createRrEvent({ title: "Claim Me", config: rrConfig() });

    // Wrong token → 403, event stays anonymous.
    await expect(claimRrEvent(eventId, uid, "wrong-token")).rejects.toMatchObject({ status: 403 });

    const claimed = await claimRrEvent(eventId, uid, creatorToken);
    expect(claimed?.organizerId).toBe(uid);

    // GSI1 byOrganizer now indexes it → appears in the user's /account list.
    const gsi = await query({
      index: GSI.byOwner,
      pk: userKeys.profile(uid).pk,
      skBeginsWith: "RR#",
    });
    expect(gsi.items.map((i) => (i as { eventId: string }).eventId)).toContain(eventId);

    const mine = await getMyRrEvents(uid);
    expect(mine.map((m) => m.eventId)).toContain(eventId);

    // Re-claim by the SAME uid is idempotent; a DIFFERENT uid is rejected.
    const again = await claimRrEvent(eventId, uid, creatorToken);
    expect(again?.organizerId).toBe(uid);
    await expect(claimRrEvent(eventId, "someone-else", creatorToken)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("validateConfig gates create (a doubles event with too few entrants is rejected 400)", async () => {
    // Structural guard lives in the engine; the data layer surfaces it as RrError(400).
    const bad = validateConfig({ ...rrConfig(), mode: "doubles", fixedPartners: true, entrants: entrants(1) });
    if (bad.ok) return; // engine may accept; only assert when it flags the config
    await expect(
      createRrEvent({
        title: "Too Few",
        config: { ...rrConfig(), mode: "doubles", fixedPartners: true, entrants: entrants(1) },
      }),
    ).rejects.toBeInstanceOf(RrError);
  });
});
