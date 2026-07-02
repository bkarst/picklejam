/**
 * GET /api/account/username?u=<slug> — is a username available? (PRD §6.3)
 *
 * `{ valid:false }` when `u` is not a slug; otherwise `{ available, valid:true }`.
 * Auth is SOFT: if a valid Bearer is present, the caller's own current username
 * reads as available (so editing your profile without changing it isn't blocked).
 * A public availability probe (no token) still works for signup.
 */

import type { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/auth/verify";
import { isSlug } from "@/lib/util/slug";
import { isUsernameAvailable } from "@/lib/data/users";
import { guarded } from "../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const u = req.nextUrl.searchParams.get("u") ?? "";
    if (!isSlug(u)) return Response.json({ available: false, valid: false });

    let forUid: string | undefined;
    try {
      forUid = (await verifyRequest(req)).uid;
    } catch {
      /* anonymous availability check */
    }

    const available = await isUsernameAvailable(u, forUid);
    return Response.json({ available, valid: true });
  });
}
