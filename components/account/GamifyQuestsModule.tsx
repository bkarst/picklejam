"use client";

/**
 * GamifyQuestsModule — the "This week's quests" dashboard card (§G12.5-I2), second slot.
 * Returns null when suppressed or before quests exist. Shows up to 3 compact QuestRows;
 * the all-done state reassures rather than nags (§G2.4). Community quests are P3.
 */

import Link from "next/link";
import type { JSX } from "react";
import { Skeleton } from "@heroui/react";
import { useMyGamify } from "@/lib/api/gamify";
import { QuestRow } from "@/components/gamify/QuestRow";
import { gamifyCopy } from "@/lib/gamify/copy";

export const QUEST_ICON: Record<string, string> = {
  checkin3: "📍",
  twocourts: "🗺️",
  lookingtoplay: "👋",
  review1: "📝",
  photo1: "📷",
  helpful1: "👍",
  rsvp1: "📅",
  follow1: "❤️",
  match1: "🏓",
  host1: "📣",
};

export function GamifyQuestsModule(): JSX.Element | null {
  const { data: me, isLoading } = useMyGamify();

  if (isLoading) return <Skeleton className="h-36 w-full rounded-2xl" />;
  if (!me || !me.enabled || !me.quests || me.quests.length === 0) return null;

  const quests = me.quests;
  const allDone = quests.every((q) => q.completed);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-foreground">This week&rsquo;s quests</h2>
        <Link href="/account/progress" className="shrink-0 text-sm font-semibold text-accent hover:underline">
          View →
        </Link>
      </div>
      {allDone ? (
        <p className="py-5 text-center text-sm text-muted">{gamifyCopy.questsAllDone}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {quests.map((q) => (
            <QuestRow
              key={q.questId}
              title={q.title}
              count={q.count}
              target={q.target}
              rewardRp={q.rewardRp}
              done={q.completed}
              icon={QUEST_ICON[q.slug]}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
