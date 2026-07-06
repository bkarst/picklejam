/**
 * gamify-crew.ts — Court Crew, Captain & Trailblazer (Gamification PRD §G7).
 *
 * The mayor-mechanic redesigned to avoid single-winner demotivation: Crew is threshold
 * status (≥4 check-in days across the current+previous month — anyone can be Crew),
 * Captain is a rotating monthly spotlight (most check-in days in the calendar month, min
 * 6), and Trailblazer/First-Reviewer are race-safe first-forever credits (a conditional
 * court-meta set). All derive from the CRTLB tallies (§G13.6) — no fan-out writes.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { batchGet, getItem, queryAll, updateItem } from "@/lib/db/client";
import { boardKeys, courtKeys, userKeys, gamifyKeys } from "@/lib/db/keys";
import { prevMonth } from "./gamify-boards";
import { awardSpecialBadge } from "./gamify-badges";
import type { CourtItem, LbTallyItem, LbBoardMetaItem, UserProfileItem, GamifyProfileItem } from "@/lib/db/types";

const CREW_THRESHOLD = 4;
const CAPTAIN_MIN = 6;

/** Claim the first-ever check-in at a court (Trailblazer). Returns true iff this is the first. */
export async function claimTrailblazer(courtId: string, uid: string, now: number = Date.now()): Promise<boolean> {
  try {
    await updateItem({
      key: courtKeys.meta(courtId),
      update: "SET trailblazerUid = :uid, trailblazerAt = :now",
      condition: "attribute_not_exists(trailblazerUid)",
      values: { ":uid": uid, ":now": new Date(now).toISOString() },
    });
    await awardSpecialBadge(uid, "trailblazer", now);
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false; // someone got here first
    throw err;
  }
}

/** Claim the first-ever review of a court (First Reviewer). Returns true iff first. */
export async function claimFirstReviewer(courtId: string, uid: string, now: number = Date.now()): Promise<boolean> {
  try {
    await updateItem({
      key: courtKeys.meta(courtId),
      update: "SET firstReviewerUid = :uid",
      condition: "attribute_not_exists(firstReviewerUid)",
      values: { ":uid": uid },
    });
    await awardSpecialBadge(uid, "first-reviewer", now);
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

/** Sum a court's check-in-day tallies across the current + previous month → uid → days. */
async function checkinDaysByUser(courtId: string, curMonth: string): Promise<Map<string, number>> {
  const [cur, prev] = await Promise.all([
    queryAll<LbTallyItem>({ pk: boardKeys.courtBoardPk(courtId, curMonth), skBeginsWith: boardKeys.tallyPrefix() }),
    queryAll<LbTallyItem>({ pk: boardKeys.courtBoardPk(courtId, prevMonth(curMonth)), skBeginsWith: boardKeys.tallyPrefix() }),
  ]);
  const days = new Map<string, number>();
  for (const t of [...cur, ...prev]) days.set(t.uid, (days.get(t.uid) ?? 0) + t.value);
  return days;
}

/** The full set of Crew uids at a court (≥4 check-in days across the window) — for the
 *  review-card `Crew` marker (§G12.16), which needs membership for ANY author, not just the
 *  hydrated top-N chips. No profile join, no cap. */
export async function getCrewUids(courtId: string, curMonth: string): Promise<Set<string>> {
  const days = await checkinDaysByUser(courtId, curMonth);
  return new Set([...days.entries()].filter(([, d]) => d >= CREW_THRESHOLD).map(([u]) => u));
}

export interface CrewMember {
  uid: string;
  days: number;
  displayName: string;
  username: string;
  avatarUrl?: string;
  level: number;
}

/** The Court Crew — public, checkin-visible members with ≥4 check-in days in the window (§G7.1). */
export async function getCourtCrew(courtId: string, curMonth: string, limit = 12): Promise<CrewMember[]> {
  const days = await checkinDaysByUser(courtId, curMonth);
  const crewUids = [...days.entries()].filter(([, d]) => d >= CREW_THRESHOLD).map(([u]) => u);
  if (crewUids.length === 0) return [];

  const [users, gamifies] = await Promise.all([
    batchGet<UserProfileItem>(crewUids.map((u) => userKeys.profile(u))),
    batchGet<GamifyProfileItem>(crewUids.map((u) => gamifyKeys.profile(u))),
  ]);
  const userBy = new Map(users.map((u) => [u.uid, u]));
  const gamifyBy = new Map(gamifies.map((g) => [g.uid, g]));

  return crewUids
    .map((uid) => ({ uid, u: userBy.get(uid), g: gamifyBy.get(uid), days: days.get(uid) ?? 0 }))
    .filter(({ u }) => u && u.visibility === "public" && u.checkinVisibility !== "private")
    .map(({ uid, u, g, days: d }) => ({ uid, days: d, displayName: u!.displayName, username: u!.username, avatarUrl: u!.avatarUrl, level: g?.level ?? 1 }))
    .sort((a, b) => b.days - a.days)
    .slice(0, limit);
}

/** The viewer's crew status at a court: this-month check-in days + whether they're Crew. */
export async function getCrewProgress(courtId: string, uid: string, curMonth: string): Promise<{ monthDays: number; isCrew: boolean }> {
  const [cur, prev] = await Promise.all([
    getItem<LbTallyItem>(boardKeys.tally(boardKeys.courtBoardPk(courtId, curMonth), uid)),
    getItem<LbTallyItem>(boardKeys.tally(boardKeys.courtBoardPk(courtId, prevMonth(curMonth)), uid)),
  ]);
  const monthDays = cur?.value ?? 0;
  return { monthDays, isCrew: monthDays + (prev?.value ?? 0) >= CREW_THRESHOLD };
}

/**
 * Crown the Court Captain for `month` (the month-close sweep, §G7.2): the public,
 * leaderboards-visible user with the MOST check-in days that calendar month (min 6). Writes
 * `captainUid`/`captainMonth` onto the court meta and fires the `court_captain` notification.
 * The scheduled month-close driver is an ops hook (like the P1 sweeps); this is its unit.
 */
export async function crownCaptain(courtId: string, month: string): Promise<string | null> {
  const tallies = await queryAll<LbTallyItem>({
    pk: boardKeys.courtBoardPk(courtId, month),
    skBeginsWith: boardKeys.tallyPrefix(),
  });
  const eligible = tallies.filter((t) => t.value >= CAPTAIN_MIN).sort((a, b) => b.value - a.value || a.uid.localeCompare(b.uid));
  if (eligible.length === 0) return null;

  const [users, gamifies] = await Promise.all([
    batchGet<UserProfileItem>(eligible.map((t) => userKeys.profile(t.uid))),
    batchGet<GamifyProfileItem>(eligible.map((t) => gamifyKeys.profile(t.uid))),
  ]);
  const userBy = new Map(users.map((u) => [u.uid, u]));
  const gamifyBy = new Map(gamifies.map((g) => [g.uid, g]));

  const captain = eligible.find((t) => {
    const u = userBy.get(t.uid);
    const g = gamifyBy.get(t.uid);
    return u?.visibility === "public" && u.checkinVisibility !== "private" && g?.prefs?.leaderboards !== "hidden";
  });
  if (!captain) return null;
  const capUser = userBy.get(captain.uid)!;

  await updateItem({
    key: courtKeys.meta(courtId),
    update: "SET captainUid = :uid, captainMonth = :m",
    values: { ":uid": captain.uid, ":m": month },
  });
  // Record the captain onto the (now-frozen) month board META too — powers the captain
  // history strip on the leaderboard view without a fan-out or extra profile joins later.
  await updateItem({
    key: boardKeys.meta(boardKeys.courtBoardPk(courtId, month)),
    update: "SET captainUid = :uid, captainName = :n, captainUsername = :un" + (capUser.avatarUrl ? ", captainAvatarUrl = :av" : ""),
    values: { ":uid": captain.uid, ":n": capUser.displayName, ":un": capUser.username, ...(capUser.avatarUrl ? { ":av": capUser.avatarUrl } : {}) },
  }).catch((err) => console.error("[gamify] board-meta captain record failed (isolated):", err));
  try {
    const court = await getItem<CourtItem>(courtKeys.meta(courtId));
    const { notify } = await import("@/lib/notify");
    const { courtUrl } = await import("@/lib/urls");
    await notify(captain.uid, {
      type: "court_captain",
      title: "You're the Court Captain 🏆",
      body: court?.name ? `You checked in the most at ${court.name} — you're this month's Captain.` : "You're this month's Court Captain.",
      ...(court?.cityKey && court.slug ? { entityRef: courtUrl(court) } : {}),
    });
  } catch (err) {
    console.error("[gamify] captain notification failed (isolated):", err);
  }
  return captain.uid;
}

// ── Court status line & captain history (reads for §G12.1 / §G12.3) ──────────

export interface CourtStatusPerson {
  uid: string;
  displayName: string;
  /** Absent when the name is suppressed (private profile) — render plain, unlinked. */
  username?: string;
}
export interface CourtStatus {
  captain?: CourtStatusPerson & { month: string };
  trailblazer?: CourtStatusPerson & { at?: string };
}

/**
 * The court status-line facts (§G12.1-I1): the current Captain + the Trailblazer, hydrated
 * from the court-meta denormalized uids with privacy suppression (a non-public profile
 * renders as "A player" — uid retained, name/link withheld). At most one BatchGet.
 */
export async function getCourtStatus(
  court: Pick<CourtItem, "captainUid" | "captainMonth" | "trailblazerUid" | "trailblazerAt">,
): Promise<CourtStatus> {
  const uids = [...new Set([court.captainUid, court.trailblazerUid].filter((x): x is string => !!x))];
  if (uids.length === 0) return {};
  const users = await batchGet<UserProfileItem>(uids.map((u) => userKeys.profile(u)));
  const by = new Map(users.map((u) => [u.uid, u]));

  const person = (uid?: string): CourtStatusPerson | undefined => {
    if (!uid) return undefined;
    const u = by.get(uid);
    if (!u || u.visibility !== "public") return { uid, displayName: "A player" }; // suppress name
    return { uid, displayName: u.displayName, username: u.username };
  };

  const status: CourtStatus = {};
  const cap = person(court.captainUid);
  if (cap && court.captainMonth) status.captain = { ...cap, month: court.captainMonth };
  const tb = person(court.trailblazerUid);
  if (tb) status.trailblazer = { ...tb, ...(court.trailblazerAt ? { at: court.trailblazerAt } : {}) };
  return status;
}

export interface CaptainHistoryEntry {
  month: string;
  uid: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

/** The last `count` months' Captains for a court (§G12.3 item 5), from frozen board metas. */
export async function getCaptainHistory(courtId: string, curMonth: string, count = 6): Promise<CaptainHistoryEntry[]> {
  const months: string[] = [];
  let m = curMonth;
  for (let i = 0; i < count; i++) {
    months.push(m);
    m = prevMonth(m);
  }
  const metas = await batchGet<LbBoardMetaItem>(months.map((mm) => boardKeys.meta(boardKeys.courtBoardPk(courtId, mm))));
  const byMonth = new Map(metas.map((x) => [x.month, x]));
  const out: CaptainHistoryEntry[] = [];
  for (const mm of months) {
    const meta = byMonth.get(mm);
    if (meta?.captainUid && meta.captainName && meta.captainUsername) {
      out.push({
        month: mm,
        uid: meta.captainUid,
        displayName: meta.captainName,
        username: meta.captainUsername,
        ...(meta.captainAvatarUrl ? { avatarUrl: meta.captainAvatarUrl } : {}),
      });
    }
  }
  return out;
}
