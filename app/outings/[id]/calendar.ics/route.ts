/**
 * GET /outings/[id]/calendar.ics — the outing as an iCalendar file (§6.7).
 *
 * Backs the "Add to calendar" action on the outing detail page. Recurring series
 * carry their RRULE through `toIcs`, so subscribing imports every occurrence.
 */

import type { NextRequest } from "next/server";
import { getOuting } from "@/lib/data/outings";
import { getCourt } from "@/lib/data/courts";
import { toIcs } from "@/lib/outings/rrule";
import { outingPath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const data = await getOuting(id);
  if (!data?.outing) return new Response("Not found", { status: 404 });

  const { outing } = data;
  const court = await getCourt(outing.courtId);
  const ics = toIcs({
    title: outing.title,
    startTs: outing.startTs,
    ...(outing.endTs ? { endTs: outing.endTs } : {}),
    ...(outing.description ? { description: outing.description } : {}),
    ...(court?.name ? { location: court.name } : {}),
    // A recurring series carries its RRULE so subscribers import every occurrence (M25).
    ...(outing.rrule ? { rrule: outing.rrule } : {}),
    url: `${brand.siteUrl}${outingPath(id)}`,
    uid: `${outing.outingId}@pickleloko`,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="game-${id}.ics"`,
    },
  });
}
