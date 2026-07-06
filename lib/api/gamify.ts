"use client";

/**
 * gamify.ts — the client API layer for the gamification surfaces (Gamification PRD
 * §G12.0). `useMyGamify` is the single hook most surfaces share (profile + prefs +
 * effective visibility), sending the browser tz so the server self-heals it (§G13.0).
 * Every call goes through {@link useAuthedFetch}; mutations are optimistic with
 * revert-on-error per the CLAUDE.md UI rules.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { GamifyMeView, MyBadgesView } from "@/lib/gamify/view";
import type { GamifyPrefs, XpLedgerItem } from "@/lib/db/types";

export const gamifyQueryKeys = {
  me: ["gamify", "me"] as const,
  ledger: ["gamify", "ledger"] as const,
  badges: ["gamify", "badges"] as const,
  court: (courtId: string) => ["gamify", "court", courtId] as const,
  quest: (questId: string) => ["gamify", "quest", questId] as const,
  elite: ["gamify", "elite", "me"] as const,
  stats: ["gamify", "stats"] as const,
};

function browserTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** The caller's gamification profile + prefs + effective visibility. `staleTime` 60s. */
export function useMyGamify(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  const enabled = (opts?.enabled ?? true) && !!user;
  return useQuery<GamifyMeView>({
    queryKey: gamifyQueryKeys.me,
    queryFn: () => {
      const tz = browserTz();
      return authed<GamifyMeView>(`/api/gamify/me${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`);
    },
    enabled,
    staleTime: 60_000,
  });
}

interface LedgerPageResponse {
  items: XpLedgerItem[];
  cursor: string | null;
}

/** The caller's RP history (the audit trail, §G12.6) — cursor-paginated, newest first. */
export function useMyLedger() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useInfiniteQuery<LedgerPageResponse>({
    queryKey: gamifyQueryKeys.ledger,
    queryFn: ({ pageParam }) =>
      authed<LedgerPageResponse>(
        `/api/gamify/ledger${pageParam ? `?cursor=${encodeURIComponent(pageParam as string)}` : ""}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled: !!user,
  });
}

export interface CommunityQuestView {
  questId: string;
  title: string;
  goal: number;
  progress: number;
  status: "active" | "closed";
  myContribution?: number;
}

/** A community quest's live progress (§G12.8-I1). Public read; `enabled` gates the fetch. */
export function useCommunityQuest(questId: string, opts?: { enabled?: boolean; initialData?: CommunityQuestView }) {
  const authed = useAuthedFetch();
  return useQuery<CommunityQuestView>({
    queryKey: gamifyQueryKeys.quest(questId),
    queryFn: () => authed<CommunityQuestView>(`/api/gamify/quest/${encodeURIComponent(questId)}`),
    enabled: (opts?.enabled ?? true) && !!questId,
    staleTime: 60_000,
    ...(opts?.initialData ? { initialData: opts.initialData } : {}),
  });
}

export interface MonthStat {
  rp: number;
  checkinDays: number;
  matches: number;
  courtsVisited: number;
}
export interface MonthStatsView {
  thisMonth: MonthStat;
  lastMonth: MonthStat;
  labels: { this: string; last: string };
}

/** The caller's this-month vs last-month personal stats (§G12.6 item 3). */
export function useMyMonthStats(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MonthStatsView>({
    queryKey: gamifyQueryKeys.stats,
    queryFn: () => authed<MonthStatsView>("/api/gamify/stats"),
    enabled: (opts?.enabled ?? true) && !!user,
    staleTime: 60_000,
  });
}

export interface MyCourtGamify {
  month: string;
  monthDays: number;
  isCrew: boolean;
}

/** The caller's court-scoped gamify state (§G12.1-I2b, §G12.3 item 4): month check-in days + Crew. */
export function useMyCourtGamify(courtId: string, opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  const enabled = (opts?.enabled ?? true) && !!user && !!courtId;
  return useQuery<MyCourtGamify>({
    queryKey: gamifyQueryKeys.court(courtId),
    queryFn: () => authed<MyCourtGamify>(`/api/gamify/court/${encodeURIComponent(courtId)}/me`),
    enabled,
    staleTime: 60_000,
  });
}

/** The caller's badge collection (§G12.7) — earned + locked-with-progress. */
export function useMyBadges() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyBadgesView>({
    queryKey: gamifyQueryKeys.badges,
    queryFn: () => authed<MyBadgesView>("/api/gamify/badges"),
    enabled: !!user,
    staleTime: 60_000,
  });
}

/** Pin badges to the public showcase (§G6.3) — optimistic, reverts the badges cache on error. */
export function usePinShowcase() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ showcase: string[] }, Error, string[], { prev?: MyBadgesView }>({
    mutationFn: (showcase) =>
      authed<{ showcase: string[] }>("/api/gamify/showcase", { method: "PATCH", body: JSON.stringify({ showcase }) }),
    onMutate: async (showcase) => {
      await qc.cancelQueries({ queryKey: gamifyQueryKeys.badges });
      const prev = qc.getQueryData<MyBadgesView>(gamifyQueryKeys.badges);
      if (prev) qc.setQueryData<MyBadgesView>(gamifyQueryKeys.badges, { ...prev, showcase });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(gamifyQueryKeys.badges, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: gamifyQueryKeys.badges });
    },
  });
}

export interface MyEliteStatus {
  year: string;
  status: "none" | "nominated" | "approved" | "rejected";
}

/** The caller's Elite status for the current year (§G12.17). */
export function useMyElite(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyEliteStatus>({
    queryKey: gamifyQueryKeys.elite,
    queryFn: () => authed<MyEliteStatus>("/api/gamify/elite/me"),
    enabled: (opts?.enabled ?? true) && !!user,
    staleTime: 60_000,
  });
}

/** Self-nominate for Elite (§G11) — idempotent; updates the `elite` cache with the returned status. */
export function useEliteNominate() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<MyEliteStatus, Error, void>({
    mutationFn: () => authed<MyEliteStatus>("/api/gamify/elite/nominate", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData<MyEliteStatus>(gamifyQueryKeys.elite, data);
    },
  });
}

/** Update gamification preferences (§G12.12) — optimistic, reverts the `me` cache on error. */
export function useUpdateGamifyPrefs() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ prefs: GamifyPrefs }, Error, Partial<GamifyPrefs>, { prev?: GamifyMeView }>({
    mutationFn: (patch) =>
      authed<{ prefs: GamifyPrefs }>("/api/gamify/prefs", { method: "PATCH", body: JSON.stringify(patch) }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: gamifyQueryKeys.me });
      const prev = qc.getQueryData<GamifyMeView>(gamifyQueryKeys.me);
      if (prev) {
        const prefs = { ...prev.prefs, ...patch };
        qc.setQueryData<GamifyMeView>(gamifyQueryKeys.me, {
          ...prev,
          prefs,
          enabled: prefs.enabled && !prev.holdout,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(gamifyQueryKeys.me, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: gamifyQueryKeys.me });
    },
  });
}
