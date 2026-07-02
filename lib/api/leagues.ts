"use client";

/**
 * leagues.ts — the client API layer for Stage 7 leagues + participation
 * (§7.2 / §7.3 / §10). Reads for SEO surfaces (hub / finder / detail / standings)
 * are served server-side from `lib/data/leagues`; these hooks cover the
 * interactive surfaces: create/publish, add divisions, register (→ Stripe
 * Checkout), the participant console (report/confirm weekly scores, set weekly
 * availability), and the member's leagues.
 *
 * Every call goes through {@link useAuthedFetch} (Bearer + JSON, throws
 * `ApiError`); mutations invalidate the relevant query keys. `useRegisterLeague`
 * returns `{ checkoutUrl }` — the caller redirects the browser to Stripe.
 *
 * ⚠ Mirrors the contract the leagues/route agent implements (`/api/leagues/*`);
 * names/signatures match if it lands a copy. The `LeagueFull` field names mirror
 * `lib/data/leagues`'s `LeagueDetail` (the SEO reads).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { Money, FeeMode } from "@/lib/money";
import type {
  LeagueItem,
  LeagueDivisionItem,
  LeagueTeamItem,
  LeagueRegistrationItem,
  ScheduleMatchItem,
  LeagueStandingItem,
  AvailabilityItem,
  AvailabilityStatus,
} from "@/lib/db/types";

// ── shapes ───────────────────────────────────────────────────────────────────

/** Full league read (pattern 21 — one query on PK=LEAGUE#lid). Mirrors the data
 *  layer's `LeagueDetail` (note the `league` field name). */
export interface LeagueFull {
  league: LeagueItem;
  divisions: LeagueDivisionItem[];
  teams: LeagueTeamItem[];
  registrations?: LeagueRegistrationItem[];
  schedule: ScheduleMatchItem[];
  standings: LeagueStandingItem[];
  availability?: AvailabilityItem[];
}

export interface CreateLeagueInput {
  title: string;
  cityKey?: string;
  courtId?: string;
  venueName?: string;
  startDate: string; // yyyy-mm-dd
  endDate?: string;
  seasonWeeks: number;
  description?: string;
  playMode: "singles" | "doubles" | "team";
  feeMode: FeeMode;
  currency?: string;
}

export interface AddLeagueDivisionInput {
  name: string;
  price: Money;
  capacity?: number;
  skillMin?: number;
  skillMax?: number;
  duprMin?: number;
  duprMax?: number;
  playMode: "singles" | "doubles" | "team";
}

export interface RegisterLeagueInput {
  /** Division / flight id (sent to the API as `divisionId`). */
  did: string;
  /** "partner" registers with a named partner; "freeAgent" joins the sub/pair pool. */
  mode: "partner" | "freeAgent";
  /** Partner uid/handle (partner-pending until they accept). Only for `partner`. */
  partnerUid?: string | null;
  /** Self-reported rating for the DUPR/skill gate (server re-verifies). */
  dupr?: number;
  skill?: number;
}

/** Registration kicks off Stripe Checkout — redirect the browser to `checkoutUrl`. */
export interface RegisterResult {
  checkoutUrl: string;
  regKey?: string;
  status?: string;
}

/** Report a weekly fixture's score (§7.3 two-party handshake, first party). */
export interface ReportScoreInput {
  week: number;
  mid: string;
  scoreA: number;
  scoreB: number;
}

/** Confirm (or dispute) the opponent's reported score (second party). */
export interface ConfirmScoreInput {
  week: number;
  mid: string;
  /** `false` flags a conflict instead of confirming. */
  agree?: boolean;
}

export interface SetAvailabilityInput {
  week: number;
  status: AvailabilityStatus;
  note?: string;
}

/** The member's leagues, hydrated with their league (pattern 21 / GSI1). */
export interface MyLeague {
  registration: LeagueRegistrationItem;
  league?: LeagueItem;
}

// ── query keys ────────────────────────────────────────────────────────────────

export const leagueApiKeys = {
  league: (lid: string) => ["league", lid] as const,
  mine: ["me", "leagues"] as const,
};

// ── reads ─────────────────────────────────────────────────────────────────────

/** Full league (console / dashboard / live surfaces) — GET /api/leagues/[id]. */
export function useLeague(lid: string | undefined) {
  const authed = useAuthedFetch();
  return useQuery<LeagueFull, Error>({
    queryKey: leagueApiKeys.league(lid ?? ""),
    queryFn: () => authed<LeagueFull>(`/api/leagues/${lid}`),
    enabled: !!lid,
  });
}

/** The caller's leagues (GSI1) — GET /api/account/leagues. Signed-in. */
export function useMyLeagues() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyLeague[]>({
    queryKey: leagueApiKeys.mine,
    queryFn: async () =>
      (await authed<{ registrations: MyLeague[] }>("/api/account/leagues")).registrations,
    enabled: !!user,
  });
}

// ── organizer mutations ────────────────────────────────────────────────────────

/** Create a draft league (POST /api/leagues) → the created META. */
export function useCreateLeague() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<LeagueItem, Error, CreateLeagueInput>({
    mutationFn: (input) =>
      authed<LeagueItem>("/api/leagues", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueApiKeys.mine }),
  });
}

/** Add a division / flight (POST /api/leagues/[id]/divisions) → the created row. */
export function useAddLeagueDivision(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<LeagueDivisionItem, Error, AddLeagueDivisionInput>({
    mutationFn: (input) =>
      authed<LeagueDivisionItem>(`/api/leagues/${lid}/divisions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) }),
  });
}

/** Publish (POST /api/leagues/[id]/publish). Server enforces Connect + ≥1 division. */
export function usePublishLeague(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<LeagueItem, Error, void>({
    mutationFn: () => authed<LeagueItem>(`/api/leagues/${lid}/publish`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) });
      void qc.invalidateQueries({ queryKey: leagueApiKeys.mine });
    },
  });
}

// ── registration (→ Stripe Checkout) ───────────────────────────────────────────

/**
 * Register for a division / flight (POST /api/leagues/[id]/register). Returns
 * `{ checkoutUrl }` — the caller sets `window.location.href = checkoutUrl` to hand
 * off to Stripe Checkout (destination charge + application fee configured server-
 * side, §10). `mode` selects team/partner vs the free-agent pool.
 */
export function useRegisterLeague(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<RegisterResult, Error, RegisterLeagueInput>({
    mutationFn: (input) =>
      authed<RegisterResult>(`/api/leagues/${lid}/register`, {
        method: "POST",
        body: JSON.stringify({
          divisionId: input.did,
          mode: input.mode,
          freeAgent: input.mode === "freeAgent",
          ...(input.partnerUid ? { partnerUid: input.partnerUid } : {}),
          ...(typeof input.dupr === "number" ? { dupr: input.dupr } : {}),
          ...(typeof input.skill === "number" ? { skill: input.skill } : {}),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) });
      void qc.invalidateQueries({ queryKey: leagueApiKeys.mine });
    },
  });
}

/** Generate the weekly schedule from the paid roster (POST /api/leagues/[id]/schedule). */
export function useGenerateSchedule(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ schedule: ScheduleMatchItem[] }, Error, void>({
    mutationFn: () =>
      authed<{ schedule: ScheduleMatchItem[] }>(`/api/leagues/${lid}/schedule`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) }),
  });
}

/** Cancel a league (POST /api/leagues/[id]/cancel) — refunds are issued server-side. */
export function useCancelLeague(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<LeagueItem, Error, void>({
    mutationFn: () => authed<LeagueItem>(`/api/leagues/${lid}/cancel`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) });
      void qc.invalidateQueries({ queryKey: leagueApiKeys.mine });
    },
  });
}

// ── participant console (§7.3) ──────────────────────────────────────────────────

/** Report a weekly fixture score (POST /api/leagues/[id]/score). */
export function useReportScore(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<ScheduleMatchItem, Error, ReportScoreInput>({
    mutationFn: (input) =>
      authed<ScheduleMatchItem>(`/api/leagues/${lid}/score`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) }),
  });
}

/** Confirm / dispute the opponent's reported score (POST /api/leagues/[id]/confirm). */
export function useConfirmScore(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<ScheduleMatchItem, Error, ConfirmScoreInput>({
    mutationFn: (input) =>
      authed<ScheduleMatchItem>(`/api/leagues/${lid}/confirm`, {
        method: "POST",
        body: JSON.stringify({ ...input, agree: input.agree ?? true }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) }),
  });
}

/** Set weekly availability / sub-pool flag (POST /api/leagues/[id]/availability). */
export function useSetAvailability(lid: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<AvailabilityItem, Error, SetAvailabilityInput>({
    mutationFn: (input) =>
      authed<AvailabilityItem>(`/api/leagues/${lid}/availability`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: leagueApiKeys.league(lid) }),
  });
}
