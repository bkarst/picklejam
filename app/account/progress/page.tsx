"use client";

/**
 * My Progress (/account/progress) — the gamification hub (§G12.6). noindex inherited
 * from the /account layout. The level header band + weekly quests + the "vs. your past
 * self" personal-stats panel + the recent-activity ledger (the economy's public audit
 * trail — every entry, including revocations) + the badge shelf.
 */

import { useEffect, type JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { trackEvent } from "@/lib/analytics/client";
import { useMyGamify, useMyLedger, useMyBadges } from "@/lib/api/gamify";
import { LevelRing } from "@/components/gamify/LevelRing";
import { StreakChip } from "@/components/gamify/StreakChip";
import { RpDelta } from "@/components/gamify/RpDelta";
import { BadgeTile } from "@/components/gamify/BadgeTile";
import { MonthStatsPanel } from "@/components/gamify/MonthStatsPanel";
import { QuestRow } from "@/components/gamify/QuestRow";
import { QUEST_ICON } from "@/components/account/GamifyQuestsModule";
import { gamifyCopy } from "@/lib/gamify/copy";
import type { XpLedgerItem } from "@/lib/db/types";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ProgressPage(): JSX.Element {
  const { data: me, isLoading } = useMyGamify();
  const ledger = useMyLedger();
  const badges = useMyBadges();

  useEffect(() => {
    trackEvent("progress_viewed");
  }, []);

  useEffect(() => {
    if (me?.quests && me.quests.length > 0) trackEvent("quest_viewed");
  }, [me?.quests]);

  if (isLoading || !me) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const p = me.profile;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Progress</h1>

      {!me.enabled && (
        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
          Rally Points are hidden. You&rsquo;re still earning them — turn the display back on in{" "}
          <Link href="/account/settings" className="text-accent hover:underline">
            Settings
          </Link>
          .
        </div>
      )}

      {p ? (
        <>
          {/* Header band */}
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:gap-6">
            <LevelRing level={p.level} progress={p.progress} size={96} isMax={p.isMaxLevel} />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="font-display text-xl font-bold text-foreground">
                Level {p.level} · {p.levelName}
              </p>
              <p className="text-sm text-muted">{p.rpLifetime.toLocaleString()} lifetime Rally Points</p>
              <p className="mt-1 text-sm text-foreground">
                {p.isMaxLevel ? (
                  "Top level reached — legend status."
                ) : (
                  <>
                    <span className="font-semibold">{p.rpToNext?.toLocaleString()} RP</span> to Level {p.level + 1}
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0">
              <StreakChip weeks={p.streakWeeks} best={p.streakBest} rainChecks={p.rainChecks} />
            </div>
          </section>

          {/* This week's quests (§G12.6 item 2). */}
          {me.quests && me.quests.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-lg font-bold text-foreground">This week&rsquo;s quests</h2>
              {me.quests.every((q) => q.completed) ? (
                <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                  {gamifyCopy.questsAllDone}
                </p>
              ) : (
                <div className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
                  {me.quests.map((q) => (
                    <QuestRow
                      key={q.questId}
                      title={q.title}
                      count={q.count}
                      target={q.target}
                      rewardRp={q.rewardRp}
                      done={q.completed}
                      icon={QUEST_ICON[q.slug]}
                    />
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-muted">New quests every Monday.</p>
            </section>
          )}

          {/* Personal stats — "vs. your past self" (§G12.6 item 3). */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">This month vs last</h2>
            <MonthStatsPanel />
          </section>

          {/* Badge shelf — earned first, nearest-to-next after (§G12.6 item 5). */}
          {badges.data && badges.data.entries.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Badges</h2>
                <Link href="/account/badges" className="text-sm font-semibold text-accent hover:underline">
                  All badges →
                </Link>
              </div>
              <div className="flex flex-wrap gap-3">
                {[...badges.data.entries]
                  .sort((a, b) => (b.tier > 0 ? 1 : 0) - (a.tier > 0 ? 1 : 0))
                  .slice(0, 6)
                  .map((e) => (
                    <BadgeTile
                      key={e.familyId}
                      name={e.name}
                      tier={e.tier}
                      tierName={e.tierName}
                      earned={e.tier > 0}
                      progress={e.progress ? { count: e.progress.count, target: e.progress.nextThreshold } : undefined}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Recent activity — the audit trail (every entry, incl. revocations). */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">Recent activity</h2>
            {ledger.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                  {ledger.data?.pages.flatMap((pg) => pg.items).map((row: XpLedgerItem) => (
                    <li key={row.sk} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                        <p className="text-xs text-muted">{timeAgo(row.ts)}</p>
                      </div>
                      <RpDelta points={row.points} className="shrink-0 text-sm" />
                    </li>
                  ))}
                </ul>
                {ledger.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => void ledger.fetchNextPage()}
                    disabled={ledger.isFetchingNextPage}
                    className="mt-3 inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60"
                  >
                    {ledger.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p>
            Rally Points are earned by playing, reviewing, and organizing. Check in at a court to start
            climbing the levels.
          </p>
          <Link
            href="/courts"
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Find courts
          </Link>
        </div>
      )}
    </div>
  );
}
