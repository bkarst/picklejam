/**
 * GroupAvatar — the one image used to represent a group/club everywhere it appears
 * (finder cards, rails, the detail + manage headers). Server-renderable.
 *
 * Groups read as an org/club, so the frame is a rounded SQUARE (a squircle), not a
 * person's circle. When the group has no photo we fall back to the same
 * `PeopleIcon` bubble the cards used before — so an image simply upgrades the
 * existing placeholder in place. Size/ring styling comes from `className` (default
 * `size-10`); the icon scales to half the frame.
 */

import type { JSX } from "react";

export interface GroupAvatarProps {
  name: string;
  /** The group's photo URL ("" / undefined → people-icon fallback). */
  avatarUrl?: string;
  /** Tailwind size + extra classes for the square frame (default `size-10`). */
  className?: string;
}

export function GroupAvatar({ name, avatarUrl, className = "size-10" }: GroupAvatarProps): JSX.Element {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ${className}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="size-full object-cover" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-1/2 w-1/2 text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )}
    </span>
  );
}

export default GroupAvatar;
