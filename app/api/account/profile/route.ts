/**
 * /api/account/profile — the caller's own profile (PRD §6.3, §13.8).
 *
 * GET  → the caller's profile, creating a minimal public one on first access.
 * PUT  → update editable fields only (never uid/keys). Username changes go through
 *        the race-safe reservation transaction; a taken username → 409.
 *
 * Both require auth (per-user data); `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { isSlug } from "@/lib/util/slug";
import {
  getOrCreateProfile,
  buildProfileItem,
  putProfileWithUsername,
  isUsernameAvailable,
  isRatingSystem,
  UsernameTakenError,
  type ProfileInput,
} from "@/lib/data/users";
import { emitModify } from "@/lib/streams/inline";
import { guarded, bad, jsonBody, readOptText } from "../_util";

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME = 80;

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const profile = await getOrCreateProfile(user);
    return Response.json(profile);
  });
}

export async function PUT(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);
    const current = await getOrCreateProfile(user);

    // Overlay only editable fields onto the current logical profile.
    const next: ProfileInput = {
      uid: user.uid,
      username: current.username,
      displayName: current.displayName,
      gender: current.gender,
      homeCityKey: current.homeCityKey,
      homeCourtId: current.homeCourtId,
      avatarUrl: current.avatarUrl,
      visibility: current.visibility,
      defaultRatingSource: current.defaultRatingSource,
      onboarded: current.onboarded,
      completedSteps: current.completedSteps,
      // Carry side-channel fields written by other subsystems (notif prefs, the
      // unsubscribe suppression list, check-in visibility) so this full-Put edit does
      // NOT wipe them — resurrecting an unsubscribe is a CAN-SPAM / RFC 8058 failure.
      notifPrefs: current.notifPrefs,
      unsubscribed: current.unsubscribed,
      checkinVisibility: current.checkinVisibility,
      createdAt: current.createdAt,
    };

    if ("displayName" in body) {
      const v = body.displayName;
      if (typeof v !== "string" || !v.trim() || v.trim().length > MAX_DISPLAY_NAME) {
        bad("displayName must be 1–80 characters");
      }
      next.displayName = (v as string).trim();
    }

    if ("username" in body) {
      const v = body.username;
      if (typeof v !== "string" || !isSlug(v)) bad("username must be a valid slug");
      const username = v as string;
      if (username !== current.username && !(await isUsernameAvailable(username, user.uid))) {
        bad("username taken", 409);
      }
      next.username = username;
    }

    const gender = readOptText(body, "gender");
    if (gender.set) next.gender = gender.value;
    const homeCityKey = readOptText(body, "homeCityKey");
    if (homeCityKey.set) next.homeCityKey = homeCityKey.value;
    const homeCourtId = readOptText(body, "homeCourtId");
    if (homeCourtId.set) next.homeCourtId = homeCourtId.value;
    const avatarUrl = readOptText(body, "avatarUrl");
    if (avatarUrl.set) next.avatarUrl = avatarUrl.value;

    if ("visibility" in body) {
      const v = body.visibility;
      if (v !== "public" && v !== "private") bad("visibility must be 'public' or 'private'");
      next.visibility = v as "public" | "private";
    }

    if ("defaultRatingSource" in body) {
      const v = body.defaultRatingSource;
      if (v === null || v === undefined || v === "") next.defaultRatingSource = undefined;
      else if (isRatingSystem(v)) next.defaultRatingSource = v;
      else bad("invalid defaultRatingSource");
    }

    const item = buildProfileItem(next);
    try {
      await putProfileWithUsername(item, current.username);
    } catch (err) {
      if (err instanceof UsernameTakenError) bad("username taken", 409);
      throw err;
    }
    // Emit the profile MODIFY so the §9.4 aggregator re-attributes geo `counts.players`
    // on the homeCityKey edge — first-set at onboarding, or a later home-city move (M14).
    // No-op in prod (real Streams own it); applies inline in dev/CI.
    await emitModify(
      current as unknown as Record<string, unknown>,
      item as unknown as Record<string, unknown>,
    );
    return Response.json(item);
  });
}
