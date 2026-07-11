import React from "react";
export interface AvatarProps {
  src?: string;
  /** Used for alt text and initials fallback. */
  name?: string;
  size?: number;
  /** Dark-green ring. @default true */
  ring?: boolean;
}
/** Circular player avatar (image or initials). */
export function Avatar(props: AvatarProps): JSX.Element;
