/**
 * CrewChip — a Court Crew member (§G7.1 / §G12.0 kit): avatar + name + `LevelChip sm`,
 * linked to the public profile. Server-renderable (the court page uses it directly); the
 * whole chip is one ≥44px tap target with a hover state. A missing username (shouldn't
 * happen for public members) degrades to an unlinked chip.
 */

import Link from "next/link";
import { LevelChip } from "./LevelChip";
import { GamifyAvatar } from "./GamifyAvatar";

export function CrewChip({
  username,
  displayName,
  avatarUrl,
  level,
}: {
  username?: string;
  displayName: string;
  avatarUrl?: string;
  level: number;
}) {
  const inner = (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-secondary py-1 pl-1 pr-3 transition-colors group-hover:bg-surface-tertiary">
      <GamifyAvatar name={displayName} avatarUrl={avatarUrl} className="size-8 shrink-0 text-xs" />
      <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">{displayName}</span>
      <LevelChip level={level} size="sm" />
    </span>
  );

  if (!username) return inner;
  return (
    <Link href={`/players/${username}`} className="group inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${displayName}, level ${level}`}>
      {inner}
    </Link>
  );
}
