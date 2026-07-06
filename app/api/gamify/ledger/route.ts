/**
 * GET /api/gamify/ledger — the caller's RP history, newest first (§G12.6 audit trail).
 *
 * Access pattern #30 (one GSI1 Query). Cursor pagination: the DynamoDB LastEvaluatedKey
 * is base64(JSON)-encoded so the client round-trips it opaquely.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyLedger } from "@/lib/data/gamify";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

const encodeCursor = (k: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(k)).toString("base64url");

function decodeCursor(s: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const params = req.nextUrl.searchParams;
    const cursor = params.get("cursor") ? decodeCursor(params.get("cursor")!) : undefined;
    const limitRaw = Number(params.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 25;
    const page = await getMyLedger(user.uid, { cursor, limit });
    return Response.json(
      { items: page.items, cursor: page.cursor ? encodeCursor(page.cursor) : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
