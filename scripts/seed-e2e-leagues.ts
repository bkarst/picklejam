#!/usr/bin/env tsx
/**
 * seed-e2e-leagues.ts — deterministic PUBLISHED league + ladder for the Stage 7
 * gate (J7). Uses the FakeGateway (tsx doesn't load .env, so STRIPE_SECRET_KEY is
 * unset here) — no real Stripe. Creates a Connect-complete organizer, then:
 *   • league `e2eleague` (1 division, 3 weeks) with two paid singles players +
 *     a generated weekly schedule — ready for the score/confirm handshake;
 *   • ladder `e2eladder` with three paid players on rungs — ready for a challenge.
 */

import { getOrCreateConnectAccount, markConnectComplete } from "@/lib/data/connect";
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
import { cityKeyOf } from "@/lib/db/keys";
import { devUid } from "@/lib/auth/dev";
import { money } from "@/lib/money";

const CITY = cityKeyOf("us", "kansas", "lawrence");

async function main() {
  const organizer = devUid("torg@dev.local");
  await getOrCreateConnectAccount(organizer, "torg@dev.local");
  await markConnectComplete(organizer);

  // ── League ──
  if (!(await getLeague("e2eleague"))) {
    await createLeague({
      lid: "e2eleague",
      organizerId: organizer,
      title: "Lawrence Fall League",
      cityKey: CITY,
      startDate: "2026-09-01",
      seasonWeeks: 3,
      playMode: "singles",
      feeMode: "absorb",
      currency: "usd",
      venueName: "Sports Pavilion at Rock Chalk Park",
    });
    await addLeagueDivision("e2eleague", {
      did: "d1",
      name: "Singles 3.5",
      price: money(3000, "usd"),
      capacity: 100,
      playMode: "singles",
    });
    await publishLeague("e2eleague");
    for (const email of ["lp1@dev.local", "lp2@dev.local"]) {
      const uid = devUid(email);
      await registerForLeague("e2eleague", "d1", uid, {});
      await confirmLeaguePayment({ lid: "e2eleague", did: "d1", uid });
    }
    await generateSchedule("e2eleague");
  }

  // ── Ladder ──
  if (!(await getLadder("e2eladder"))) {
    await createLadder({
      lid: "e2eladder",
      organizerId: organizer,
      title: "Lawrence Singles Ladder",
      cityKey: CITY,
      startDate: "2026-09-01",
      price: money(1500, "usd"),
      // Range 1 ⇒ the bottom player has exactly ONE eligible opponent (the rung
      // directly above), so the E2E's "Challenge" click is unambiguous.
      challengeRange: 1,
      responseWindowDays: 7,
      playMode: "singles",
      feeMode: "absorb",
      currency: "usd",
    });
    await publishLadder("e2eladder");
    for (const email of ["rp1@dev.local", "rp2@dev.local", "rp3@dev.local"]) {
      const uid = devUid(email);
      await registerForLadder("e2eladder", uid, {});
      await confirmLadderPayment({ lid: "e2eladder", uid });
    }
  }

  console.log("Seeded e2eleague (2 players + schedule) + e2eladder (3 rungs).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
