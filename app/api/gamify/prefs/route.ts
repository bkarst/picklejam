/**
 * PATCH /api/gamify/prefs — update gamification preferences (§G12.12).
 *
 * Merges only the provided keys (optimistic on the client, revert-on-error). Private
 * profiles can't appear on leaderboards (§6.3 precedence) — the UI disables that toggle;
 * the server also coerces `leaderboards: "hidden"` for private profiles as a backstop.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { updateGamifyPrefs } from "@/lib/data/gamify";
import { getUserProfile } from "@/lib/data/users";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import type { GamifyPrefs } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function parsePatch(body: Record<string, unknown>): Partial<GamifyPrefs> {
  const patch: Partial<GamifyPrefs> = {};
  for (const key of ["enabled", "streakReminders", "digest"] as const) {
    if (key in body) {
      if (typeof body[key] !== "boolean") bad(`${key} must be a boolean`);
      patch[key] = body[key] as boolean;
    }
  }
  if ("leaderboards" in body) {
    if (body.leaderboards !== "public" && body.leaderboards !== "hidden") {
      bad("leaderboards must be 'public' or 'hidden'");
    }
    patch.leaderboards = body.leaderboards;
  }
  return patch;
}

export async function PATCH(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const patch = parsePatch(await jsonBody(req));

    // Backstop: a private profile can never surface on leaderboards.
    if (patch.leaderboards === "public") {
      const profile = await getUserProfile(user.uid);
      if (profile && profile.visibility !== "public") patch.leaderboards = "hidden";
    }

    const prefs = await updateGamifyPrefs(user.uid, patch);
    return Response.json({ prefs });
  });
}
