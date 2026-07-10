import "server-only";

/**
 * outing-reminders.ts — the pre-event RSVP ask (PRD §6.7/§9.3, G13.3 ops hook).
 *
 * `createOuting` enqueues an OUTINGREM queue row due 24h before each occurrence,
 * bucketed by UTC due-day (`REMDAY#yyyy-mm-dd`). This job — run by any scheduler
 * (cron → /api/jobs/outing-reminders, or scripts/send-outing-reminders.ts) —
 * reads today's + yesterday's partitions (yesterday = catch-up for a missed run),
 * CLAIMS each due row with a conditional delete (two concurrent runs never
 * double-send), and asks the host group's members who HAVEN'T answered — no RSVP
 * yet, or "maybe" — whether they can make it (`outing_reminder`, in-app + the
 * Resend email mirror via `notify`'s prefs gates).
 *
 * Recurring outings self-perpetuate: processing one occurrence enqueues the next.
 */

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { queryAll, deleteItem, putConditional } from "@/lib/db/client";
import { outingKeys } from "@/lib/db/keys";
import {
  buildReminderItem,
  getOuting,
  getOutingMeta,
} from "@/lib/data/outings";
import { getActiveMemberUids } from "@/lib/data/groups";
import { getCourt } from "@/lib/data/courts";
import { nextOccurrences } from "@/lib/outings/rrule";
import { whenLine } from "@/lib/outings/notify";
import { fanOut, type NotifyTemplate } from "@/lib/notify";
import { outingPath } from "@/lib/urls";
import type { OutingReminderItem } from "@/lib/db/types";

/**
 * How many past days of REMDAY partitions each sweep re-reads (catch-up for a
 * down scheduler). Rows older than this window are never claimed — they expire
 * via their TTL instead. Raise this if the cron cadence ever exceeds a day.
 */
export const REMINDER_CATCHUP_DAYS = 2;

export interface ReminderRunStats {
  /** Due queue rows found. */
  due: number;
  /** Rows this run claimed and processed (the rest went to a concurrent run). */
  processed: number;
  /** Recipients notified across all processed rows. */
  notified: number;
  /** Next-occurrence rows enqueued for recurring outings. */
  requeued: number;
  /** Claimed rows that sent nothing (outing gone, started, or nobody to ask). */
  skipped: number;
}

const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Due rows in one REMDAY partition (single keyed Query, paginated). */
async function dueRowsForDay(day: string, nowIso: string): Promise<OutingReminderItem[]> {
  const rows = await queryAll<OutingReminderItem>({
    pk: outingKeys.reminderDayPk(day),
    ascending: true,
  });
  return rows.filter((r) => r.dueTs <= nowIso);
}

/**
 * Members who haven't answered for this occurrence — no RSVP row, or "maybe" —
 * excluding the organizer (they scheduled it).
 */
export function reminderRecipients(
  memberUids: string[],
  rsvps: { uid: string; status: string }[],
  organizerId: string,
): string[] {
  const byUid = new Map(rsvps.map((r) => [r.uid, r.status]));
  return memberUids.filter((uid) => {
    if (uid === organizerId) return false;
    const status = byUid.get(uid);
    return status === undefined || status === "maybe";
  });
}

/** Process one claimed reminder row → recipients notified (+ requeue side effect). */
async function processReminder(
  row: OutingReminderItem,
  now: number,
  stats: ReminderRunStats,
): Promise<void> {
  const outing = await getOutingMeta(row.outingId);
  if (!outing) {
    stats.skipped++;
    return; // outing deleted — its queue row dies with this claim
  }

  // Recurring GROUP series: enqueue the NEXT occurrence first, so the chain
  // survives even if this send is skipped. Guarded put — an existing row
  // (double-run) is fine. Non-group rows (legacy) are never requeued: the ask
  // is a group feature, so their chain ends here instead of churning forever.
  if (outing.rrule && outing.hostType === "GROUP" && outing.groupId) {
    const after = new Date(Date.parse(row.occurrenceTs) + 1000).toISOString();
    const [next] = nextOccurrences(outing.rrule, outing.startTs, after, 1);
    if (next) {
      try {
        await putConditional(
          buildReminderItem(outing.outingId, next, now) as unknown as Record<string, unknown>,
          "attribute_not_exists(pk)",
        );
        stats.requeued++;
      } catch (err) {
        if (!(err instanceof ConditionalCheckFailedException)) throw err;
      }
    }
  }

  // Too late to ask (occurrence already started) — e.g. the scheduler was down.
  if (Date.parse(row.occurrenceTs) <= now) {
    stats.skipped++;
    return;
  }

  // The ask is a GROUP feature: members who haven't said whether they can make it.
  if (outing.hostType !== "GROUP" || !outing.groupId) {
    stats.skipped++;
    return;
  }
  const [memberUids, detail, court] = await Promise.all([
    getActiveMemberUids(outing.groupId),
    getOuting(outing.outingId),
    getCourt(outing.courtId),
  ]);
  const recipients = reminderRecipients(memberUids, detail?.rsvps ?? [], outing.organizerId);
  if (recipients.length === 0) {
    stats.skipped++;
    return;
  }

  const template: NotifyTemplate = {
    type: "outing_reminder",
    title: `Can you make it to ${outing.title}?`,
    body: `Your group plays ${whenLine(row.occurrenceTs, outing.tz, "long")}${court ? ` at ${court.name}` : ""}. RSVP to let everyone know.`,
    entityRef: outingPath(outing.outingId),
  };
  await fanOut(recipients, () => template);
  stats.notified += recipients.length;
  stats.processed++;
}

/**
 * Send every due pre-event reminder. Idempotent under concurrency: the
 * conditional DELETE is the claim gate — a row is processed by exactly the run
 * that removed it. Safe to run as often as you like (15min–hourly is typical).
 */
export async function sendDueOutingReminders(now: number = Date.now()): Promise<ReminderRunStats> {
  const stats: ReminderRunStats = { due: 0, processed: 0, notified: 0, requeued: 0, skipped: 0 };
  const nowIso = new Date(now).toISOString();

  // Today plus REMINDER_CATCHUP_DAYS back — the sweep's catch-up horizon for a
  // down scheduler. Older unclaimed rows are abandoned to their TTL.
  const days = [
    ...new Set(
      Array.from({ length: REMINDER_CATCHUP_DAYS + 1 }, (_, i) => utcDay(now - i * 86_400_000)),
    ),
  ];
  const due: OutingReminderItem[] = [];
  for (const day of days) due.push(...(await dueRowsForDay(day, nowIso)));
  stats.due = due.length;

  for (const row of due) {
    // Claim: only the run that deletes the row sends for it.
    try {
      await deleteItem({ pk: row.pk, sk: row.sk }, "attribute_exists(pk)");
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) continue; // another run won
      throw err;
    }
    await processReminder(row, now, stats);
  }

  return stats;
}
