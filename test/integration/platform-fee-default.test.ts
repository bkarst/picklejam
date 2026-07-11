// Regression guard for the server-authoritative platform fee (§10): when an event
// is created without an explicit fee — which is how the create WIZARDS/ROUTES call
// the data layer — the persisted config must be the canonical PLATFORM_FEE, not
// 0/0. Previously the wizards previewed 5% + $0.30 but stored 0/0, so the platform
// silently collected nothing. See lib/money.ts `PLATFORM_FEE`.
//
// Env preamble mirrors the other integration suites (inline aggregates + emulated
// TransactWrite). Skipped without DYNAMODB_ENDPOINT.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";

import { describe, it, expect } from "vitest";
import { PLATFORM_FEE } from "@/lib/money";
import { createTournament, getTournamentMeta } from "@/lib/data/tournaments";
import { createLeague, getLeagueMeta } from "@/lib/data/leagues";
import { createLadder, getLadderMeta } from "@/lib/data/ladders";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const CITY = "us#kansas#lawrence";

d("platform fee is server-authoritative", () => {
  it("createTournament stores PLATFORM_FEE when no fee is supplied", async () => {
    const t = await createTournament({
      organizerId: "u_fee_t",
      title: "Fee Default Tournament",
      cityKey: CITY,
      startDate: "2026-06-01",
    });
    const meta = await getTournamentMeta(t.tid);
    expect(meta?.feePercentBps).toBe(PLATFORM_FEE.percentBps);
    expect(meta?.feeFixed).toBe(PLATFORM_FEE.fixed);
    expect(meta?.feeMode).toBe("absorb");
  });

  it("createLeague stores PLATFORM_FEE when no fee is supplied", async () => {
    const l = await createLeague({
      organizerId: "u_fee_l",
      title: "Fee Default League",
      cityKey: CITY,
      startDate: "2026-06-01",
    });
    const meta = await getLeagueMeta(l.lid);
    expect(meta?.feePercentBps).toBe(PLATFORM_FEE.percentBps);
    expect(meta?.feeFixed).toBe(PLATFORM_FEE.fixed);
  });

  it("createLadder stores PLATFORM_FEE when no fee is supplied", async () => {
    const la = await createLadder({
      organizerId: "u_fee_la",
      title: "Fee Default Ladder",
      cityKey: CITY,
      startDate: "2026-06-01",
    });
    const meta = await getLadderMeta(la.lid);
    expect(meta?.feePercentBps).toBe(PLATFORM_FEE.percentBps);
    expect(meta?.feeFixed).toBe(PLATFORM_FEE.fixed);
  });

  it("still honors an explicit fee override (tests/seeds)", async () => {
    const t = await createTournament({
      organizerId: "u_fee_override",
      title: "Override Tournament",
      cityKey: CITY,
      startDate: "2026-06-01",
      feePercentBps: 1000,
      feeFixed: 0,
    });
    const meta = await getTournamentMeta(t.tid);
    expect(meta?.feePercentBps).toBe(1000);
    expect(meta?.feeFixed).toBe(0);
  });
});
