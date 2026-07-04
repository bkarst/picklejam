"use client";

/**
 * GroupDetailClient — the per-viewer overlay on the ISR group-detail shell (§6.9).
 *
 * The static shell is cached and shared, so anything viewer-specific or day-fresh
 * loads CLIENT-SIDE here via `useGroup`: the caller's membership control (join /
 * request / leave, per join policy) and the live member roster with "checked in
 * today / looking to play" status (visibility-respected on the server). Owners and
 * admins also get a link into the manage console.
 *
 * Loading uses Skeletons (UI §1); the MembershipButton renders immediately from
 * the server-provided `joinPolicy` so the primary action never flashes empty.
 */

import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useGroup } from "@/lib/api/groups";
import { MembershipButton } from "@/components/groups/MembershipButton";
import { MemberStatusList } from "@/components/groups/MemberStatusList";
import { groupManagePath } from "@/lib/urls";
import type { GroupJoinPolicy } from "@/lib/db/types";

export interface GroupDetailClientProps {
  groupId: string;
  joinPolicy: GroupJoinPolicy;
}

export function GroupDetailClient({ groupId, joinPolicy }: GroupDetailClientProps): JSX.Element {
  const { data, isLoading } = useGroup(groupId);
  const membership = data?.membership ?? null;
  const isManager = membership?.role === "owner" || membership?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-foreground">Membership</h2>
        <div className="mt-3">
          {/* key: remount when the membership overlay resolves so MembershipButton
              re-seeds its `committed` state from the now-known membership (else a
              member stays showing "Join group"). loading: show a placeholder until then. */}
          <MembershipButton
            key={membership ? `${membership.role}:${membership.status}` : "none"}
            groupId={groupId}
            joinPolicy={joinPolicy}
            membership={membership}
            loading={isLoading}
          />
        </div>
        {isManager && (
          <Link
            href={groupManagePath(groupId)}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            Manage group
          </Link>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-foreground">Members</h2>
        <div className="mt-3">
          {isLoading || !data ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <MemberStatusList members={data.members} limit={12} />
          )}
        </div>
      </section>
    </div>
  );
}

export default GroupDetailClient;
