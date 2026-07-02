"use client";

/**
 * outings.ts — the client API layer for Stage 4 outings (§6.7). Every call goes
 * through {@link useAuthedFetch} (attaches the Bearer, throws `ApiError` on
 * non-2xx). Mutations invalidate the relevant TanStack Query keys so the outing
 * detail + "my outings" views refetch. Server components/route handlers read the
 * DB directly — those aren't "API calls" and don't belong here.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/api/authed";
import type { OutingItem, RsvpItem, RsvpStatus } from "@/lib/db/types";

// The create payload is defined next to the data layer; re-exported (type-only, so
// no server code is bundled into the client) as the mutation's input.
export type { CreateOutingInput } from "@/lib/data/outings";
import type { CreateOutingInput } from "@/lib/data/outings";

/** Query-key roots so views can invalidate coherently after a mutation. */
export const outingApiKeys = {
  outing: (outingId: string) => ["outing", outingId] as const,
  cityGames: (cityKey: string, day: string) => ["city-games", cityKey, day] as const,
  courtGames: (courtId: string) => ["court", courtId, "games"] as const,
  myOutings: ["me", "outings"] as const,
};

/** The RSVP mutation result surfaced to the UI (updated RSVP + fresh counts). */
export interface RsvpResult {
  rsvp: RsvpItem;
  goingCount: number;
  waitlistCount: number;
}

export interface RsvpVars {
  status: RsvpStatus;
  guestCount?: number;
}

/** Create an outing (POST /api/outings) → the created OUTING item. */
export function useCreateOuting() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<OutingItem, Error, CreateOutingInput>({
    mutationFn: (input) =>
      authed<OutingItem>("/api/outings", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (outing) => {
      void qc.invalidateQueries({ queryKey: outingApiKeys.myOutings });
      void qc.invalidateQueries({ queryKey: outingApiKeys.courtGames(outing.courtId) });
    },
  });
}

/** RSVP to an outing (POST /api/outings/[id]/rsvp) → updated RSVP + counts. */
export function useRsvp(outingId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RsvpResult, Error, RsvpVars>({
    mutationFn: (vars) =>
      authed<RsvpResult>(`/api/outings/${outingId}/rsvp`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: outingApiKeys.outing(outingId) });
      void qc.invalidateQueries({ queryKey: outingApiKeys.myOutings });
    },
  });
}

/** Cancel the caller's RSVP (DELETE /api/outings/[id]/rsvp). */
export function useCancelRsvp(outingId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RsvpResult | { ok: true }, Error, void>({
    mutationFn: () =>
      authed<RsvpResult | { ok: true }>(`/api/outings/${outingId}/rsvp`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: outingApiKeys.outing(outingId) });
      void qc.invalidateQueries({ queryKey: outingApiKeys.myOutings });
    },
  });
}
