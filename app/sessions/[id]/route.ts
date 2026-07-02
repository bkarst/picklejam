/**
 * GET /sessions/[id] — permanent redirect to the canonical outing URL (§3.2).
 *
 * "Session" is a legacy/alias term for an outing; the canonical page lives at
 * `/outings/[id]`. A 301 consolidates any link equity onto the canonical path.
 */

import { NextResponse, type NextRequest } from "next/server";
import { outingPath } from "@/lib/urls";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  return NextResponse.redirect(new URL(outingPath(id), req.url), 301);
}
