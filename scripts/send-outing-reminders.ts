#!/usr/bin/env tsx
/**
 * send-outing-reminders.ts — run the pre-event RSVP reminder sweep from a shell
 * (crontab / CI schedule / manual). Same logic as POST /api/jobs/outing-reminders,
 * without needing the web app up. Concurrency-safe: the queue row's conditional
 * delete means an overlapping run never double-sends.
 *
 *   npx tsx --env-file=.env scripts/send-outing-reminders.ts
 */

import { sendDueOutingReminders } from "@/lib/jobs/outing-reminders";

async function main() {
  const stats = await sendDueOutingReminders();
  console.log(
    `[outing-reminders] due=${stats.due} processed=${stats.processed} notified=${stats.notified} requeued=${stats.requeued} skipped=${stats.skipped}`,
  );
}

main().catch((err) => {
  console.error("[outing-reminders] sweep failed", err);
  process.exit(1);
});
