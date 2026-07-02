/**
 * MemberStatusList — the group's members with their live play status (§6.9).
 *
 * Presentational: renders each ACTIVE member with an avatar/initial, name, an
 * owner/admin role badge, and status chips — "Checked in today" and/or "Looking
 * to play". Those presence flags are visibility-respected server-side (only set
 * when the member allows it), so this component renders them verbatim. Every chip
 * carries an icon + text (never color-alone, a11y). No live polling — the parent's
 * CSR fetch (`useGroup`) provides day-fresh data.
 */

import type { JSX } from "react";
import type { GroupMemberView } from "@/lib/api/groups";
import { roleLabel, memberDisplayName, memberAvatarUrl } from "./format";

function Avatar({ member }: { member: GroupMemberView }): JSX.Element {
  const initial = memberDisplayName(member).trim().charAt(0).toUpperCase();
  const avatarUrl = memberAvatarUrl(member);
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
    >
      {initial}
    </span>
  );
}

function StatusChip({
  tone,
  children,
  icon,
}: {
  tone: string;
  children: React.ReactNode;
  icon: JSX.Element;
}): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {icon}
      {children}
    </span>
  );
}

export interface MemberStatusListProps {
  members: GroupMemberView[];
  /** Max rows to render (the rest are summarised as "+N more"). */
  limit?: number;
}

export function MemberStatusList({ members, limit }: MemberStatusListProps): JSX.Element {
  const active = members.filter((m) => m.status === "active");
  if (active.length === 0) {
    return <p className="text-sm text-muted">No active members yet.</p>;
  }
  const shown = typeof limit === "number" ? active.slice(0, limit) : active;
  const overflow = active.length - shown.length;

  return (
    <ul className="flex flex-col divide-y divide-border">
      {shown.map((m) => {
        const role = roleLabel(m.role);
        return (
          <li key={m.uid} className="flex items-center gap-3 py-2.5">
            <Avatar member={m} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-foreground">{memberDisplayName(m)}</span>
                {role && (
                  <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                    {role}
                  </span>
                )}
              </div>
              {(m.checkedInToday || m.lookingToPlay) && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {m.checkedInToday && (
                    <StatusChip
                      tone="bg-success/20 text-foreground"
                      icon={
                        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                      }
                    >
                      Checked in today
                    </StatusChip>
                  )}
                  {m.lookingToPlay && (
                    <StatusChip
                      tone="bg-secondary/20 text-foreground"
                      icon={
                        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" /></svg>
                      }
                    >
                      Looking to play
                    </StatusChip>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
      {overflow > 0 && (
        <li className="py-2.5 text-sm text-muted">+{overflow} more member{overflow === 1 ? "" : "s"}</li>
      )}
    </ul>
  );
}

export default MemberStatusList;
