import React from "react";
export interface BadgeProps {
  children?: React.ReactNode;
  variant?: "pink" | "lime" | "ink" | "cream";
  size?: "sm" | "md";
  /** Show a leading status dot (e.g. LIVE). */
  dot?: boolean;
}
/** Uppercase status pill. */
export function Badge(props: BadgeProps): JSX.Element;
