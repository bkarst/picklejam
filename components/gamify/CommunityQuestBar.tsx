"use client";

/**
 * CommunityQuestBar — the city-directory community-quest module (§G12.8-I1). The heading +
 * goal copy render from server props (so JS-off shows the quest, not a blank), while the
 * live `progress` value hydrates from `useCommunityQuest` (the city page is ISR-daily — the
 * bar must never be a day stale). The viewer's own contribution shows when authed. Reversible
 * to nothing when no quest is live (the parent renders it only then).
 */

import { useAuth } from "@/components/auth/AuthProvider";
import { useCommunityQuest, type CommunityQuestView } from "@/lib/api/gamify";
import { monthName } from "@/lib/gamify/time";

export function CommunityQuestBar({
  questId,
  month,
  title,
  goal,
  initialProgress,
}: {
  questId: string;
  /** `yyyymm` — for the "June community quest" heading. */
  month: string;
  /** The goal copy, e.g. "500 check-ins in Wichita". */
  title: string;
  goal: number;
  initialProgress: number;
}) {
  const { user } = useAuth();
  const initialData: CommunityQuestView = { questId, title, goal, progress: initialProgress, status: "active" };
  const { data } = useCommunityQuest(questId, { initialData });

  const progress = data?.progress ?? initialProgress;
  const pct = goal > 0 ? Math.min(1, progress / goal) : 0;
  const myContribution = data?.myContribution;

  return (
    <section aria-labelledby="community-quest-heading" className="rounded-2xl border border-accent/30 bg-accent/8 p-4">
      <h2 id="community-quest-heading" className="font-display text-base font-bold text-foreground">
        {monthName(month)} community quest
      </h2>
      <p className="mt-1 text-sm text-foreground">{title}</p>

      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label={`${progress} of ${goal}`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold tabular-nums text-foreground">{progress.toLocaleString()} / {goal.toLocaleString()}</span>
        {user && myContribution !== undefined && myContribution > 0 && (
          <span className="text-muted">Your contributions: {myContribution}</span>
        )}
      </div>
    </section>
  );
}
