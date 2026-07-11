"use client";

/**
 * profile.ts — the client API layer for the profile & ratings spine (PRD §6.3).
 *
 * Every hook goes through {@link useAuthedFetch} (attaches the Bearer + JSON
 * headers, throws `ApiError` on non-2xx) so `requireAuth` can verify each write.
 * Reads are gated on a signed-in user; mutations invalidate the `['me', …]` cache
 * so the profile/ratings views re-fetch after a change.
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import { isSlug } from "@/lib/util/slug";
import type { UserProfileItem, RatingItem, RatingSystem } from "@/lib/db/types";

/** Query-key roots — mutations invalidate `['me']` to refresh profile + ratings. */
export const profileKeys = {
  me: ["me"] as const,
  profile: ["me", "profile"] as const,
  ratings: ["me", "ratings"] as const,
  username: (u: string) => ["username", u] as const,
};

/** Editable profile fields accepted by `PUT /api/account/profile`. */
export interface ProfileUpdate {
  displayName?: string;
  username?: string;
  gender?: string | null;
  homeCityKey?: string | null;
  homeCourtId?: string | null;
  avatarUrl?: string | null;
  visibility?: "public" | "private";
  defaultRatingSource?: RatingSystem | null;
}

export interface UsernameAvailability {
  available: boolean;
  valid: boolean;
}

/** The caller's profile. Enabled only when signed in (or when `opts.enabled`). */
export function useMyProfile(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  const enabled = (opts?.enabled ?? true) && !!user;
  return useQuery<UserProfileItem>({
    queryKey: profileKeys.profile,
    queryFn: () => authed<UserProfileItem>("/api/account/profile"),
    enabled,
  });
}

/** Update editable profile fields (PUT). Invalidates the `['me']` cache on success. */
export function useUpdateProfile() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<UserProfileItem, Error, ProfileUpdate>({
    mutationFn: (body) =>
      authed<UserProfileItem>("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}

/** Allowed avatar types + client-side size cap (mirrors the presign route). */
export const AVATAR_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const AVATAR_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Upload a profile avatar: ask the server for a short-lived presigned S3 PUT URL,
 * then PUT the bytes straight to S3 (not through our server) and return the public
 * URL to store as the profile's `avatarUrl`. Same mechanism as review photos
 * (`useUploadReviewPhoto`), namespaced under the `avatars/<uid>/` S3 prefix.
 */
export function useUploadAvatar() {
  const authed = useAuthedFetch();
  return useCallback(
    async (file: File): Promise<string> => {
      const { uploadUrl, publicUrl } = await authed<{ uploadUrl: string; publicUrl: string }>(
        "/api/uploads/avatar",
        { method: "POST", body: JSON.stringify({ contentType: file.type, size: file.size }) },
      );
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed — please try again.");
      return publicUrl;
    },
    [authed],
  );
}

/** Live username availability. Enabled only for a valid slug — debounce at call site. */
export function useUsernameAvailable(username: string) {
  const authed = useAuthedFetch();
  return useQuery<UsernameAvailability>({
    queryKey: profileKeys.username(username),
    queryFn: () =>
      authed<UsernameAvailability>(`/api/account/username?u=${encodeURIComponent(username)}`),
    enabled: isSlug(username),
    staleTime: 30_000,
  });
}

/** The caller's ratings. Enabled only when signed in. */
export function useMyRatings(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  const enabled = (opts?.enabled ?? true) && !!user;
  return useQuery<RatingItem[]>({
    queryKey: profileKeys.ratings,
    queryFn: async () =>
      (await authed<{ ratings: RatingItem[] }>("/api/account/ratings")).ratings,
    enabled,
  });
}

/** Upsert a self-entered rating (PUT). Invalidates `['me']` on success. */
export function useUpsertRating() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RatingItem, Error, { system: RatingSystem; value: number }>({
    mutationFn: (body) =>
      authed<RatingItem>("/api/account/ratings", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}

/** Delete one rating system (DELETE). Invalidates `['me']` on success. */
export function useDeleteRating() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, RatingSystem>({
    mutationFn: (system) =>
      authed<{ ok: boolean }>(`/api/account/ratings?system=${encodeURIComponent(system)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}

/** Connect DUPR (read-only stub). Records a verified RATING#DUPR. Invalidates `['me']`. */
export function useConnectDupr() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RatingItem, Error, { duprId: string; value: number }>({
    mutationFn: (body) =>
      authed<RatingItem>("/api/account/ratings/dupr", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}

/** Mark onboarding complete, merging `completedSteps`. Invalidates `['me']`. */
export function useCompleteOnboarding() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<UserProfileItem, Error, { completedSteps?: string[] } | void>({
    mutationFn: (body) =>
      authed<UserProfileItem>("/api/account/onboarding", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}
