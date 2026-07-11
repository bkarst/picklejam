import React from "react";
export interface TagProps {
  children?: React.ReactNode;
  /** Selected/active state (filled dark green). */
  active?: boolean;
  iconLeft?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}
/** Pill category / filter chip. */
export function Tag(props: TagProps): JSX.Element;
