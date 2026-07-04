"use client";

/**
 * RosterManager — the owner/admin roster + pending-approval queue (§6.9).
 *
 * Two sections: PENDING requests (each with Approve / Decline) and the ACTIVE
 * roster (a native `<table>` — NOT the react-aria Table, which caused a prod
 * hydration mismatch, CLAUDE.md). Approve/decline is OPTIMISTIC (UI §1): the row
 * moves/disappears immediately and rolls back on failure. Every action carries a
 * text label (never color-alone) and meets the 44px tap target.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useApproveMember, type GroupMemberView } from "@/lib/api/groups";
import { roleLabel, memberDisplayName } from "./format";

export interface RosterManagerProps {
  groupId: string;
  members: GroupMemberView[];
}

export function RosterManager({ groupId, members }: RosterManagerProps): JSX.Element {
  const approveMut = useApproveMember(groupId);
  const [roster, setRoster] = useState<GroupMemberView[]>(members);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Adopt the server roster whenever it changes underneath us — a new join request, another
  // admin's approval/decline, a removed member (L21). React Query's structural sharing keeps the
  // same `members` reference until the content actually changes, so this fires only on a real
  // update; otherwise this stable instance would show a stale roster forever.
  const [prevMembers, setPrevMembers] = useState(members);
  if (members !== prevMembers) {
    setPrevMembers(members);
    setRoster(members);
  }

  const pending = roster.filter((m) => m.status === "pending");
  const active = roster.filter((m) => m.status === "active");

  const decide = (uid: string, decision: "approve" | "decline") => {
    const prev = roster;
    setError(null);
    setBusy((b) => ({ ...b, [uid]: true }));
    setRoster((list) =>
      decision === "approve"
        ? list.map((m) => (m.uid === uid ? { ...m, status: "active" } : m))
        : list.filter((m) => m.uid !== uid),
    );
    approveMut
      .mutateAsync({ uid, decision })
      .catch(() => {
        setRoster(prev); // roll back
        setError("Couldn't update that request. Please try again.");
      })
      .finally(() => setBusy((b) => ({ ...b, [uid]: false })));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Pending approvals */}
      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="font-display text-lg font-bold text-foreground">
          Pending requests{pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No requests waiting for approval.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {pending.map((m) => (
              <li
                key={m.uid}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-foreground">{memberDisplayName(m)}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decide(m.uid, "approve")}
                    disabled={busy[m.uid]}
                    className="inline-flex h-11 min-w-24 items-center justify-center rounded-full bg-success px-4 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {busy[m.uid] ? "Saving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(m.uid, "decline")}
                    disabled={busy[m.uid]}
                    className="inline-flex h-11 min-w-24 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active roster */}
      <section aria-labelledby="roster-heading">
        <h2 id="roster-heading" className="font-display text-lg font-bold text-foreground">
          Members ({active.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Group members</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">Member</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">Role</th>
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted">No members yet.</td>
                </tr>
              ) : (
                active.map((m) => (
                  <tr key={m.uid} className="border-b border-border last:border-0">
                    <th scope="row" className="px-3 py-3 text-left font-medium text-foreground">{memberDisplayName(m)}</th>
                    <td className="px-3 py-3 text-foreground">{roleLabel(m.role) ?? "Member"}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 text-foreground">
                        <svg viewBox="0 0 24 24" className="size-3.5 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export default RosterManager;
