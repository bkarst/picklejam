import React from "react";

export interface ButtonProps {
  children?: React.ReactNode;
  /** Visual style. @default "primary" */
  variant?: "primary" | "accent" | "ink" | "outline" | "ghost";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  /** Stretch to container width. */
  full?: boolean;
  /** Render as another element, e.g. "a". @default "button" */
  as?: "button" | "a";
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
}

/**
 * Chunky uppercase call-to-action button.
 * @startingPoint section="Forms" subtitle="Primary / accent / ink CTA buttons" viewport="700x200"
 */
export function Button(props: ButtonProps): JSX.Element;
