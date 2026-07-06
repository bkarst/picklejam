"use client";

/**
 * GamifyMenuRow — the account-menu progress row (§G12.15). One deliberate insertion in
 * the dropdown (HIG deference — no persistent header counter): a 24px ring + `Lv N ·
 * X RP` linking to /account/progress. Absent when prefs off / holdout / no profile.
 */

import Link from "next/link";
import { useMyGamify } from "@/lib/api/gamify";
import { LevelRing } from "@/components/gamify/LevelRing";

export function GamifyMenuRow({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me } = useMyGamify();
  if (!me || !me.enabled || !me.profile) return null;
  const p = me.profile;
  return (
    <Link
      href="/account/progress"
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <LevelRing level={p.level} progress={p.progress} size={24} isMax={p.isMaxLevel} />
      <span className="text-sm font-medium text-foreground">
        Lv {p.level} · {p.rp.toLocaleString()} RP
      </span>
    </Link>
  );
}
