"use client";

/**
 * CrewProgressIsland — the authed viewer's Crew progress at a court (§G12.1-I2b). Shows
 * `You're Crew here ✓` once Crew, else `N of 4 check-ins this month` with a progress bar,
 * from `useMyCourtGamify(courtId)`. Renders nothing signed-out (the server empty state
 * already explains the mechanic) and nothing when gamification is off/holdout. Skeleton is
 * a single 24px bar while the tally loads.
 */

import { Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyCourtGamify } from "@/lib/api/gamify";
import { useMyGamify } from "@/lib/api/gamify";

const CREW_TARGET = 4;

export function CrewProgressIsland({ courtId }: { courtId: string }) {
  const { user } = useAuth();
  const me = useMyGamify({ enabled: !!user });
  const { data, isLoading } = useMyCourtGamify(courtId, { enabled: !!user });

  if (!user) return null; // signed-out → the server empty state carries the mechanic
  if (me.data && !me.data.enabled) return null; // gamification off / holdout ⇒ zero UI

  if (isLoading || !data) {
    return <Skeleton className="mt-3 h-6 w-56 rounded-full" />;
  }

  if (data.isCrew) {
    return (
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-sm font-medium text-success">
        <span aria-hidden="true">✓</span> You&apos;re Crew here
      </p>
    );
  }

  const remaining = Math.max(0, CREW_TARGET - data.monthDays);
  const pct = Math.min(1, data.monthDays / CREW_TARGET);
  return (
    <div className="mt-3 max-w-sm">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-foreground">{data.monthDays} of {CREW_TARGET} check-ins this month</span>
        <span className="text-muted">{remaining} to Crew</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={data.monthDays}
        aria-valuemin={0}
        aria-valuemax={CREW_TARGET}
        aria-label={`${data.monthDays} of ${CREW_TARGET} check-ins toward Crew`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
