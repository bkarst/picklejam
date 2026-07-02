/**
 * POST /api/account/onboarding — mark onboarding complete (PRD §13.8).
 *
 * Sets `onboarded:true` and merges `completedSteps[]` (union) onto the caller's
 * profile (creating a minimal one first if needed). Requires auth; `requireAuth`
 * 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getOrCreateProfile, completeOnboarding, getUserProfile } from "@/lib/data/users";
import { guarded, bad, jsonBody } from "../_util";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    let steps: string[] = [];
    if ("completedSteps" in body) {
      const v = body.completedSteps;
      if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) {
        bad("completedSteps must be an array of strings");
      }
      steps = v as string[];
    }

    await getOrCreateProfile(user); // ensure a well-formed profile exists to update
    await completeOnboarding(user.uid, steps);
    const profile = await getUserProfile(user.uid);
    return Response.json(profile);
  });
}
