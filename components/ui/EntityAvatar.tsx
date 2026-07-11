/**
 * EntityAvatar — the shared image used to represent an org-style entity (leagues,
 * tournaments, ladders) everywhere it appears: finder cards, detail + organizer
 * headers, the Discover finder. Server-renderable.
 *
 * These read as an org/event, so the frame is a rounded SQUARE (a squircle). When
 * there's no photo we fall back to the caller's `fallback` icon (each entity keeps
 * its own glyph), rendered in the same `bg-primary/10` bubble the cards used
 * before — so an image simply upgrades the existing placeholder in place. Size /
 * ring styling comes from `className` (default `size-10`).
 *
 * `GroupAvatar` is the group-branded sibling (fixed people-icon fallback).
 */

import type { JSX, ReactNode } from "react";

export interface EntityAvatarProps {
  name: string;
  /** The entity's photo URL ("" / undefined → the `fallback` icon). */
  avatarUrl?: string;
  /** Icon shown when there's no photo (e.g. the card's existing glyph). */
  fallback: ReactNode;
  /** Tailwind size + extra classes for the square frame (default `size-10`). */
  className?: string;
}

export function EntityAvatar({ name, avatarUrl, fallback, className = "size-10" }: EntityAvatarProps): JSX.Element {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ${className}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="size-full object-cover" />
      ) : (
        fallback
      )}
    </span>
  );
}

export default EntityAvatar;
