"use client";

/**
 * PrivateGroupView — the members-only view of a PRIVATE group (§6.9).
 *
 * A private group's specifics (name, description, meet-ups, roster) must NEVER be
 * baked into the shared, cached ISR shell — the server can't identify the viewer
 * (auth is Bearer-only), so anything in the shell would leak to non-members. Instead
 * the whole view is rendered CLIENT-SIDE from the authenticated `useGroup`, whose
 * API 404s a private group for non-members. So:
 *   - loading           → skeleton
 *   - 404 / not a member → a generic "this group is private" locked card (no leak)
 *   - member            → the full header + description + meet-ups + roster + membership
 */

import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useGroup } from "@/lib/api/groups";
import { MembershipButton } from "@/components/groups/MembershipButton";
import { MemberStatusList } from "@/components/groups/MemberStatusList";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
import { OutingCard } from "@/components/outings/OutingCard";
import { visibilityMeta, memberCountLabel } from "@/components/groups/format";
import { groupManagePath, groupsHub } from "@/lib/urls";
import type { GroupJoinPolicy } from "@/lib/db/types";

export interface PrivateGroupViewProps {
  groupId: string;
  joinPolicy: GroupJoinPolicy;
}

function LockedCard(): JSX.Element {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-secondary">
        <svg viewBox="0 0 24 24" className="size-6 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </div>
      <h1 className="mt-4 font-display text-xl font-bold text-foreground">This group is private</h1>
      <p className="mt-2 text-sm text-muted">
        Only members can see this group&rsquo;s details and meet-ups. If you have an invite link,
        open it to join.
      </p>
      <Link
        href={groupsHub()}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Browse groups
      </Link>
    </div>
  );
}

function ViewSkeleton(): JSX.Element {
  return (
    <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="mt-3 h-10 w-3/4 rounded-xl" />
        <Skeleton className="mt-3 h-5 w-1/2 rounded-lg" />
        <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
      </div>
      <aside className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </aside>
    </div>
  );
}

export function PrivateGroupView({ groupId, joinPolicy }: PrivateGroupViewProps): JSX.Element {
  const { data, isLoading, error } = useGroup(groupId);

  if (isLoading) return <ViewSkeleton />;

  // A private group 404s for non-members (and signed-out visitors); any other error
  // also fails closed — never render group specifics without an authorized member.
  if (error || !data) return <LockedCard />;

  const { group, membership, members, meetups, courts } = data;
  const isManager = membership?.role === "owner" || membership?.role === "admin";
  const vis = visibilityMeta(group.visibility);
  const homeCourtName = group.homeCourtId ? courts?.[group.homeCourtId]?.name : undefined;

  return (
    <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Main */}
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${vis.tone}`}>
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            {vis.label}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Group</span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <GroupAvatar name={group.name} avatarUrl={group.avatarUrl} className="size-16 sm:size-20" />
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{group.name}</h1>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
            {memberCountLabel(data.memberCount)}
          </span>
          {homeCourtName && (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
              {homeCourtName}
            </span>
          )}
        </div>

        {group.description?.trim() && (
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">About</p>
            <p className="mt-1 text-sm text-foreground">{group.description}</p>
          </div>
        )}

        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold text-foreground">Upcoming meet-ups</h2>
          <p className="mt-1 text-sm text-muted">Group games scheduled at your courts.</p>
          {meetups.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-sm text-muted">
              No meet-ups scheduled yet. Owners and admins can schedule one from the manage console.
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {meetups.map((m) => {
                const c = m.courtId ? courts?.[m.courtId] : undefined;
                return (
                  <li key={m.outingId}>
                    <OutingCard outing={m} court={c ? { name: c.name, href: c.url } : null} showDate />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Sidebar — membership + roster */}
      <aside>
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Membership</h2>
            <div className="mt-3">
              <MembershipButton groupId={groupId} joinPolicy={joinPolicy} membership={membership} />
            </div>
            {isManager && (
              <Link
                href={groupManagePath(groupId)}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Manage group
              </Link>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Members</h2>
            <div className="mt-3">
              <MemberStatusList members={members} limit={12} />
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default PrivateGroupView;
