/**
 * GamifyAvatar — the one avatar used across every gamification surface (Crew chips, board
 * tables, leaderboard teasers, captain history, the Elite cohort). Wraps HeroUI `Avatar` with
 * a consistent word-initials fallback ("Ada Rivera" → "AR") so a user's avatar looks the same
 * everywhere — previously each surface hand-rolled its own block with a different initials rule
 * ("AD" vs "AR" vs "V"). Server-renderable; pass `className` for sizing / extra ring styling.
 */

import { Avatar } from "@heroui/react";

/** First letter of each of the first two words (e.g. "Ada Rivera" → "AR"). */
export function nameInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

export function GamifyAvatar({ name, avatarUrl, className = "" }: { name: string; avatarUrl?: string; className?: string }) {
  return (
    <Avatar className={className}>
      {avatarUrl && <Avatar.Image src={avatarUrl} alt={name} />}
      <Avatar.Fallback className="bg-accent text-accent-foreground">{nameInitials(name)}</Avatar.Fallback>
    </Avatar>
  );
}
