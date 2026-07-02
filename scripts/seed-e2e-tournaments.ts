#!/usr/bin/env tsx
/**
 * seed-e2e-tournaments.ts — a deterministic PUBLISHED tournament for the Stage 6
 * gate (J5/J6). Creates a Connect-complete organizer, one singles division (no
 * skill/DUPR gate, roomy capacity so parallel + repeated E2E runs never exhaust
 * it), and publishes — so the public detail/register/webhook flow has a real,
 * stable target at /tournaments/e2etourney. Idempotent (skips if it exists).
 *
 * The FakeGateway is per-process: marking the fake Connect account complete here
 * and persisting the ConnectAccountItem lets the E2E server (a separate process)
 * read `status:"complete"` from DynamoDB when it publishes/registers. Run against
 * the E2E DB after the other seeds.
 */

import { getOrCreateConnectAccount, markConnectComplete } from "@/lib/data/connect";
import {
  createTournament,
  addDivision,
  publishTournament,
  getTournamentMeta,
} from "@/lib/data/tournaments";
import { cityKeyOf } from "@/lib/db/keys";
import { devUid } from "@/lib/auth/dev";
import { money } from "@/lib/money";

async function main() {
  const organizer = devUid("torg@dev.local");
  await getOrCreateConnectAccount(organizer, "torg@dev.local");
  await markConnectComplete(organizer);

  if (!(await getTournamentMeta("e2etourney"))) {
    await createTournament({
      tid: "e2etourney",
      organizerId: organizer,
      title: "Lawrence Summer Open",
      cityKey: cityKeyOf("us", "kansas", "lawrence"),
      startDate: "2026-08-15",
      venueName: "Sports Pavilion at Rock Chalk Park",
      feeMode: "absorb",
      elim: "single",
    });
    await addDivision("e2etourney", {
      did: "d1",
      name: "Singles Open",
      price: money(2000, "usd"),
      capacity: 100,
      playMode: "singles",
    });
    await publishTournament("e2etourney");
  }

  console.log("Seeded e2etourney (published; Connect-complete organizer; division d1 $20 singles).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
