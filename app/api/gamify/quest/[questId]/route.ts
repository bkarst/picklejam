/**
 * GET /api/gamify/quest/[questId] — a community quest's live progress (§G12.8-I1). The city
 * directory is ISR-daily, so its quest bar reads the collective `progress` here to stay
 * current; `progress`/`goal` are public, the viewer's own contribution is added when authed.
 * `force-dynamic` + no-store so the bar's value is never a page stale.
 */

import type { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/auth/verify";
import { getItem } from "@/lib/db/client";
import { questKeys } from "@/lib/db/keys";
import { getMyCommunityContribution } from "@/lib/data/gamify-community";
import { guarded, bad } from "@/app/api/_util";
import type { QuestItem } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ questId: string }> }): Promise<Response> {
  return guarded(async () => {
    const { questId } = await ctx.params;
    const quest = await getItem<QuestItem>(questKeys.meta(questId));
    if (!quest || quest.kind !== "community") bad("Quest not found", 404);

    // Soft auth — the viewer's own contribution is added when a Bearer is present.
    let myContribution: number | undefined;
    try {
      const { uid } = await verifyRequest(req);
      myContribution = await getMyCommunityContribution(uid, questId);
    } catch {
      /* public read */
    }

    return Response.json(
      {
        questId,
        title: quest.title,
        goal: quest.goal ?? quest.rule.target,
        progress: quest.progress ?? 0,
        status: quest.status,
        ...(myContribution !== undefined ? { myContribution } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
