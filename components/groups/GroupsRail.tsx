/**
 * GroupsRail — a titled grid of {@link GroupCard}s for a set of PUBLIC groups.
 *
 * Server-renderable. Used on the court detail ("Groups that play here") and the
 * city finder / group detail cross-links. Purely presentational: it maps
 * `GroupItem`s onto GroupCards (canonical `/groups/[id]` links) and renders an
 * optional heading + "see all" link. Renders nothing when there are no groups, so
 * callers can drop it in unconditionally.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { GroupItem } from "@/lib/db/types";
import { groupPath } from "@/lib/urls";
import { GroupCard } from "./GroupCard";

export interface GroupsRailProps {
  groups: GroupItem[];
  /** Section heading (omit to render just the grid). */
  title?: string;
  /** Shared city label applied to every card (e.g. the court's "Austin, TX"). */
  cityLabel?: string;
  /** Optional home-court name lookup by courtId (for the card's place line). */
  courtNames?: Record<string, string>;
  /** Optional "see all" link (e.g. the city group finder). */
  seeAllHref?: string;
  seeAllLabel?: string;
}

export function GroupsRail({
  groups,
  title,
  cityLabel,
  courtNames,
  seeAllHref,
  seeAllLabel = "See all",
}: GroupsRailProps): JSX.Element | null {
  if (groups.length === 0) return null;

  return (
    <section>
      {(title || seeAllHref) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>}
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {seeAllLabel}
            </Link>
          )}
        </div>
      )}
      <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g.groupId}>
            <GroupCard
              href={groupPath(g.groupId)}
              name={g.name}
              visibility={g.visibility}
              memberCount={g.memberCount}
              avatarUrl={g.avatarUrl}
              cityLabel={cityLabel}
              homeCourtName={g.homeCourtId ? courtNames?.[g.homeCourtId] : undefined}
              description={g.description}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GroupsRail;
