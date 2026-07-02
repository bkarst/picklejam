/**
 * POST /api/tournaments — create a DRAFT tournament (PRD §7.1). Requires auth; the
 * caller becomes the organizer. The tournament is not publicly discoverable until
 * `publish` (Connect-gated). GET the finder from the SSG layer, not here.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { createTournament, type CreateTournamentInput } from "@/lib/data/tournaments";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { MAX_TITLE, MAX_DESC, reqStr, optStr, optInt, tourneyErr } from "@/app/api/tournaments/_util";
import type { ElimFormat } from "@/lib/db/types";
import type { FeeMode } from "@/lib/money";

export const dynamic = "force-dynamic";

const FEE_MODES: FeeMode[] = ["absorb", "passThrough"];
const ELIM: ElimFormat[] = ["single", "double"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const title = reqStr(body, "title", MAX_TITLE);
    const cityKey = reqStr(body, "cityKey", 200);
    const startDate = reqStr(body, "startDate", 10);
    if (!DATE_RE.test(startDate)) bad("startDate must be yyyy-mm-dd");

    const feeMode = body.feeMode === undefined ? undefined : (body.feeMode as FeeMode);
    if (feeMode !== undefined && !FEE_MODES.includes(feeMode)) bad("Invalid feeMode");
    const elim = body.elim === undefined ? undefined : (body.elim as ElimFormat);
    if (elim !== undefined && !ELIM.includes(elim)) bad("Invalid elim format");

    const input: CreateTournamentInput = {
      organizerId: user.uid,
      title,
      cityKey,
      startDate,
      endDate: optStr(body, "endDate", 10),
      courtId: optStr(body, "courtId", 200),
      venueName: optStr(body, "venueName", 200),
      description: optStr(body, "description", MAX_DESC),
      currency: optStr(body, "currency", 8),
      feeMode,
      feePercentBps: optInt(body, "feePercentBps"),
      feeFixed: optInt(body, "feeFixed"),
      elim,
    };

    try {
      const tourney = await createTournament(input);
      return Response.json(tourney, { status: 201 });
    } catch (err) {
      tourneyErr(err);
    }
  });
}
