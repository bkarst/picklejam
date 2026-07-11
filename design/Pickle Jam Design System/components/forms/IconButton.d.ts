import React from "react";
export interface IconButtonProps {
  children?: React.ReactNode;
  variant?: "ink" | "lime" | "pink" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  round?: boolean;
  /** Accessible label (also the tooltip). */
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}
/** Icon-only button (search, menu, notifications). */
export function IconButton(props: IconButtonProps): JSX.Element;
