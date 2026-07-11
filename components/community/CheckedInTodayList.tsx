/**
 * CheckedInTodayList — the "N checked in today" row on the court detail header
 * (design 4.5). Presentational + server-renderable; NO live polling (§6.2 — a
 * durable day-bucketed count, not real-time presence).
 *
 * Privacy (§6.2, CLAUDE.md/HIG): check-ins are anonymous — we never surface identity
 * here, for anonymous OR signed-in check-ins alike. The only per-player fact shown is
 * the skill rating declared on the check-in (when given), rendered inside the avatar
 * dot; without one the dot is a neutral person glyph announced as "A player".
 */

import type { JSX } from "react";
import { AnonPlayerDot, anonPlayerLabel } from "@/components/gamify/AnonPlayer";
import type { CheckinItem } from "@/lib/db/types";

const MAX_AVATARS = 5;

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function label(c: CheckinItem): string {
  const who = anonPlayerLabel(c.skill);
  const time = formatTime(c.createdAt);
  return time ? `${who} · checked in at ${time}` : who;
}

export function CheckedInTodayList({
  checkins,
  count,
}: {
  checkins: CheckinItem[];
  count: number;
}): JSX.Element {
  if (count <= 0) {
    return (
      <p className="text-sm text-muted">Be the first to check in today.</p>
    );
  }

  const shown = checkins.slice(0, MAX_AVATARS);
  const overflow = count - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-sm">
        <span className="font-semibold text-foreground">{count}</span>{" "}
        <span className="text-muted">checked in today</span>
      </p>

      {shown.length > 0 && (
        <ul className="flex items-center -space-x-2" aria-label="Recent check-ins">
          {shown.map((c) => (
            <li key={c.sk || `${c.courtId}-${c.createdAt}`} title={label(c)}>
              <AnonPlayerDot rating={c.skill} className="size-8 text-[11px] ring-2 ring-surface" />
              <span className="sr-only">{label(c)}</span>
            </li>
          ))}
          {overflow > 0 && (
            <li>
              <span className="flex size-8 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted ring-2 ring-surface">
                +{overflow}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
