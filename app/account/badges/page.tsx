"use client";

/**
 * Badge Collection (/account/badges) — the catalog grouped by family (§G12.7). noindex
 * inherited from the /account layout. Every tile shows its earned tier or locked-with-
 * progress (endowed progress). Tapping an EARNED tile pins/unpins it to the public
 * showcase (max 3, optimistic). CSR; loading = Skeleton.
 */

import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useMyBadges, usePinShowcase } from "@/lib/api/gamify";
import { BadgeTile } from "@/components/gamify/BadgeTile";
import type { BadgeCollectionEntry } from "@/lib/gamify/view";

const GROUPS: { key: string; label: string }[] = [
  { key: "B1", label: "Explore & play" },
  { key: "B2", label: "Contribute" },
  { key: "B3", label: "Compete" },
  { key: "B4", label: "Organize & socialize" },
  { key: "habit", label: "Habit" },
];

export default function BadgesPage(): JSX.Element {
  const { data, isLoading } = useMyBadges();
  const pin = usePinShowcase();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40 rounded-lg" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const showcase = new Set(data.showcase);
  const togglePin = (familyId: string, earned: boolean) => {
    if (!earned) return;
    const next = showcase.has(familyId)
      ? data.showcase.filter((id) => id !== familyId)
      : [...data.showcase, familyId].slice(0, 3);
    pin.mutate(next);
  };

  const byGroup = (key: string) => data.entries.filter((e) => e.behavior === key);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Badges</h1>
        <p className="mt-1 text-sm text-muted">
          {data.earnedCount} earned · pin up to 3 to your profile.{" "}
          <Link href="/account/progress" className="text-accent hover:underline">
            Back to progress
          </Link>
        </p>
      </div>

      {GROUPS.map(({ key, label }) => {
        const entries = byGroup(key);
        if (entries.length === 0) return null;
        return (
          <section key={key}>
            <h2 className="mb-3 font-display text-lg font-bold text-foreground">{label}</h2>
            <div className="flex flex-wrap gap-4">
              {entries.map((e) => (
                <BadgeButton key={e.familyId} entry={e} pinned={showcase.has(e.familyId)} onToggle={togglePin} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BadgeButton({
  entry,
  pinned,
  onToggle,
}: {
  entry: BadgeCollectionEntry;
  pinned: boolean;
  onToggle: (familyId: string, earned: boolean) => void;
}) {
  const earned = entry.tier > 0;
  return (
    <button
      type="button"
      disabled={!earned}
      onClick={() => onToggle(entry.familyId, earned)}
      aria-pressed={pinned}
      aria-label={
        earned
          ? `${entry.name}, ${entry.tierName}${pinned ? ", pinned to showcase" : ", tap to pin"}`
          : `${entry.name}, locked`
      }
      className={`relative rounded-2xl p-2 transition-colors ${earned ? "cursor-pointer hover:bg-surface-secondary" : "cursor-default"} ${pinned ? "ring-2 ring-accent" : ""}`}
    >
      <BadgeTile
        name={entry.name}
        tier={entry.tier}
        tierName={entry.tierName}
        earned={earned}
        progress={entry.progress ? { count: entry.progress.count, target: entry.progress.nextThreshold } : undefined}
      />
      {pinned && (
        <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
          Pinned
        </span>
      )}
    </button>
  );
}
