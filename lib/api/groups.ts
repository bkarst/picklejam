"use client";

/**
 * groups.ts — the client API layer for Stage 8 groups & clubs (§6.9). Every call
 * goes through {@link useAuthedFetch} (attaches the Bearer, throws `ApiError` on
 * non-2xx). Reads use `useQuery`; mutations invalidate the relevant TanStack Query
 * keys so the group detail, roster, and "my groups" views refetch coherently.
 *
 * Groups are private + invite-only BY DEFAULT (§6.9). The group DETAIL page is an
 * ISR(3600) shell; the caller's membership + the live roster (checked-in-today /
 * looking-to-play, visibility-respected server-side) are fetched CLIENT-SIDE via
 * {@link useGroup}, so the cached shell never leaks per-viewer state.
 *
 * The route serializes a FLAT member row (`GroupMemberView`) — a member who keeps
 * check-ins private is still listed (with a placeholder `displayName`) but never
 * exposes their real name/avatar (§6.2/§6.9). SEO/server surfaces (hub, city finder,
 * detail shell) read the DB directly via `@/lib/data/groups` — not "API calls".
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type {
  GroupItem,
  GroupVisibility,
  GroupJoinPolicy,
  GroupMemberRole,
  GroupMemberStatus,
  GroupInviteItem,
  GroupMemberItem,
  OutingItem,
} from "@/lib/db/types";

// ── shared view types ────────────────────────────────────────────────────────

/**
 * A roster member on the wire (the flat shape `GET /api/groups/[id]` serializes).
 * A member whose profile is withheld for privacy still lists the seat with a
 * placeholder `displayName` (§6.2/§6.9). The presence flags (`checkedInToday` /
 * `lookingToPlay`) are OPTIONAL and already gated by each member's own visibility
 * on the server, so the UI renders them verbatim when present.
 */
export interface GroupMemberView {
  uid: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  /** Checked in at the group's home court today (only when the member allows it). */
  checkedInToday?: boolean;
  /** Actively looking to play (only when the member allows it). */
  lookingToPlay?: boolean;
  joinedAt?: string;
}

/** The caller's own membership summary (null when not a member). */
export interface GroupMembership {
  role: GroupMemberRole;
  status: GroupMemberStatus;
}

/** A row in the group's "This month" RP board (§G12.13). */
export interface GroupBoardRow {
  rank: number;
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  level: number;
  value: number;
}

/** GET /api/groups/[id] — the per-viewer membership + roster (CSR overlay). */
export interface GroupDetailResponse {
  group: GroupItem;
  membership: GroupMembership | null;
  members: GroupMemberView[];
  memberCount: number;
  /** Upcoming meet-ups + their court refs — delivered per-viewer so a private group's
   *  schedule reaches members only, never the shared ISR shell. */
  meetups: OutingItem[];
  courts: Record<string, { name: string; url: string }>;
  /** The members-only "This month" RP board — present only for members (§G12.13). */
  board?: { rows: GroupBoardRow[]; hiddenCount: number };
}

/** A row in "My groups" (the group + the caller's role/status) — the route's wire shape. */
export interface MyGroup {
  group: GroupItem;
  role: GroupMemberRole;
  status: GroupMemberStatus;
}

/** POST /api/groups payload (cityKey is derived from the home court client-side). */
export interface CreateGroupInput {
  name: string;
  cityKey: string;
  homeCourtId?: string;
  visibility: GroupVisibility;
  joinPolicy: GroupJoinPolicy;
  description?: string;
}

/** PATCH /api/groups/[id] payload (settings the owner/admin can edit). */
export interface UpdateGroupInput {
  name?: string;
  description?: string;
  visibility?: GroupVisibility;
  joinPolicy?: GroupJoinPolicy;
  homeCourtId?: string;
}

/** POST /api/groups/[id]/invites → the created invite + its shareable link. */
export interface InviteResult {
  invite: GroupInviteItem;
  url: string;
}

/** An approve/decline decision on a pending membership. */
export interface ApproveVars {
  uid: string;
  decision: "approve" | "decline";
}

// ── query keys ───────────────────────────────────────────────────────────────

export const groupKeys = {
  group: (groupId: string) => ["group", groupId] as const,
  invites: (groupId: string) => ["group", groupId, "invites"] as const,
  myGroups: ["me", "groups"] as const,
};

// ── reads ────────────────────────────────────────────────────────────────────

/**
 * The per-viewer group detail overlay (membership + hydrated roster). Enabled for
 * everyone (public groups show their roster to visitors); membership is `null`
 * when the caller is signed-out or not a member.
 */
export function useGroup(groupId: string) {
  const authed = useAuthedFetch();
  const { user, loading } = useAuth();
  return useQuery<GroupDetailResponse>({
    // The response is a PER-VIEWER overlay (membership + members-only board/schedule), so it
    // MUST carry the caller's token. Key it on the viewer AND wait for auth to resolve
    // (`!loading`): this query is otherwise enabled before `AuthProvider` restores the user, so
    // it would fetch the roster anonymously, cache the non-member view, and never refetch —
    // leaving a signed-in member stuck on "Join group" with no board. Keying on `uid` also
    // refetches if the viewer signs in/out later.
    queryKey: [...groupKeys.group(groupId), user?.uid ?? "anon"],
    queryFn: () => authed<GroupDetailResponse>(`/api/groups/${groupId}`),
    enabled: !!groupId && !loading,
  });
}

/** The caller's groups (owned + joined + pending). Enabled only when signed in. */
export function useMyGroups() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<MyGroup[]>({
    queryKey: groupKeys.myGroups,
    queryFn: async () => (await authed<{ groups: MyGroup[] }>("/api/account/groups")).groups,
    enabled: !!user,
  });
}

// ── mutations ────────────────────────────────────────────────────────────────

/** Create a group (POST /api/groups) → the created GROUP item. */
export function useCreateGroup() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<GroupItem, Error, CreateGroupInput>({
    mutationFn: (input) =>
      authed<GroupItem>("/api/groups", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.myGroups });
    },
  });
}

/**
 * Join (open policy) or request to join (request policy) a group. The server sets
 * the resulting `status` per the group's join policy (`active` vs `pending`).
 * Invalidates the detail + "my groups" so the membership control + roster refetch.
 */
export function useJoinGroup(groupId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<GroupMemberItem, Error, void>({
    mutationFn: () => authed<GroupMemberItem>(`/api/groups/${groupId}/join`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.group(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.myGroups });
    },
  });
}

/** Leave a group / cancel a pending request (DELETE /api/groups/[id]/membership). */
export function useLeaveGroup(groupId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, void>({
    mutationFn: () =>
      authed<{ ok: true }>(`/api/groups/${groupId}/membership`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.group(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.myGroups });
    },
  });
}

/** Approve or decline a pending member (owner/admin). */
export function useApproveMember(groupId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<GroupMemberItem | { ok: true }, Error, ApproveVars>({
    mutationFn: ({ uid, decision }) =>
      authed<GroupMemberItem | { ok: true }>(`/api/groups/${groupId}/members/${uid}/approve`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.group(groupId) });
    },
  });
}

/** Create a shareable invite link (owner/admin) → the invite + its URL. */
export function useCreateInvite(groupId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<InviteResult, Error, { email?: string } | void>({
    mutationFn: (vars) =>
      authed<InviteResult>(`/api/groups/${groupId}/invites`, {
        method: "POST",
        body: JSON.stringify(vars ?? {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.invites(groupId) });
    },
  });
}

/** Accept an invite by its handle (POST /api/groups/invites/[token]/accept). */
export function useAcceptInvite() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<GroupMemberItem, Error, { token: string }>({
    mutationFn: ({ token }) =>
      authed<GroupMemberItem>(`/api/groups/invites/${token}/accept`, { method: "POST" }),
    onSuccess: (member) => {
      void qc.invalidateQueries({ queryKey: groupKeys.group(member.groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.myGroups });
    },
  });
}

/** Edit a group's settings (owner/admin) → the updated GROUP item. */
export function useUpdateGroup(groupId: string) {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<GroupItem, Error, UpdateGroupInput>({
    mutationFn: (input) =>
      authed<GroupItem>(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.group(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.myGroups });
    },
  });
}
