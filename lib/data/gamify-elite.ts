/**
 * gamify-elite.ts — the Elite program's data layer (Gamification PRD §G11).
 *
 * `computeEliteStats` gathers the raw signals (reviews via GSI1, the year's ledger, active
 * strikes) and the pure `evaluateElite` grades them against `ELITE_CRITERIA` (config-driven).
 * Nomination is idempotent (create-only roster row); `autoFlagElite` nominates eligible users;
 * `decideElite` (the admin approve/reject) writes the `ELITEAWARD` status + `decidedBy`/
 * `decidedAt` audit fields and, on approve, awards the year-stamped badge, records the year on
 * the profile, and fires the `elite_status` notification. Roster = pattern 36; the nomination
 * queue = the same partition with a client-side `status` filter (pattern 37).
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { batchGet, getItem, putNew, queryAll, updateItem, asRecord } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { eliteKeys, gamifyKeys, userKeys } from "@/lib/db/keys";
import { getMyReviews } from "./reviews";
import { getStrikes } from "./gamify-moderation";
import { awardSpecialBadge } from "./gamify-badges";
import { trackServerEvent } from "@/lib/analytics/server";
import {
  ELITE_CRITERIA,
  evaluateElite,
  eliteBadgeId,
  medianOf,
  type EliteStats,
  type EliteEvaluation,
} from "@/lib/gamify/elite";
import { isRevocation, originalOfRevocation } from "@/lib/gamify/source-keys";
import type { EliteAwardItem, XpLedgerItem, UserProfileItem } from "@/lib/db/types";

/** Any competition-family earn counts as a "competition entry" (§G11). */
const COMPETITION_RULES = new Set(["E10", "E11", "E12", "E13", "E14", "E15", "E16", "E17", "E18"]);
/** Event-host earns count toward the "≥6 hosted events" alternative. */
const HOST_RULES = new Set(["E20", "E21", "E23"]);

function wordCount(s?: string): number {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

/** Compute a user's Elite signals for a qualifying `year` (reviews + ledger + strikes). */
export async function computeEliteStats(uid: string, year: string, now: number = Date.now()): Promise<EliteStats> {
  const [reviews, ledger, strikes] = await Promise.all([
    getMyReviews(uid),
    queryAll<XpLedgerItem>({ index: GSI.byOwner, pk: gamifyKeys.profile(uid).pk, skBeginsWith: gamifyKeys.ledgerTsPrefix() }),
    getStrikes(uid, { activeOnly: true, now }),
  ]);

  const yearReviews = reviews.filter((r) => (r.createdAt ?? "").slice(0, 4) === year);
  const words = yearReviews.map((r) => wordCount(r.body));
  const verified = yearReviews.filter((r) => r.checkinVerified).length;

  // Elite eligibility uses HONEST rolling totals (§G4.5): an earn later clawed back by moderation
  // must not still count. A revocation is a negative `<sourceKey>#REV` row, so exclude both the
  // `#REV` rows AND the original positive rows they revoke.
  const revokedOriginals = new Set(
    ledger.filter((r) => isRevocation(r.sourceKey)).map((r) => originalOfRevocation(r.sourceKey)),
  );
  const inYear = (r: XpLedgerItem) =>
    (r.ts ?? "").slice(0, 4) === year && r.points > 0 && !isRevocation(r.sourceKey) && !revokedOriginals.has(r.sourceKey);
  const yearLedger = ledger.filter(inYear);

  return {
    reviews: yearReviews.length,
    medianReviewWords: medianOf(words),
    verifiedPct: yearReviews.length ? verified / yearReviews.length : 0,
    checkins: yearLedger.filter((r) => r.rule === "E1").length,
    competitions: yearLedger.filter((r) => COMPETITION_RULES.has(r.rule)).length,
    hostedEvents: yearLedger.filter((r) => HOST_RULES.has(r.rule)).length,
    strikes: strikes.length,
  };
}

/** Grade a user against the live criteria for a year. */
export async function evaluateEliteEligibility(uid: string, year: string, now?: number): Promise<EliteEvaluation> {
  return evaluateElite(await computeEliteStats(uid, year, now), ELITE_CRITERIA);
}

/** Self-nominate (or re-read an existing decision) — idempotent create-only roster row. */
export async function nominateElite(uid: string, year: string, now: number = Date.now()): Promise<EliteAwardItem> {
  const iso = new Date(now).toISOString();
  const item: EliteAwardItem = {
    ...eliteKeys.roster(year, uid),
    entity: "ELITEAWARD",
    year,
    uid,
    status: "nominated",
    nominatedAt: iso,
    createdAt: iso,
    updatedAt: iso,
  };
  try {
    await putNew(asRecord(item));
    trackServerEvent(uid, "elite_nominated", { year });
    return item;
  } catch (e) {
    if (!(e instanceof ConditionalCheckFailedException)) throw e;
    const existing = await getItem<EliteAwardItem>(eliteKeys.roster(year, uid)); // already nominated/decided
    return existing ?? item;
  }
}

/** Auto-flag an eligible user into the nomination queue (the monthly sweep). Returns true if flagged. */
export async function autoFlagElite(uid: string, year: string, now?: number): Promise<boolean> {
  const existing = await getItem<EliteAwardItem>(eliteKeys.roster(year, uid));
  if (existing) return false; // already in the roster (nominated/decided)
  const evaluation = await evaluateEliteEligibility(uid, year, now);
  if (!evaluation.eligible) return false;
  await nominateElite(uid, year, now);
  return true;
}

/** The Elite roster for a year (pattern 36); `status` filters the nomination queue (pattern 37). */
export async function getEliteRoster(year: string, status?: EliteAwardItem["status"]): Promise<EliteAwardItem[]> {
  const items = await queryAll<EliteAwardItem>({ pk: eliteKeys.rosterPk(year), skBeginsWith: eliteKeys.rosterMemberPrefix() });
  return status ? items.filter((i) => i.status === status) : items;
}

/**
 * Admin approve/reject a nomination (§G16.6d). Writes the decision + audit fields; on approve
 * awards the `elite-<year>` badge, records the year on the profile, and fires `elite_status`.
 * Only acts on a `nominated` row (idempotent — a second decide is a no-op).
 */
export async function decideElite(
  year: string,
  uid: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  now: number = Date.now(),
): Promise<EliteAwardItem | null> {
  const iso = new Date(now).toISOString();
  try {
    await updateItem({
      key: eliteKeys.roster(year, uid),
      update: "SET #s = :s, decidedAt = :now, decidedBy = :by, updatedAt = :now",
      condition: "attribute_exists(sk) AND #s = :nominated",
      names: { "#s": "status" },
      values: { ":s": decision, ":now": iso, ":by": decidedBy, ":nominated": "nominated" },
    });
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) return null; // not nominated / already decided
    throw e;
  }

  if (decision === "approved") {
    await awardSpecialBadge(uid, eliteBadgeId(year), now);
    // Record the year on the profile (dedup-guarded so a re-approve can't double it).
    await updateItem({
      key: gamifyKeys.profile(uid),
      update: "SET eliteYears = list_append(if_not_exists(eliteYears, :empty), :y), updatedAt = :now",
      condition: "not contains(eliteYears, :yr)",
      values: { ":empty": [] as string[], ":y": [year], ":yr": year, ":now": iso },
    }).catch((err) => {
      // The condition fails when the year is already recorded — a benign no-op on re-approve.
      if (!(err instanceof ConditionalCheckFailedException)) {
        console.error("[gamify] elite year record failed (isolated):", err);
      }
    });
    try {
      const { notify } = await import("@/lib/notify");
      await notify(uid, {
        type: "elite_status",
        title: `You're Elite ${year} 🏆`,
        body: `Congratulations — you've been approved as an Elite member for ${year}.`,
        entityRef: "/elite",
      });
    } catch (err) {
      console.error("[gamify] elite notification failed (isolated):", err);
    }
    trackServerEvent(uid, "elite_awarded", { year });
  }

  return (await getItem<EliteAwardItem>(eliteKeys.roster(year, uid))) ?? null;
}

export interface EliteCohortMember {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

/** The approved, public-profile cohort for the `/elite` landing strip (§G12.17). */
export async function getEliteCohort(year: string): Promise<EliteCohortMember[]> {
  const approved = await getEliteRoster(year, "approved");
  if (approved.length === 0) return [];
  const users = await batchGet<UserProfileItem>(approved.map((a) => userKeys.profile(a.uid)));
  const by = new Map(users.map((u) => [u.uid, u]));
  return approved
    .map((a) => by.get(a.uid))
    .filter((u): u is UserProfileItem => !!u && u.visibility === "public")
    .map((u) => ({ uid: u.uid, displayName: u.displayName, username: u.username, ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}) }));
}

/** The viewer's Elite status for a year (for the self-nom CTA). */
export async function getMyEliteStatus(uid: string, year: string): Promise<{ year: string; status: EliteAwardItem["status"] | "none" }> {
  const row = await getItem<EliteAwardItem>(eliteKeys.roster(year, uid));
  return { year, status: row?.status ?? "none" };
}
