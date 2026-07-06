"use client";

/**
 * GamifySettingsSection — the "Gamification" settings group (§G12.12), placed between
 * Privacy and Sign-in & security. Four optimistic Switch rows (the mutation updates the
 * `me` cache in place, reverting on error). The leaderboards toggle is disabled with an
 * explanation for private profiles (§6.3 precedence). Absent until prefs load.
 */

import type { ReactNode } from "react";
import { Switch } from "@heroui/react";
import { useMyGamify, useUpdateGamifyPrefs } from "@/lib/api/gamify";
import { trackEvent } from "@/lib/analytics/client";
import { gamifyCopy } from "@/lib/gamify/copy";
import { GamifyTooltip } from "@/components/gamify/GamifyTooltip";
import type { GamifyPrefs } from "@/lib/db/types";

function Row({ title, description, control }: { title: string; description: string; control: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

function PrefSwitch({
  label,
  isSelected,
  isDisabled,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch aria-label={label} isSelected={isSelected} isDisabled={isDisabled} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

export function GamifySettingsSection({ isPrivate }: { isPrivate: boolean }) {
  const { data: me } = useMyGamify();
  const update = useUpdateGamifyPrefs();
  const prefs = me?.prefs;
  if (!prefs) return null;

  const set = (patch: Partial<GamifyPrefs>) => update.mutate(patch);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-display text-base font-bold text-foreground">Gamification</h2>
      <div className="mt-2">
        <Row
          title="Show Rally Points & badges"
          description={gamifyCopy.gamificationOffHelper}
          control={
            <PrefSwitch
              label="Show Rally Points and badges"
              isSelected={prefs.enabled}
              onChange={(v) => {
                set({ enabled: v });
                // The G2.4 opt-in health metric (tracked against the < 3% gate, §G15).
                trackEvent(v ? "gamification_enabled" : "gamification_disabled");
              }}
            />
          }
        />
        <Row
          title="Appear on leaderboards"
          description="Show up on court, city, and group leaderboards."
          control={
            isPrivate ? (
              <div className="flex items-center gap-1.5">
                <PrefSwitch label="Appear on leaderboards" isSelected={false} isDisabled onChange={() => {}} />
                <GamifyTooltip
                  content={<span className="text-xs">Private profiles never appear on leaderboards.</span>}
                  ariaLabel="Why this is disabled"
                  className="cursor-help text-muted"
                >
                  <span aria-hidden="true">ⓘ</span>
                </GamifyTooltip>
              </div>
            ) : (
              <PrefSwitch
                label="Appear on leaderboards"
                isSelected={prefs.leaderboards === "public"}
                onChange={(v) => set({ leaderboards: v ? "public" : "hidden" })}
              />
            )
          }
        />
        <Row
          title="Streak reminders"
          description="A midweek nudge if you haven't played yet this week. Off by default."
          control={
            <PrefSwitch label="Streak reminders" isSelected={prefs.streakReminders} onChange={(v) => set({ streakReminders: v })} />
          }
        />
        <Row
          title="Weekly digest email"
          description="A Sunday recap of your Rally Points, streak, and quests."
          control={<PrefSwitch label="Weekly digest email" isSelected={prefs.digest} onChange={(v) => set({ digest: v })} />}
        />
      </div>
    </section>
  );
}
