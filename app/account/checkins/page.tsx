"use client";

/**
 * My Check-ins (/account/checkins) — the caller's check-in history (§6.2), newest
 * first, with a few frequency stats and a re-check-in shortcut back to the court.
 * noindex is inherited from the /account layout. Loading = Skeleton; empty state
 * points people at the court directory.
 */

import type { JSX } from "react";
import Link from "next/link";
import { Chip, Skeleton } from "@heroui/react";
import { useMyCheckins } from "@/lib/api/account-lists";
import type { CheckinItem } from "@/lib/db/types";

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-surface p-4">
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default function MyCheckinsPage(): JSX.Element {
  const { data, isLoading } = useMyCheckins();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 flex-1 rounded-xl" />
          ))}
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const { checkins, courts } = data;
  const distinctCourts = new Set(checkins.map((c) => c.courtId)).size;
  const distinctDays = new Set(checkins.map((c) => c.checkinDay)).size;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">My check-ins</h1>

      {checkins.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p>You haven&apos;t checked in anywhere yet. Check in when you play to build your history.</p>
          <Link
            href="/courts"
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Find courts
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <StatTile value={checkins.length} label="Check-ins" />
            <StatTile value={distinctCourts} label="Courts" />
            <StatTile value={distinctDays} label="Days played" />
          </div>

          <ul className="flex flex-col gap-3">
            {checkins.map((c: CheckinItem) => {
              const court = courts[c.courtId];
              return (
                <li
                  key={c.sk}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {court ? (
                        <Link href={court.url} className="text-accent hover:underline">
                          {court.name}
                        </Link>
                      ) : (
                        "A court"
                      )}
                    </p>
                    <p className="text-sm text-muted">{formatDateTime(c.createdAt)}</p>
                    {c.note && <p className="mt-1 text-sm text-foreground/90">{c.note}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.skill !== undefined && (
                        <Chip size="sm" variant="soft" color="success">
                          Skill {c.skill.toFixed(1)}
                        </Chip>
                      )}
                      {c.lookingToPlay && (
                        <Chip size="sm" variant="soft" color="success">
                          Looking to play
                        </Chip>
                      )}
                      {c.anonymous && (
                        <Chip size="sm" className="bg-surface-secondary text-muted">
                          Anonymous
                        </Chip>
                      )}
                    </div>
                  </div>
                  {court && (
                    <Link
                      href={court.url}
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      Check in again
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
