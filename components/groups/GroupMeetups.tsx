"use client";

/**
 * GroupMeetups — the "Upcoming meet-ups" section, MEMBERS-ONLY (§6.9).
 *
 * A group's meet-up place & time are private to members. The server shell is cached
 * + shared and can't identify the viewer, so this loads client-side via the
 * authenticated {@link useGroup} (which returns meet-ups only to active members):
 *   • member     → the real schedule (OutingCards with court + date/time)
 *   • non-member → a "join to see" prompt, never the place or time
 * Renders in the main column of the group detail page.
 */

import type { JSX } from "react";
import { Skeleton } from "@heroui/react";
import { useGroup } from "@/lib/api/groups";
import { OutingCard } from "@/components/outings/OutingCard";

export function GroupMeetups({ groupId }: { groupId: string }): JSX.Element {
  const { data, isLoading } = useGroup(groupId);
  const isMember = data?.membership?.status === "active";

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-bold text-foreground">Upcoming meet-ups</h2>
      <p className="mt-1 text-sm text-muted">Group games scheduled at your courts.</p>

      {isLoading ? (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : !isMember ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted">
            Meet-up times and locations are visible to members. Join the group to see the schedule.
          </p>
        </div>
      ) : data!.meetups.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-sm text-muted">
          No meet-ups scheduled yet. Owners and admins can schedule one from the manage console.
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {data!.meetups.map((m) => {
            const c = m.courtId ? data!.courts?.[m.courtId] : undefined;
            return (
              <li key={m.outingId}>
                <OutingCard outing={m} court={c ? { name: c.name, href: c.url } : null} showDate />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default GroupMeetups;
