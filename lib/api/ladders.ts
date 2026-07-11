"use client";

/**
 * ladders.ts — the client API layer for Stage 7 ladders (§7.4). A ladder is a
 * ranked board (RUNG#) where players climb by challenging players above them within
 * a range; a confirmed upset re-ranks the board. Public reads (finder/detail) are
 * served server-side for SEO; these hooks cover the interactive surfaces:
 * create/publish, join (→ Stripe Checkout), and the challenge lifecycle
 * (issue → respond → report → both-confirm → auto re-rank) plus the caller's
 * incoming challenges.
 *
 * Every call goes through {@link useAuthedFetch} (Bearer + JSON, throws
 * `ApiError`); mutations invalidate the relevant query keys. `useRegisterLadder`
 * returns `{ checkoutUrl }` — the caller redirects the browser to Stripe.
 *
 * ⚠ Mirrors the contract the ladders route handlers implement (`/api/ladders/*`).
 * The `LadderFull` field names mirror `lib/data/ladders`'s `LadderDetail`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { Money, FeeMode } from "@/lib/money";
import type { LadderItem, RungItem, ChallengeItem } from "@/lib/db/types";

// ── shapes ───────────────────────────────────────────────────────────────────

/** Full ladder read (pattern 22 — one query on PK=LADDER#lid). Mirrors the data
 *  layer's `LadderDetail` (note the `ladder` field name). */
export interface LadderFull {
  ladder: LadderItem;
  rungs: RungItem[];
  challenges: ChallengeItem[];
}

export interface CreateLadderInput {
  title: string;
  cityKey: string;
  startDate: string; // yyyy-mm-dd
  courtId?: string;
  venueName?: string;
  description?: string;
  avatarUrl?: string;
  currency?: string;
  feeMode?: FeeMode;
  price?: Money;
  /** How many rungs above yourself you may challenge (§7.4). */
  challengeRange?: number;
  /** Days a challenged player has to respond before forfeit (§7.4). */
  responseWindowDays?: number;
  playMode?: "singles" | "doubles";
}

/** Joining a ladder kicks off Stripe Checkout — redirect the browser to `checkoutUrl`. */
export interface RegisterLadderResult {
  checkoutUrl: string;
}

// ── query keys ────────────────────────────────────────────────────────────────

export const ladderApiKeys = {
  ladder: (lid: string) => ["ladder", lid] as const,
  myChallenges: ["me", "challenges"] as const,
};

// ── reads ─────────────────────────────────────────────────────────────────────

/** Full ladder (board + challenges) — GET /api/ladders/[id]. */
export function useLadder(lid: string | undefined) {
  const authed = useAuthedFetch();
  return useQuery<LadderFull, Error>({
    queryKey: ladderApiKeys.ladder(lid ?? ""),
    queryFn: () => authed<LadderFull>(`/api/ladders/${lid}`),
    enabled: !!lid,
  });
}

/** The caller's incoming challenges (GSI1) — GET /api/account/ladders. Signed-in. */
export function useMyChallenges() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<ChallengeItem[]>({
    queryKey: ladderApiKeys.myChallenges,
    queryFn: async () =>
      (await authed<{ challenges: ChallengeItem[] }>("/api/account/ladders")).challenges,
    enabled: !!user,
  });
}

// ── organizer mutations ────────────────────────────────────────────────────────

/** Create a draft ladder (POST /api/ladders) → the created META. */
export function useCreateLadder() {
  const authed = useAuthedFetch();
  return useMutation<LadderItem, Error, CreateLadderInput>({
    mutationFn: (input) =>
      authed<LadderItem>("/api/ladders", { method: "POST", body: JSON.stringify(input) }),
  });
}

/** Publish (POST /api/ladders/[id]/publish). Server enforces a complete Connect account. */
export function usePublishLadder(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<LadderItem, Error, void>({
    mutationFn: () => authed<LadderItem>(`/api/ladders/${lid}/publish`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ladderApiKeys.ladder(lid) }),
  });
}

// ── join (→ Stripe Checkout) ────────────────────────────────────────────────────

/**
 * Join a ladder (POST /api/ladders/[id]/register) → `{ checkoutUrl }`. The caller
 * sets `window.location.href = checkoutUrl` to hand off to Stripe Checkout; on
 * payment the server seeds the player onto a rung (bottom, or DUPR-seeded, §7.4).
 */
export function useRegisterLadder(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RegisterLadderResult, Error, { rating?: number } | void>({
    mutationFn: (input) =>
      authed<RegisterLadderResult>(`/api/ladders/${lid}/register`, {
        method: "POST",
        body: JSON.stringify(input && typeof input.rating === "number" ? { rating: input.rating } : {}),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ladderApiKeys.ladder(lid) }),
  });
}

// ── challenge lifecycle (§7.4) ──────────────────────────────────────────────────

/** Issue a challenge to a player above you within range (POST .../challenges). */
export function useIssueChallenge(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<ChallengeItem, Error, { challengedUid: string }>({
    mutationFn: (vars) =>
      authed<ChallengeItem>(`/api/ladders/${lid}/challenges`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ladderApiKeys.ladder(lid) });
      void qc.invalidateQueries({ queryKey: ladderApiKeys.myChallenges });
    },
  });
}

/** Accept or decline an incoming challenge (POST .../challenges/[cid]/respond). */
export function useRespondChallenge(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<ChallengeItem, Error, { cid: string; accept: boolean }>({
    mutationFn: ({ cid, accept }) =>
      authed<ChallengeItem>(`/api/ladders/${lid}/challenges/${cid}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ladderApiKeys.ladder(lid) });
      void qc.invalidateQueries({ queryKey: ladderApiKeys.myChallenges });
    },
  });
}

/** Report a played challenge's result (POST .../challenges/[cid]/report). */
export function useReportResult(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<
    ChallengeItem,
    Error,
    { cid: string; scoreChallenger: number; scoreChallenged: number }
  >({
    mutationFn: ({ cid, scoreChallenger, scoreChallenged }) =>
      authed<ChallengeItem>(`/api/ladders/${lid}/challenges/${cid}/report`, {
        method: "POST",
        body: JSON.stringify({ scoreChallenger, scoreChallenged }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ladderApiKeys.ladder(lid) });
      void qc.invalidateQueries({ queryKey: ladderApiKeys.myChallenges });
    },
  });
}

/** Confirm the reported result → both-confirm triggers auto re-rank (POST …/confirm). */
export function useConfirmResult(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<ChallengeItem, Error, { cid: string }>({
    mutationFn: ({ cid }) =>
      authed<ChallengeItem>(`/api/ladders/${lid}/challenges/${cid}/confirm`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ladderApiKeys.ladder(lid) });
      void qc.invalidateQueries({ queryKey: ladderApiKeys.myChallenges });
    },
  });
}
