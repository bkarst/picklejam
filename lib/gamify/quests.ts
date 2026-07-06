/**
 * quests.ts — weekly personal quests (Gamification PRD §G9.1), as typed config.
 *
 * Quest ids are WEEK-STAMPED (`wq#<isoWeek>#<slug>`) so a user's progress rows are
 * naturally week-scoped and "current week" is an id-prefix match (pattern 35).
 * Selection is DETERMINISTIC — seeded by `hash(uid, isoWeek)` through the RR engine's
 * mulberry32 PRNG (no `Math.random`; §14 determinism): slot 1 = the user's dominant
 * family (last 4 weeks), slot 2 = their least-used family (cross-pollination), slot 3 =
 * the general pool. New accounts fall back to the all-solo trio.
 *
 * Pure, no I/O. Progress ticking (`questPredicateMatches`) is driven off the award
 * pipeline plus two non-ledger ticks — RSVP-going and court-follow.
 */

import { makeRng, randInt } from "@/lib/roundrobin/rng";
import { hashString } from "@/lib/roundrobin/engine/shared";
import type { EarnRule } from "./earn-rules";

/** The family used by selection's dominant / least-used slot logic. */
export type QuestFamily = "B1" | "B2" | "B3" | "B4";

/** Non-ledger tick ids — actions that advance quests but pay no immediate RP (G9.1). */
export type QuestTick = "rsvp-going" | "court-follow";

/** Eligibility guard some quests need (G9.1). */
export type QuestRequirement = "unreviewed-court" | "active-registration" | "prior-hosting";

export interface QuestDef {
  slug: string;
  title: string;
  family: QuestFamily;
  /** Ledger rules and/or non-ledger ticks that advance this quest. */
  counts: (EarnRule | QuestTick)[];
  target: number;
  rewardRp: number;
  /** Count distinct values of this dimension instead of raw events (e.g. distinct courts). */
  distinctBy?: "courtId";
  /** For `lookingtoplay`: only E2 with the lookingToPlay flag counts. */
  flag?: "lookingToPlay";
  /** Gate: the quest is only offered when this precondition holds. */
  requires?: QuestRequirement;
}

/** The weekly pool (G9.1 launch catalog). RP values must match E26 in the earn table. */
export const WEEKLY_QUESTS: readonly QuestDef[] = [
  { slug: "checkin3", title: "Check in 3 times this week", family: "B1", counts: ["E1"], target: 3, rewardRp: 30 },
  { slug: "twocourts", title: "Play at 2 different courts", family: "B1", counts: ["E1"], target: 2, rewardRp: 40, distinctBy: "courtId" },
  { slug: "lookingtoplay", title: 'Check in "looking to play"', family: "B1", counts: ["E2"], target: 1, rewardRp: 15, flag: "lookingToPlay" },
  { slug: "review1", title: "Review a court you've played", family: "B2", counts: ["E5"], target: 1, rewardRp: 50, requires: "unreviewed-court" },
  { slug: "photo1", title: "Add a court photo", family: "B2", counts: ["E9"], target: 1, rewardRp: 25 },
  { slug: "helpful1", title: "Have a review marked helpful", family: "B2", counts: ["E8"], target: 1, rewardRp: 20 },
  { slug: "rsvp1", title: "RSVP to a game", family: "B4", counts: ["rsvp-going"], target: 1, rewardRp: 30 },
  { slug: "follow1", title: "Follow a court", family: "B1", counts: ["court-follow"], target: 1, rewardRp: 15 },
  { slug: "match1", title: "Play a competitive match", family: "B3", counts: ["E11", "E14", "E16"], target: 1, rewardRp: 75, requires: "active-registration" },
  { slug: "host1", title: "Host a game 4+ show up to", family: "B4", counts: ["E20", "E23"], target: 1, rewardRp: 75, requires: "prior-hosting" },
];

export const QUEST_BY_SLUG: Record<string, QuestDef> = Object.fromEntries(
  WEEKLY_QUESTS.map((q) => [q.slug, q]),
);

/** New-account fallback (no 4-week history): all B1, all achievable solo (G9.1). */
export const FALLBACK_TRIO = ["checkin3", "twocourts", "lookingtoplay"] as const;

export const QUEST_ID_PREFIX = "wq";
export const COMMUNITY_QUEST_PREFIX = "cq";

/** The week-stamped quest id, e.g. `wq#2026-W28#checkin3`. */
export function weeklyQuestId(isoWeek: string, slug: string): string {
  return `${QUEST_ID_PREFIX}#${isoWeek}#${slug}`;
}

/**
 * The deterministic community-quest id — one per city per calendar month (§G9.3), e.g.
 * `cq#us#kansas#wichita#202606`. Deterministic so a city's live quest is a single GetItem
 * (`questKeys.meta`), no GSI. The number of `#`-parts varies (cityKey has its own), so parse
 * from the ends: last part = `yyyymm`, first = the prefix, middle = the cityKey.
 */
export function communityQuestId(cityKey: string, yyyymm: string): string {
  return `${COMMUNITY_QUEST_PREFIX}#${cityKey}#${yyyymm}`;
}

/** Parse a community-quest id back to `{ cityKey, month }` (`null` if not one). */
export function parseCommunityQuestId(id: string): { cityKey: string; month: string } | null {
  const parts = id.split("#");
  if (parts[0] !== COMMUNITY_QUEST_PREFIX || parts.length < 3) return null;
  return { cityKey: parts.slice(1, -1).join("#"), month: parts[parts.length - 1] };
}

/** Parse a week-stamped quest id back to its parts (`null` if not a weekly id). */
export function parseWeeklyQuestId(id: string): { isoWeek: string; slug: string } | null {
  const parts = id.split("#");
  if (parts[0] !== QUEST_ID_PREFIX || parts.length < 3) return null;
  return { isoWeek: parts[1], slug: parts.slice(2).join("#") };
}

/** An action that may advance a quest — a ledger earn or a non-ledger tick. */
export interface QuestEvent {
  rule?: EarnRule;
  tick?: QuestTick;
  courtId?: string;
  lookingToPlay?: boolean;
}

/** Whether an action advances a given quest (the predicate the tick pipeline uses). */
export function questPredicateMatches(quest: QuestDef, event: QuestEvent): boolean {
  const key = event.rule ?? event.tick;
  if (!key || !quest.counts.includes(key as EarnRule | QuestTick)) return false;
  if (quest.flag === "lookingToPlay" && !event.lookingToPlay) return false;
  return true;
}

/** Inputs the deterministic selection needs (all derivable server-side). */
export interface QuestSelectionContext {
  /** RP or action counts by family over the last 4 weeks (empty ⇒ no history). */
  familyUsage?: Partial<Record<QuestFamily, number>>;
  /** Which guarded quests are currently eligible. */
  eligibility?: { unreviewedCourt?: boolean; activeRegistration?: boolean; priorHosting?: boolean };
}

function isEligible(q: QuestDef, elig: QuestSelectionContext["eligibility"]): boolean {
  switch (q.requires) {
    case "unreviewed-court":
      return !!elig?.unreviewedCourt;
    case "active-registration":
      return !!elig?.activeRegistration;
    case "prior-hosting":
      return !!elig?.priorHosting;
    default:
      return true;
  }
}

/** Deterministically remove and return one element from `pool` using `rng`. */
function draw(pool: QuestDef[], rng: () => number): QuestDef | undefined {
  if (pool.length === 0) return undefined;
  const [picked] = pool.splice(randInt(rng, pool.length), 1);
  return picked;
}

/**
 * The three weekly quests for `(uid, isoWeek)` — deterministic (same inputs ⇒ same
 * trio). Slot 1 favors the dominant family, slot 2 the least-used, slot 3 the general
 * pool; shortfalls fill from the remaining eligible pool. With no history, the fallback
 * trio is returned unchanged.
 */
export function selectWeeklyQuests(
  uid: string,
  isoWeek: string,
  ctx: QuestSelectionContext = {},
): string[] {
  const usage = ctx.familyUsage ?? {};
  const hasHistory = Object.values(usage).some((v) => (v ?? 0) > 0);
  if (!hasHistory) return [...FALLBACK_TRIO];

  const rng = makeRng(hashString(`${uid}#${isoWeek}`) >>> 0);
  const eligible = WEEKLY_QUESTS.filter((q) => isEligible(q, ctx.eligibility));

  const families: QuestFamily[] = ["B1", "B2", "B3", "B4"];
  const usageOf = (f: QuestFamily): number => usage[f] ?? 0;
  const dominant = [...families].sort((a, b) => usageOf(b) - usageOf(a))[0];
  const leastUsed = [...families].sort((a, b) => usageOf(a) - usageOf(b))[0];

  const pool = [...eligible];
  const chosen: QuestDef[] = [];
  const pickFromFamily = (fam: QuestFamily): void => {
    const subset = pool.filter((q) => q.family === fam);
    const pick = draw(subset, rng);
    if (pick) {
      chosen.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
  };

  pickFromFamily(dominant);
  if (leastUsed !== dominant) pickFromFamily(leastUsed);
  // Fill remaining slots from the general pool.
  while (chosen.length < 3) {
    const pick = draw(pool, rng);
    if (!pick) break;
    chosen.push(pick);
  }

  return chosen.slice(0, 3).map((q) => q.slug);
}
