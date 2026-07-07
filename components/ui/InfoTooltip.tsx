"use client";

/**
 * InfoTooltip — a small ⓘ affordance that reveals explanatory text on hover/focus.
 *
 * Built on HeroUI v3 Tooltip per the CLAUDE.md rules: the icon sits DIRECTLY inside
 * `Tooltip.Trigger` (never a nested <button>, which already renders its own pressable
 * and would swallow the hover), and `delay={0} closeDelay={0}` are mandatory (the
 * 1500ms default reads as broken). Meaning is carried by the tooltip text + the
 * trigger `aria-label`, never the icon shape alone.
 */

import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

export function InfoTooltip({
  content,
  label = "More information",
  className = "",
}: {
  content: ReactNode;
  /** Accessible name for the trigger — the visible tooltip text explains the rest. */
  label?: string;
  /** Extra sizing/color for the trigger itself. */
  className?: string;
}) {
  return (
    <Tooltip delay={0} closeDelay={0}>
      <Tooltip.Trigger
        aria-label={label}
        className={`inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="6.75" />
          <path d="M8 7.25v3.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.85" fill="currentColor" stroke="none" />
        </svg>
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-xs text-left text-sm leading-snug">
        {content}
        <Tooltip.Arrow />
      </Tooltip.Content>
    </Tooltip>
  );
}
