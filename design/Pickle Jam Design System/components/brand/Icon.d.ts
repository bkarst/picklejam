import React from "react";
export type IconName =
  | "search" | "menu" | "bell" | "arrow-right" | "chevron-right" | "play"
  | "trophy" | "users" | "calendar" | "trending-up" | "map-pin" | "mic"
  | "camera" | "message-circle" | "sparkles" | "newspaper" | "heart"
  | "share" | "clock" | "check" | "plus" | "x" | "star";
export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}
/** Outlined line icon (Lucide path set). Inherits currentColor. */
export function Icon(props: IconProps): JSX.Element;
