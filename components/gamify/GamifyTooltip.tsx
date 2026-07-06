"use client";

/**
 * GamifyTooltip — the repo's reusable zero-delay tooltip (CLAUDE.md UI rule).
 *
 * HeroUI v3 `Tooltip` renders its OWN focusable pressable, so the trigger content goes
 * directly inside `Tooltip.Trigger` (never a nested <button>, which would swallow hover).
 * `delay={0} closeDelay={0}` is mandatory (the 1500ms default reads as broken).
 */

import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";

export function GamifyTooltip({
  content,
  children,
  className,
  ariaLabel,
}: {
  content: ReactNode;
  children: ReactNode;
  /** Sizing / cursor / color for the trigger itself. */
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Tooltip delay={0} closeDelay={0}>
      <Tooltip.Trigger className={className} aria-label={ariaLabel}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content>
        {content}
        <Tooltip.Arrow />
      </Tooltip.Content>
    </Tooltip>
  );
}
