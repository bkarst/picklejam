"use client";

/**
 * roundrobin.ts — the client API layer for the Stage 5 Round-Robin free tool
 * (§6.8). A NO-LOGIN tool: create/read/score/advance work anonymously, gated by
 * a secret `creatorToken` the browser persists locally (N2 `rrCreatorToken`) and
 * forwards on mutations via the **`X-RR-Token` header**. Claiming an event links
 * it to the signed-in user and uses the authed Bearer.
 *
 * All calls go through {@link useAuthedFetch} (attaches the Bearer when signed in
 * — harmless on the anonymous routes, which ignore it — and throws `ApiError` on
 * non-2xx). Mutations invalidate the event/my-events query keys.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/api/authed";
import type {
  CreateRrInput,
  CreateRrResult,
  RrEventFull,
  RrEventMeta,
  RrRound,
  ScoreInput,
} from "@/lib/roundrobin/types";

/** Query-key roots so views invalidate coherently after a mutation. */
export const rrApiKeys = {
  event: (eventId: string) => ["round-robin", eventId] as const,
  mine: ["me", "round-robin"] as const,
};

/** Header the anonymous creator token travels in on score/advance. */
export const RR_TOKEN_HEADER = "X-RR-Token";
const tokenHeaders = (token?: string): Record<string, string> | undefined =>
  token ? { [RR_TOKEN_HEADER]: token } : undefined;

/** Create an event (POST /api/round-robin) → { eventId, creatorToken }. Anonymous. */
export function useCreateRrEvent() {
  const authed = useAuthedFetch();
  return useMutation<CreateRrResult, Error, CreateRrInput>({
    mutationFn: (input) =>
      authed<CreateRrResult>("/api/round-robin", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

/** Read the full event (pattern 16) — GET /api/round-robin/[id]. */
export function useRrEvent(eventId: string | undefined) {
  const authed = useAuthedFetch();
  return useQuery<RrEventFull, Error>({
    queryKey: rrApiKeys.event(eventId ?? ""),
    queryFn: () => authed<RrEventFull>(`/api/round-robin/${eventId}`),
    enabled: !!eventId,
  });
}

/** Record a match score (POST /api/round-robin/[id]/score) → the fresh full event. */
export function useRecordScore(eventId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RrEventFull, Error, { score: ScoreInput; token?: string }>({
    mutationFn: ({ score, token }) =>
      authed<RrEventFull>(`/api/round-robin/${eventId}/score`, {
        method: "POST",
        headers: tokenHeaders(token),
        body: JSON.stringify(score),
      }),
    onSuccess: (full) => {
      qc.setQueryData(rrApiKeys.event(eventId), full);
      void qc.invalidateQueries({ queryKey: rrApiKeys.event(eventId) });
    },
  });
}

/** Advance a dynamic event to its next round (POST /api/round-robin/[id]/advance). */
export function useAdvanceRound(eventId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ round: RrRound | null }, Error, { token?: string }>({
    mutationFn: ({ token } = {}) =>
      authed<{ round: RrRound | null }>(`/api/round-robin/${eventId}/advance`, {
        method: "POST",
        headers: tokenHeaders(token),
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rrApiKeys.event(eventId) });
    },
  });
}

/** Claim an anonymous event for the signed-in user (POST /api/round-robin/[id]/claim). */
export function useClaimRrEvent(eventId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RrEventMeta, Error, { token: string }>({
    mutationFn: ({ token }) =>
      authed<RrEventMeta>(`/api/round-robin/${eventId}/claim`, {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rrApiKeys.event(eventId) });
      void qc.invalidateQueries({ queryKey: rrApiKeys.mine });
    },
  });
}
