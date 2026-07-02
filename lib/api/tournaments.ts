"use client";

/**
 * tournaments.ts — the client API layer for Stage 6 tournaments + registration
 * (§7.1 / §10). Reads (detail/finder) are served server-side for SEO; these hooks
 * cover the interactive surfaces: create/publish/cancel, add divisions, register
 * (→ Stripe Checkout), organizer refunds, and the member's registrations/receipts.
 *
 * Every call goes through {@link useAuthedFetch} (Bearer + JSON, throws
 * `ApiError`); mutations invalidate the relevant query keys. `useRegister`
 * returns `{ checkoutUrl }` — the caller redirects the browser to Stripe.
 *
 * ⚠ Mirrors the contract the tournaments/route agent implements
 * (`/api/tournaments/*`); names/signatures match if it lands a copy.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { Money, FeeMode } from "@/lib/money";
import type {
  TourneyItem,
  DivisionItem,
  RegistrationItem,
  BracketMatchItem,
  PaymentItem,
  ElimFormat,
} from "@/lib/db/types";

// ── shapes ───────────────────────────────────────────────────────────────────

/** Full tournament read (pattern 18 — one query on PK=TOURNEY#tid). Mirrors the
 *  data layer's `TournamentDetail` (note the `tourney` field name). */
export interface TournamentFull {
  tourney: TourneyItem;
  divisions: DivisionItem[];
  registrations?: RegistrationItem[];
  bracket?: BracketMatchItem[];
}

export interface CreateTournamentInput {
  title: string;
  cityKey?: string;
  courtId?: string;
  venueName?: string;
  startDate: string; // yyyy-mm-dd
  endDate?: string;
  description?: string;
  elim: ElimFormat;
  feeMode: FeeMode;
  currency?: string;
}

export interface AddDivisionInput {
  name: string;
  price: Money;
  capacity?: number;
  skillMin?: number;
  skillMax?: number;
  duprMin?: number;
  duprMax?: number;
  playMode: "singles" | "doubles";
  gender?: "mens" | "womens" | "mixed" | "open";
}

export interface RegisterInput {
  /** Division id (sent to the API as `divisionId`). */
  did: string;
  /** Doubles: the partner's uid/handle (partner-pending until they accept). */
  partnerUid?: string | null;
  /** Self-reported rating for the DUPR/skill gate check (server re-verifies). */
  dupr?: number;
  skill?: number;
}

/** Registration kicks off Stripe Checkout — redirect the browser to `checkoutUrl`. */
export interface RegisterResult {
  checkoutUrl: string;
  regKey?: string;
  status?: string;
}

/** The member's registrations, hydrated with their tournament (pattern 19). */
export interface MyRegistration {
  registration: RegistrationItem;
  tourney?: TourneyItem;
}

// ── query keys ────────────────────────────────────────────────────────────────

export const tournamentApiKeys = {
  tournament: (tid: string) => ["tournament", tid] as const,
  mine: ["me", "tournaments"] as const,
  myRegistrations: ["me", "registrations"] as const,
  myPayments: ["me", "payments"] as const,
};

// ── reads ─────────────────────────────────────────────────────────────────────

/** Full tournament (organizer dashboard / live surfaces) — GET /api/tournaments/[id]. */
export function useTournament(tid: string | undefined) {
  const authed = useAuthedFetch();
  return useQuery<TournamentFull, Error>({
    queryKey: tournamentApiKeys.tournament(tid ?? ""),
    queryFn: () => authed<TournamentFull>(`/api/tournaments/${tid}`),
    enabled: !!tid,
  });
}

/** The caller's registrations (GSI1) — GET /api/account/registrations. Signed-in. */
export function useMyRegistrations() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyRegistration[]>({
    queryKey: tournamentApiKeys.myRegistrations,
    queryFn: async () =>
      (await authed<{ registrations: MyRegistration[] }>("/api/account/registrations"))
        .registrations,
    enabled: !!user,
  });
}

/** The caller's payment receipts — GET /api/account/payments. Signed-in. */
export function useMyPayments() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<PaymentItem[]>({
    queryKey: tournamentApiKeys.myPayments,
    queryFn: async () =>
      (await authed<{ payments: PaymentItem[] }>("/api/account/payments")).payments,
    enabled: !!user,
  });
}

// ── organizer mutations ────────────────────────────────────────────────────────

/** Create a draft tournament (POST /api/tournaments) → the created META. */
export function useCreateTournament() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<TourneyItem, Error, CreateTournamentInput>({
    mutationFn: (input) =>
      authed<TourneyItem>("/api/tournaments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tournamentApiKeys.mine }),
  });
}

/** Add a division (POST /api/tournaments/[id]/divisions) → the created DIVISION. */
export function useAddDivision(tid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<DivisionItem, Error, AddDivisionInput>({
    mutationFn: (input) =>
      authed<DivisionItem>(`/api/tournaments/${tid}/divisions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tournamentApiKeys.tournament(tid) }),
  });
}

/** Publish (POST /api/tournaments/[id]/publish). Server enforces Connect + ≥1 division. */
export function usePublishTournament(tid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<TourneyItem, Error, void>({
    mutationFn: () => authed<TourneyItem>(`/api/tournaments/${tid}/publish`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tournamentApiKeys.tournament(tid) });
      void qc.invalidateQueries({ queryKey: tournamentApiKeys.mine });
    },
  });
}

/** Cancel a tournament (POST /api/tournaments/[id]/cancel) — refunds are issued server-side. */
export function useCancelTournament(tid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<TourneyItem, Error, void>({
    mutationFn: () => authed<TourneyItem>(`/api/tournaments/${tid}/cancel`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tournamentApiKeys.tournament(tid) });
      void qc.invalidateQueries({ queryKey: tournamentApiKeys.mine });
    },
  });
}

/** Refund a single registration (POST /api/tournaments/[id]/refund). */
export function useRefundRegistration(tid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RegistrationItem, Error, { did: string; uid: string; amount?: Money }>({
    mutationFn: (vars) =>
      authed<RegistrationItem>(`/api/tournaments/${tid}/refund`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tournamentApiKeys.tournament(tid) }),
  });
}

// ── registration (→ Stripe Checkout) ───────────────────────────────────────────

/**
 * Register for a division (POST /api/tournaments/[id]/register). Returns
 * `{ checkoutUrl }` — the caller sets `window.location.href = checkoutUrl` to hand
 * off to Stripe Checkout (the destination charge + application fee are configured
 * server-side, §10).
 */
export function useRegister(tid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RegisterResult, Error, RegisterInput>({
    mutationFn: (input) =>
      authed<RegisterResult>(`/api/tournaments/${tid}/register`, {
        method: "POST",
        body: JSON.stringify({
          divisionId: input.did,
          ...(input.partnerUid ? { partnerUid: input.partnerUid } : {}),
          ...(typeof input.dupr === "number" ? { dupr: input.dupr } : {}),
          ...(typeof input.skill === "number" ? { skill: input.skill } : {}),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tournamentApiKeys.tournament(tid) });
      void qc.invalidateQueries({ queryKey: tournamentApiKeys.myRegistrations });
    },
  });
}
