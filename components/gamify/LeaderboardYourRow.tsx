"use client";

/**
 * LeaderboardYourRow — the pinned "your row" strip under a board (§G12.3 item 4, §G12.9
 * item 3). Authed only; renders nothing signed-out or when gamification is off/holdout. When
 * the viewer already appears in the rendered top-N (their uid is in `rankedUids`) the strip
 * hides — their table row carries them. Court scope shows this-month check-in days + Crew
 * status (`useMyCourtGamify`); city scope shows this-month Rally Points (`useMyGamify`).
 */

import { Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyCourtGamify, useMyGamify } from "@/lib/api/gamify";

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/8 px-4 py-3 text-sm">
      {children}
    </div>
  );
}

export function CourtYourRow({ courtId, rankedUids }: { courtId: string; rankedUids: string[] }) {
  const { user } = useAuth();
  const me = useMyGamify({ enabled: !!user });
  const { data, isLoading } = useMyCourtGamify(courtId, { enabled: !!user });

  if (!user) return null;
  if (me.data && !me.data.enabled) return null;
  if (rankedUids.includes(user.uid)) return null; // already in the table
  if (isLoading || !data) return <Skeleton className="mt-3 h-12 w-full rounded-xl" />;

  return (
    <Strip>
      <span className="font-medium text-foreground">Your month</span>
      <span className="tabular-nums text-foreground">
        {data.monthDays} check-in {data.monthDays === 1 ? "day" : "days"}
        {data.isCrew && <span className="ml-2 text-success">· Crew ✓</span>}
      </span>
    </Strip>
  );
}

export function CityYourRow({ rankedUids }: { rankedUids: string[] }) {
  const { user } = useAuth();
  const { data, isLoading } = useMyGamify({ enabled: !!user });

  if (!user) return null;
  if (data && !data.enabled) return null;
  if (rankedUids.includes(user.uid)) return null;
  if (isLoading || !data) return <Skeleton className="mt-3 h-12 w-full rounded-xl" />;

  return (
    <Strip>
      <span className="font-medium text-foreground">Your Rally Points this month</span>
      <span className="tabular-nums font-semibold text-foreground">{(data.profile?.monthRp ?? 0).toLocaleString()}</span>
    </Strip>
  );
}
