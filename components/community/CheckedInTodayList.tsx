/**
 * CheckedInTodayList — the "N checked in today" row on the court detail header
 * (design 4.5). Presentational + server-renderable; NO live polling (§6.2 — a
 * durable day-bucketed count, not real-time presence).
 *
 * Privacy (§6.2, CLAUDE.md/HIG): a `CheckinItem` deliberately carries no identity,
 * so anonymous AND identified check-ins render as neutral avatars — anonymous ones
 * are announced as "A player", and we never surface identity here.
 */

import type { JSX } from "react";
import type { CheckinItem } from "@/lib/db/types";

const MAX_AVATARS = 5;

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function label(c: CheckinItem): string {
  const who = c.anonymous ? "A player" : "Player";
  const time = formatTime(c.createdAt);
  return time ? `${who} · checked in at ${time}` : who;
}

function AvatarDot({ anonymous }: { anonymous: boolean }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 items-center justify-center rounded-full ring-2 ring-surface ${
        anonymous ? "bg-surface-secondary text-muted" : "bg-accent/15 text-accent"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
      </svg>
    </span>
  );
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
              <AvatarDot anonymous={c.anonymous} />
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
