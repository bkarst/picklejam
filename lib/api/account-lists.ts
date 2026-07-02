"use client";

/**
 * account-lists.ts — the client API layer for the member "my community" lists
 * (§6.2/§6.4): my check-ins, my reviews, and my followed courts.
 *
 * Each hook goes through {@link useAuthedFetch} (Bearer + JSON, throws `ApiError`)
 * so `requireAuth` verifies the read server-side, and is gated on a signed-in
 * user. Check-ins and reviews come back with a `courts` lookup (name + canonical
 * URL) so the pages can link and label without a second round-trip.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { CheckinItem, ReviewItem, OutingItem } from "@/lib/db/types";

/** Minimal hydrated court reference (for linking + labelling list rows). */
export interface CourtRef {
  name: string;
  url: string;
}

export interface MyCheckins {
  checkins: CheckinItem[];
  courts: Record<string, CourtRef>;
}

export interface MyReviews {
  reviews: ReviewItem[];
  courts: Record<string, CourtRef>;
}

/** A followed court, hydrated for the "Saved courts" list. */
export interface FollowedCourt {
  courtId: string;
  name: string;
  url: string;
  cityKey: string;
  totalCourts: number;
  ratingAvg: number;
  reviewCount: number;
  followedAt?: string;
}

/** The caller's outings, split Hosting / Attending (§6.7), with a court lookup. */
export interface MyOutings {
  hosting: OutingItem[];
  attending: OutingItem[];
  courts: Record<string, CourtRef>;
}

export const accountListKeys = {
  checkins: ["me", "checkins"] as const,
  reviews: ["me", "reviews"] as const,
  followedCourts: ["me", "followed-courts"] as const,
  outings: ["me", "outings"] as const,
};

/** The caller's check-ins, newest first. Enabled only when signed in. */
export function useMyCheckins() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyCheckins>({
    queryKey: accountListKeys.checkins,
    queryFn: () => authed<MyCheckins>("/api/account/checkins"),
    enabled: !!user,
  });
}

/** The caller's reviews. Enabled only when signed in. */
export function useMyReviews() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyReviews>({
    queryKey: accountListKeys.reviews,
    queryFn: () => authed<MyReviews>("/api/account/reviews"),
    enabled: !!user,
  });
}

/** The caller's followed courts, hydrated. Enabled only when signed in. */
export function useFollowedCourts() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<FollowedCourt[]>({
    queryKey: accountListKeys.followedCourts,
    queryFn: async () =>
      (await authed<{ courts: FollowedCourt[] }>("/api/account/followed-courts")).courts,
    enabled: !!user,
  });
}

/** The caller's outings (hosting + attending), hydrated. Enabled when signed in. */
export function useMyOutings() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyOutings>({
    queryKey: accountListKeys.outings,
    queryFn: () => authed<MyOutings>("/api/account/outings"),
    enabled: !!user,
  });
}
