"use client";

/**
 * LevelChip — the `Lv 5 · Spin Doctor` prestige pill (§G5). The `sm` variant is
 * number-only (`Lv 5`) for dense contexts (review cards, leaderboard rows, Crew chips).
 */

import { Chip } from "@heroui/react";

export function LevelChip({
  level,
  name,
  size = "md",
  className = "",
}: {
  level: number;
  name?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const full = size !== "sm" && name;
  return (
    <Chip size="sm" variant="soft" color="accent" className={className}>
      <span className="font-semibold">Lv {level}</span>
      {full ? <span className="text-muted"> · {name}</span> : null}
    </Chip>
  );
}
