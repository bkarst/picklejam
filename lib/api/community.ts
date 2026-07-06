"use client";

/**
 * community.ts — the client API layer for Stage 3 community actions (§6.1/§6.2/§6.4):
 * check-ins, follows, and reviews. Every call goes through {@link useAuthedFetch}
 * (attaches the Bearer when signed in, omits it when anonymous, throws `ApiError`
 * on non-2xx). Anonymous check-ins round-trip an `x-anon-token` persisted in
 * `localStorage("pl-anon-token")`. Mutations invalidate the relevant query keys.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/api/authed";
import { accountListKeys } from "@/lib/api/account-lists";
import { gamifyQueryKeys } from "@/lib/api/gamify";
import { publishGamify } from "@/lib/gamify/bus";
import type { GamifyBlock } from "@/lib/gamify/block";
import type { CheckinItem, ReviewItem } from "@/lib/db/types";

/** Where the anonymous browser token is persisted between visits. */
export const ANON_TOKEN_STORAGE_KEY = "pl-anon-token";

/** Query-key roots so views can invalidate coherently after a mutation. */
export const communityKeys = {
  checkins: (courtId: string) => ["court", courtId, "checkins"] as const,
  myCheckins: ["me", "checkins"] as const,
  reviews: (courtId: string) => ["court", courtId, "reviews"] as const,
  myReviews: ["me", "reviews"] as const,
  following: (courtId: string) => ["court", courtId, "following"] as const,
};

function readAnonToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ANON_TOKEN_STORAGE_KEY);
}

function writeAnonToken(token: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(ANON_TOKEN_STORAGE_KEY, token);
}

export interface CheckInResult {
  checkin: CheckinItem;
  anonToken?: string;
  todayCount: number;
  /** Rally-Points piggyback (§G12.0) — absent for anon / prefs-off / holdout / replay. */
  gamify?: GamifyBlock;
}

export interface CheckInVars {
  note?: string;
  skill?: number;
  lookingToPlay?: boolean;
  anonymous?: boolean;
}

/**
 * Check in at a court. Works signed-in (account check-in) or signed-out
 * (anonymous): the persisted anon token is sent as `x-anon-token`, and any token
 * the server returns is written back to `localStorage`.
 */
export function useCheckIn(courtId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<CheckInResult, Error, CheckInVars>({
    mutationFn: async (vars) => {
      const token = readAnonToken();
      const result = await authed<CheckInResult>(`/api/courts/${courtId}/checkin`, {
        method: "POST",
        headers: token ? { "x-anon-token": token } : undefined,
        body: JSON.stringify(vars),
      });
      if (result.anonToken) writeAnonToken(result.anonToken);
      return result;
    },
    onSuccess: (result) => {
      // Surface earned RP instantly via the toaster bus (§G12.0). The CheckInSheet also
      // renders the block inline in its success band; the toaster owns level-up/badges.
      publishGamify(result.gamify);
      void qc.invalidateQueries({ queryKey: communityKeys.checkins(courtId) });
      void qc.invalidateQueries({ queryKey: communityKeys.myCheckins });
      // Refresh the viewer's gamify surfaces so a check-in reflects immediately: the court
      // crew-progress island (§G12.1-I2b) and the shared profile view (dashboard/progress).
      void qc.invalidateQueries({ queryKey: gamifyQueryKeys.court(courtId) });
      void qc.invalidateQueries({ queryKey: gamifyQueryKeys.me });
    },
  });
}

/** Follow (`true`) / unfollow (`false`) a court. Requires a signed-in user. */
export function useFollowCourt(courtId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ following: boolean }, Error, boolean>({
    mutationFn: (follow) =>
      authed<{ following: boolean }>(`/api/courts/${courtId}/follow`, {
        method: follow ? "POST" : "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.following(courtId) });
      // The "Saved courts" list (/account/courts) reads `accountListKeys.followedCourts`;
      // invalidate it so a follow/unfollow shows up on return instead of lingering stale
      // for the 60s global staleTime (M20). The `following` key above has no query reader.
      void qc.invalidateQueries({ queryKey: accountListKeys.followedCourts });
    },
  });
}

export interface ReviewVars {
  rating1to5: number;
  title?: string;
  body?: string;
  tags?: string[];
  photoUrl?: string;
}

/** A review upsert response carries the earned-RP piggyback (§G12.0). */
export type SubmitReviewResult = ReviewItem & { gamify?: GamifyBlock };

/** Create or edit the caller's review for a court (one-per-user upsert). */
export function useSubmitReview(courtId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<SubmitReviewResult, Error, ReviewVars>({
    mutationFn: (vars) =>
      authed<SubmitReviewResult>(`/api/courts/${courtId}/review`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (result) => {
      publishGamify(result.gamify);
      void qc.invalidateQueries({ queryKey: communityKeys.reviews(courtId) });
      void qc.invalidateQueries({ queryKey: communityKeys.myReviews });
    },
  });
}

/** Delete the caller's review for a court. */
export function useDeleteReview(courtId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, void>({
    mutationFn: () =>
      authed<{ ok: boolean }>(`/api/courts/${courtId}/review`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: communityKeys.reviews(courtId) });
      void qc.invalidateQueries({ queryKey: communityKeys.myReviews });
    },
  });
}
