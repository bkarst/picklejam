import React from "react";
export interface CardProps {
  children?: React.ReactNode;
  /** "flat" soft shadow, "sticker" dark outline + offset shadow, "ink" dark fill. */
  variant?: "flat" | "sticker" | "ink";
  /** Inner padding in px. @default 20 */
  pad?: number;
  style?: React.CSSProperties;
}
/** Rounded content surface. */
export function Card(props: CardProps): JSX.Element;
