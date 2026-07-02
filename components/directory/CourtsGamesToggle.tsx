"use client";

/**
 * CourtsGamesToggle — the "Courts / Games" segmented switch on the city view
 * (4.3). A HeroUI ToggleButtonGroup (single-select) per CLAUDE.md. Courts is the
 * default; choosing Games navigates to the city game-finder (Stage 4).
 *
 * When `gamesHref` is absent, Games is a disabled "Coming soon" affordance. Per
 * the CLAUDE.md Tooltip rule we put the label DIRECTLY inside `Tooltip.Trigger`
 * (which renders its own focusable pressable) — no nested <button> — and set
 * `delay={0} closeDelay={0}`.
 */

import type { CSSProperties, JSX } from "react";
import { useRouter } from "next/navigation";
import { ToggleButtonGroup, ToggleButton, Tooltip } from "@heroui/react";

// Make the selected pill a solid Forest fill (design 4.3) instead of the default
// soft tint, by overriding HeroUI's ToggleButton selected-state tokens.
const SOLID_SELECTED = {
  "--toggle-button-bg-selected": "var(--accent)",
  "--toggle-button-fg-selected": "var(--accent-foreground)",
  "--toggle-button-bg-selected-hover": "var(--accent)",
  "--toggle-button-bg-selected-pressed": "var(--accent)",
} as CSSProperties;

const PILL = "h-9 rounded-full px-5";

export function CourtsGamesToggle({
  mode = "courts",
  gamesHref,
}: {
  mode?: "courts" | "games";
  gamesHref?: string;
}): JSX.Element {
  const router = useRouter();
  const selected = mode ?? "courts";

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-surface p-1">
      {gamesHref ? (
        <ToggleButtonGroup
          aria-label="Show courts or games"
          selectionMode="single"
          disallowEmptySelection
          isDetached
          selectedKeys={new Set([selected])}
          onSelectionChange={(keys) => {
            if (keys.has("games")) router.push(gamesHref);
          }}
          className="gap-1"
          style={SOLID_SELECTED}
        >
          <ToggleButton id="courts" className={PILL}>
            Courts
          </ToggleButton>
          <ToggleButton id="games" className={PILL}>
            Games
          </ToggleButton>
        </ToggleButtonGroup>
      ) : (
        <div role="group" aria-label="Show courts or games" className="flex items-center gap-1">
          <span
            aria-current="true"
            className={`inline-flex items-center justify-center bg-accent text-sm font-medium text-accent-foreground ${PILL}`}
          >
            Courts
          </span>
          <Tooltip delay={0} closeDelay={0}>
            <Tooltip.Trigger
              aria-label="Games — coming soon"
              aria-disabled="true"
              className={`inline-flex cursor-not-allowed items-center justify-center text-sm font-medium text-muted opacity-70 ${PILL}`}
            >
              Games
            </Tooltip.Trigger>
            <Tooltip.Content>
              Coming soon
              <Tooltip.Arrow />
            </Tooltip.Content>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
