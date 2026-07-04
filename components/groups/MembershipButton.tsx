"use client";

/**
 * MembershipButton — the join/leave control on a group detail page (§6.9).
 *
 * The primary action follows the group's JOIN POLICY (never color-alone — the
 * state is always a text label):
 *   • open    → "Join group"       (instant active membership)
 *   • request → "Request to join"  (creates a PENDING request for approval)
 *   • invite  → "Invite only"      (disabled; you need an invite link)
 *
 * It also reflects the caller's EXISTING membership: an active member sees
 * "Leave group"; a pending request shows "Request pending" + Cancel; an invited
 * member sees "Accept invitation". Joining is a gated action — signed-out visitors
 * get the auth modal via `requireAuth`, which resumes the join on success (J8).
 *
 * Updates are OPTIMISTIC (UI §1): the control flips immediately and rolls back
 * with a retry on failure.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useJoinGroup, useLeaveGroup, type GroupMembership } from "@/lib/api/groups";
import type { GroupJoinPolicy } from "@/lib/db/types";
import { joinPolicyMeta } from "./format";

export interface MembershipButtonProps {
  groupId: string;
  joinPolicy: GroupJoinPolicy;
  /** The caller's existing membership (from the CSR `useGroup` overlay). */
  membership?: GroupMembership | null;
  /**
   * The `useGroup` overlay is still resolving — the caller's membership is unknown, so
   * render a non-committal placeholder rather than asserting (and letting a member
   * click) "Join group". Once it resolves, the parent must remount this component via a
   * membership-derived `key` so `committed` re-seeds from the now-known membership.
   */
  loading?: boolean;
}

const PRIMARY =
  "inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-base font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function MembershipButton({
  groupId,
  joinPolicy,
  membership = null,
  loading = false,
}: MembershipButtonProps): JSX.Element {
  const { requireAuth } = useAuth();
  const joinMut = useJoinGroup(groupId);
  const leaveMut = useLeaveGroup(groupId);

  const [committed, setCommitted] = useState<GroupMembership | null>(membership);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const policy = joinPolicyMeta(joinPolicy);

  // Membership still unknown — a non-committal, non-clickable placeholder (never the
  // wrong "Join group" for an actual member). Keeps the layout stable (UI §1).
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <div
          className={`${PRIMARY} pointer-events-none animate-pulse bg-surface-secondary text-transparent`}
          aria-hidden="true"
        >
          {policy.action}
        </div>
        <p className="text-sm text-muted">{policy.hint}</p>
      </div>
    );
  }

  const join = () => {
    const prev = committed;
    // Invited members become active on accept; otherwise the policy decides.
    const nextStatus =
      prev?.status === "invited" ? "active" : joinPolicy === "request" ? "pending" : "active";
    setError(null);
    setSubmitting(true);
    setCommitted({ role: prev?.role ?? "member", status: nextStatus });
    joinMut
      .mutateAsync()
      .catch(() => {
        setCommitted(prev);
        setError("Something went wrong. Please try again.");
      })
      .finally(() => setSubmitting(false));
  };

  const leave = () => {
    const prev = committed;
    setError(null);
    setSubmitting(true);
    setCommitted(null);
    leaveMut
      .mutateAsync()
      .catch(() => {
        setCommitted(prev);
        setError("Something went wrong. Please try again.");
      })
      .finally(() => setSubmitting(false));
  };

  // ── Active member ──────────────────────────────────────────────────────────
  if (committed?.status === "active") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-success/15 px-4 py-3">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          <p role="status" className="text-sm font-semibold text-foreground">
            You&apos;re a member{committed.role === "owner" ? " · Owner" : committed.role === "admin" ? " · Admin" : ""}
          </p>
        </div>
        {committed.role !== "owner" && (
          <button
            type="button"
            onClick={leave}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {submitting ? "Saving…" : "Leave group"}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  // ── Pending request ────────────────────────────────────────────────────────
  if (committed?.status === "pending") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl bg-warning/15 px-4 py-3">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <p role="status" className="text-sm font-semibold text-foreground">Request pending approval</p>
        </div>
        <button
          type="button"
          onClick={leave}
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {submitting ? "Saving…" : "Cancel request"}
        </button>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  // ── Invited (has a standing invite) ────────────────────────────────────────
  if (committed?.status === "invited") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => requireAuth(join)}
          disabled={submitting}
          className={`${PRIMARY} bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-60`}
        >
          {submitting ? "Saving…" : "Accept invitation"}
        </button>
        <p className="text-sm text-muted">You were invited to join this group.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  // ── Not a member ───────────────────────────────────────────────────────────
  const inviteOnly = joinPolicy === "invite";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={inviteOnly ? undefined : () => requireAuth(join)}
        disabled={inviteOnly || submitting}
        aria-disabled={inviteOnly || undefined}
        className={`${PRIMARY} ${
          inviteOnly
            ? "cursor-not-allowed bg-surface-secondary text-muted"
            : "bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-60"
        }`}
      >
        {submitting ? "Saving…" : policy.action}
      </button>
      <p className="text-sm text-muted">{policy.hint}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export default MembershipButton;
