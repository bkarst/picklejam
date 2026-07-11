import React from "react";
export interface SectionHeadingProps {
  /** Small pink eyebrow above the title. */
  overline?: React.ReactNode;
  title?: React.ReactNode;
  /** Trailing element (e.g. a "See all" button). */
  action?: React.ReactNode;
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
}
/** Overline + Archivo-Black section title. */
export function SectionHeading(props: SectionHeadingProps): JSX.Element;
