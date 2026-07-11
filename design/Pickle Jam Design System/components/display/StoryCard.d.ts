import React from "react";
export interface StoryCardProps {
  badge?: React.ReactNode;
  badgeVariant?: "pink" | "lime" | "ink" | "cream";
  title?: React.ReactNode;
  excerpt?: React.ReactNode;
  meta?: React.ReactNode;
  /** Image URL for the media area. */
  image?: string;
  /** Custom media node (overrides image). */
  media?: React.ReactNode;
  variant?: "flat" | "sticker";
  onClick?: (e: React.MouseEvent) => void;
}
/**
 * News / highlight story card (media + badge + headline).
 * @startingPoint section="Content" subtitle="Editorial story card with media, badge and headline" viewport="380x360"
 */
export function StoryCard(props: StoryCardProps): JSX.Element;
