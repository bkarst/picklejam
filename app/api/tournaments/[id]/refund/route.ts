/**
 * POST /api/tournaments/[id]/refund — organizer-initiated refund of a single
 * registration (PRD §10). Because the ORGANIZER initiates it, the platform
 * application fee is refunded too (`refundApplicationFee: true`). Optional partial
 * `amount` (integer minor units). Requires auth (the organizer).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { refundRegistration, getTournamentMeta } from "@/lib/data/tournaments";
import { money } from "@/lib/money";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { reqStr, tourneyErr } from "@/app/api/tournaments/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    const tourney = await getTournamentMeta(id);
    if (!tourney) bad("Tournament not found", 404);
    if (tourney!.organizerId !== user.uid) bad("Only the organizer can refund", 403);

    const did = reqStr(body, "did", 200);
    const uid = reqStr(body, "uid", 200);
    let amount;
    if (body.amount !== undefined && body.amount !== null) {
      const raw = body.amount;
      const cents = typeof raw === "object" && raw !== null ? (raw as { amount?: unknown }).amount : raw;
      if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0) {
        bad("amount must be a positive integer (minor units)");
      }
      amount = money(cents as number, tourney!.currency);
    }

    try {
      const registration = await refundRegistration(id, did, uid, {
        ...(amount ? { amount } : {}),
        refundApplicationFee: true,
      });
      if (!registration) bad("Registration not found", 404);
      return Response.json(registration);
    } catch (err) {
      tourneyErr(err);
    }
  });
}
