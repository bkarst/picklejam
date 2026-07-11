"use client";

/**
 * My groups (/account/groups) — the caller's groups & clubs (§6.9): owned, joined,
 * and pending. noindex + the auth guard are inherited from the /account layout.
 * Loading = Skeletons; empty state points at the create flow.
 */

import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useMyGroups, type MyGroup } from "@/lib/api/groups";
import { GroupCard, roleLabel, myGroupRoleStatus } from "@/components/groups";
import { groupPath, groupNewPath } from "@/lib/urls";

function membershipLabel(g: MyGroup): string {
  const { role, status } = myGroupRoleStatus(g);
  if (status === "pending") return "Pending";
  if (status === "invited") return "Invited";
  return roleLabel(role) ?? "Member";
}

export default function MyGroupsPage(): JSX.Element {
  const { data, isLoading } = useMyGroups();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">My groups</h1>
        <Link
          href={groupNewPath()}
          className="inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Start a group
        </Link>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p>You&apos;re not in any groups yet. Start one or ask a friend for an invite link.</p>
          <Link
            href={groupNewPath()}
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Start a group
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.map((g) => (
            <li key={g.group.groupId}>
              <GroupCard
                href={groupPath(g.group.groupId)}
                name={g.group.name}
                visibility={g.group.visibility}
                memberCount={g.group.memberCount}
                avatarUrl={g.group.avatarUrl}
                description={g.group.description}
                membershipLabel={membershipLabel(g)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
