/**
 * gamify-earn.ts — per-feature earn orchestrators (Gamification PRD §G4.2 call sites).
 *
 * Each function knows WHICH rules a confirmation point fires, their labels, and the
 * pre-flight reads (E3 "new court to me", E5/E6/E7 "once per review"). It filters out
 * already-earned once-ever rules so `awardXp` always receives a coherent all-new set
 * (a replay of the whole set is then a clean no-op), and returns the §G12.0 piggyback
 * block. Everything here is FAILURE-ISOLATED — it never throws, so the core write
 * (check-in / review) always commits even if gamification errors.
 */

import "server-only";
import { awardXpSafe, hasEarn, toGamifyBlock, type AwardXpResult, type EarnInput } from "./gamify";
import { creditPlayedWeek } from "./gamify-streak";
import { tickQuests } from "./gamify-quests";
import { tallyCourtCheckin, tallyCityRp, cityBoardMonth } from "./gamify-boards";
import { claimTrailblazer, claimFirstReviewer } from "./gamify-crew";
import { tickCommunityQuest } from "./gamify-community";
import { sourceKey } from "@/lib/gamify/source-keys";
import { resolveHoldout } from "@/lib/gamify/prefs";
import { SPECIAL_BADGE_BY_ID } from "@/lib/gamify/badges";
import type { QuestEvent } from "@/lib/gamify/quests";
import type { GamifyBlock } from "@/lib/gamify/block";

/**
 * The response block, SUPPRESSED for prefs-off / holdout viewers (§G12.0: zero UI) —
 * RP still accrued silently, so nothing is lost when they re-enable.
 */
function visibleBlock(res: AwardXpResult | null, uid: string): GamifyBlock | undefined {
  if (res && (!res.profile.prefs.enabled || resolveHoldout(uid))) return undefined;
  return toGamifyBlock(res);
}

/**
 * Credit a played week (the streak accrues even when the block is suppressed) and, when
 * it's the first play of the week and a block is shown, surface the tick (§G12.2-I2).
 */
async function withStreak(
  block: GamifyBlock | undefined,
  uid: string,
  now?: number,
): Promise<GamifyBlock | undefined> {
  const streak = await creditPlayedWeek(uid, now);
  if (block && streak?.firstOfWeek) {
    block.streak = { weeks: streak.weeks, firstOfWeek: true };
  }
  return block;
}

/** Tick this week's quests for the given actions and surface any that advanced (§G9). */
async function withQuests(
  block: GamifyBlock | undefined,
  uid: string,
  events: QuestEvent[],
  now?: number,
): Promise<GamifyBlock | undefined> {
  const updates = await tickQuests(uid, events, now);
  if (block && updates.length) {
    block.quests = updates.map((u) => ({
      questId: u.questId,
      title: u.title,
      count: u.count,
      target: u.target,
      rewardRp: u.rewardRp,
      completed: u.completed,
    }));
  }
  return block;
}

/** Words in a review body (for the E6 ≥100-word quality bonus). */
function wordCount(s?: string): number {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

/** Surface a one-off special badge (Trailblazer / First Reviewer) in the piggyback block. */
function pushSpecialBadge(block: GamifyBlock | undefined, familyId: string): void {
  if (!block) return;
  const def = SPECIAL_BADGE_BY_ID[familyId];
  if (!def) return;
  (block.badges ??= []).push({ familyId, tier: 0, name: def.name });
}

async function safe(fn: () => Promise<GamifyBlock | undefined>): Promise<GamifyBlock | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.error("[gamify] earn orchestration failed (isolated):", err);
    return undefined;
  }
}

/**
 * Award a check-in (E1 · E2 note/lookingToPlay · E3 first-visit). Only for authed,
 * NON-anonymous check-ins — anonymous check-ins earn nothing (G2.4).
 */
export function earnCheckin(input: {
  uid: string;
  courtId: string;
  courtName?: string;
  /** The court's city key — for the city board tally (§G13.6). */
  courtCityKey?: string;
  /** Court-local day (the E1/E2 idempotency window). */
  day: string;
  note?: string;
  lookingToPlay?: boolean;
  now?: number;
}): Promise<GamifyBlock | undefined> {
  return safe(async () => {
    const { uid, courtId, day } = input;
    const label = input.courtName ? `Check-in at ${input.courtName}` : "Court check-in";
    const earns: EarnInput[] = [
      { rule: "E1", source: { rule: "E1", courtId, day }, label, refType: "court", refId: courtId },
    ];
    if ((input.note?.trim().length ?? 0) >= 20 || input.lookingToPlay) {
      earns.push({
        rule: "E2",
        source: { rule: "E2", courtId, day },
        label: input.lookingToPlay ? "Looking to play" : "Left a note",
        refType: "court",
        refId: courtId,
      });
    }
    // E3 — first-ever check-in at this court by this user (pre-flight point read).
    if (!(await hasEarn(uid, sourceKey({ rule: "E3", courtId })))) {
      earns.push({
        rule: "E3",
        source: { rule: "E3", courtId },
        label: "First time at this court",
        refType: "court",
        refId: courtId,
      });
    }
    // E25 — the "first check-in" starter step (once ever, any court).
    if (!(await hasEarn(uid, sourceKey({ rule: "E25", step: "checkin" })))) {
      earns.push({ rule: "E25", source: { rule: "E25", step: "checkin" }, label: "First check-in", refType: "court", refId: courtId });
    }
    // E4 — Trailblazer: race-safe claim of the first-ever check-in at this court on the
    // platform. The winner earns E4 (in the same award txn) + the Trailblazer badge (written
    // inside claimTrailblazer). Isolated so a claim error can't sink the check-in's RP.
    let wonTrailblazer = false;
    try {
      wonTrailblazer = await claimTrailblazer(courtId, uid, input.now);
    } catch (err) {
      console.error("[gamify] trailblazer claim failed (isolated):", err);
    }
    if (wonTrailblazer) {
      earns.push({ rule: "E4", source: { rule: "E4", courtId }, label: "Trailblazer — first ever here", refType: "court", refId: courtId });
    }
    const res = await awardXpSafe({ uid, earns, now: input.now });
    const block = visibleBlock(res, uid);
    if (wonTrailblazer) pushSpecialBadge(block, "trailblazer");
    await withStreak(block, uid, input.now); // a check-in credits the weekly Play Streak (§G8)

    // Leaderboard tallies (§G13.6): the court board counts check-in DAYS; the city board
    // counts RP (a check-in's RP attributes to the COURT's city). Court-local month for both
    // (a check-in's court month ≈ its city month — same location).
    if (res?.awarded) {
      // Court board buckets on the COURT's local month; city board + community quest bucket on
      // the shared city-month basis so writes land where the city pages read (§G13.6/§G9.3).
      await tallyCourtCheckin(courtId, day.slice(0, 6), uid);
      if (input.courtCityKey) {
        const cityMonth = cityBoardMonth(input.now);
        await tallyCityRp(input.courtCityKey, cityMonth, uid, res.total);
        // A check-in advances the city's community quest, if one is live (§G9.3).
        await tickCommunityQuest(input.courtCityKey, uid, { rule: "E1" }, input.now);
      }
    }

    const questEvents: QuestEvent[] = [{ rule: "E1", courtId }];
    if (input.lookingToPlay) questEvents.push({ rule: "E2", lookingToPlay: true });
    return withQuests(block, uid, questEvents, input.now);
  });
}

/** Award the welcome bonus (E24) — once ever, at profile creation (endowed progress, G2.2). */
export function earnSignup(uid: string): Promise<GamifyBlock | undefined> {
  return safe(async () =>
    visibleBlock(
      await awardXpSafe({
        uid,
        earns: [{ rule: "E24", source: { rule: "E24" }, label: "Welcome to the courts" }],
      }),
      uid,
    ),
  );
}

/** Award a completed starter-quest step (E25) — profile / first check-in / follow (G9.2). */
export function earnStarterStep(
  uid: string,
  step: "profile" | "checkin" | "follow",
): Promise<GamifyBlock | undefined> {
  const label = { profile: "Completed your profile", checkin: "First check-in", follow: "Followed a court" }[step];
  return safe(async () =>
    visibleBlock(await awardXpSafe({ uid, earns: [{ rule: "E25", source: { rule: "E25", step }, label }] }), uid),
  );
}

/** Award a confirmed tournament registration (E10) 💲 — one earner, per division. */
export function earnTournamentRegistration(uid: string, tid: string, did: string): Promise<GamifyBlock | undefined> {
  return safe(async () =>
    visibleBlock(
      await awardXpSafe({
        uid,
        earns: [{ rule: "E10", source: { rule: "E10", tid, did }, label: "Tournament registration", refType: "tournament", refId: tid }],
      }),
      uid,
    ),
  );
}

/** Award a confirmed league registration (E13) 💲 — one earner, per season. */
export function earnLeagueRegistration(uid: string, lid: string): Promise<GamifyBlock | undefined> {
  return safe(async () =>
    visibleBlock(
      await awardXpSafe({
        uid,
        earns: [{ rule: "E13", source: { rule: "E13", lid }, label: "League registration", refType: "league", refId: lid }],
      }),
      uid,
    ),
  );
}

/** Award a confirmed league fixture (E14) — call once per participant; both players earn. */
export function earnLeagueMatch(uid: string, lid: string, mid: string): Promise<GamifyBlock | undefined> {
  return safe(async () => {
    const block = await withStreak(
      visibleBlock(
        await awardXpSafe({
          uid,
          earns: [{ rule: "E14", source: { rule: "E14", lid, mid }, label: "League match confirmed", refType: "league", refId: lid }],
        }),
        uid,
      ),
      uid,
    );
    return withQuests(block, uid, [{ rule: "E14" }]);
  });
}

/** Award a completed ladder challenge (E16) — call once per participant; both earn (win or lose). */
export function earnLadderMatch(uid: string, lid: string, cid: string): Promise<GamifyBlock | undefined> {
  return safe(async () => {
    const block = await withStreak(
      visibleBlock(
        await awardXpSafe({
          uid,
          earns: [{ rule: "E16", source: { rule: "E16", lid, cid }, label: "Ladder challenge completed", refType: "ladder", refId: lid }],
        }),
        uid,
      ),
      uid,
    );
    return withQuests(block, uid, [{ rule: "E16" }]);
  });
}

/** Award attending an outing that occurred (E19) — one per "going" attendee. */
export function earnOutingAttendance(uid: string, outingId: string): Promise<GamifyBlock | undefined> {
  return safe(async () =>
    withStreak(
      visibleBlock(
        await awardXpSafe({ uid, earns: [{ rule: "E19", source: { rule: "E19", outingId }, label: "Played a game", refType: "outing", refId: outingId }] }),
        uid,
      ),
      uid,
    ),
  );
}

/** Award hosting an outing/meet-up where ≥4 were going (E20, or E23 for a group meet-up). */
export function earnOutingHost(uid: string, outingId: string, hostType?: "GROUP"): Promise<GamifyBlock | undefined> {
  const rule = hostType === "GROUP" ? ("E23" as const) : ("E20" as const);
  return safe(async () => {
    const block = visibleBlock(
      await awardXpSafe({ uid, earns: [{ rule, source: { rule, outingId }, label: "Hosted a game", refType: "outing", refId: outingId }] }),
      uid,
    );
    return withQuests(block, uid, [{ rule }]);
  });
}

/**
 * Award a completed outing (§G13.3 completion sweep): E19 to every attendee who was
 * "going", plus E20/E23 to the host when ≥ 4 players were going. Idempotent via the
 * per-outing sourceKeys, so re-running the sweep never double-pays. The SCHEDULED driver
 * that discovers outings past `endTs ?? startTs+2h` (and not cancelled) and calls this is
 * an ops hook (a Lambda cron), left to wire alongside the reconcile sweep.
 */
export async function awardOutingCompletion(input: {
  outingId: string;
  goingUids: string[];
  hostUid?: string;
  hostType?: "GROUP";
  goingCount: number;
}): Promise<void> {
  try {
    await Promise.all(input.goingUids.map((u) => earnOutingAttendance(u, input.outingId)));
    if (input.hostUid && input.goingCount >= 4) {
      await earnOutingHost(input.hostUid, input.outingId, input.hostType);
    }
  } catch (err) {
    console.error("[gamify] outing completion award failed (isolated):", err);
  }
}

/**
 * Award a published review (E5 first-publish · E6 quality body+photo · E7 verified).
 * Once-per-review rules are filtered by their existing ledger rows, so an EDIT that
 * newly qualifies for E6 pays E6 without re-paying E5.
 */
export function earnReview(input: {
  uid: string;
  courtId: string;
  courtName?: string;
  body?: string;
  hasPhoto: boolean;
  checkinVerified: boolean;
  now?: number;
}): Promise<GamifyBlock | undefined> {
  return safe(async () => {
    const { uid, courtId } = input;
    const label = input.courtName ? `Review of ${input.courtName}` : "Court review";
    const candidates: EarnInput[] = [
      { rule: "E5", source: { rule: "E5", courtId }, label, refType: "court", refId: courtId },
    ];
    if (wordCount(input.body) >= 100 && input.hasPhoto) {
      candidates.push({
        rule: "E6",
        source: { rule: "E6", courtId },
        label: "Detailed review bonus",
        refType: "court",
        refId: courtId,
      });
    }
    if (input.checkinVerified) {
      candidates.push({
        rule: "E7",
        source: { rule: "E7", courtId },
        label: "Verified via check-in",
        refType: "court",
        refId: courtId,
      });
    }
    // Filter out already-earned rows so awardXp gets an all-new set.
    const flags = await Promise.all(candidates.map((e) => hasEarn(uid, sourceKey(e.source))));
    const earns = candidates.filter((_, i) => !flags[i]);
    // First Reviewer — race-safe claim of the first-ever review of this court (badge only,
    // no RP; the E5 first-publish RP is separate). Only a genuinely new publish can win.
    let wonFirstReviewer = false;
    if (!flags[0]) {
      try {
        wonFirstReviewer = await claimFirstReviewer(courtId, uid, input.now);
      } catch (err) {
        console.error("[gamify] first-reviewer claim failed (isolated):", err);
      }
    }
    // Even when RP is fully deduped, a publish still ticks the review quest.
    const block = visibleBlock(earns.length ? await awardXpSafe({ uid, earns, now: input.now }) : null, uid);
    if (wonFirstReviewer) pushSpecialBadge(block, "first-reviewer");
    return withQuests(block, uid, [{ rule: "E5", courtId }], input.now);
  });
}
