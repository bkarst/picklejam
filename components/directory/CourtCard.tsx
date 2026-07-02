/**
 * CourtCard — the primary court "venue" card used across the directory
 * (city listing 4.3, nearby-courts rail 4.5). A plain-div card (no HeroUI Card,
 * per CLAUDE.md) that composes the brand pieces: photo (or a branded gradient
 * placeholder with the ball mark), an optional rank badge, the court name link,
 * a stat line, derived amenity Chips, a RatingBadge, and a save-heart.
 *
 * Server component; the only interactive island is <SaveHeartButton> (client).
 * The whole card is reachable from the keyboard via the name Link.
 */

import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { Chip } from "@heroui/react";
import type { CourtItem } from "@/lib/db/types";
import { courtUrl } from "@/lib/urls";
import { RatingBadge } from "./RatingBadge";
import { SaveHeartButton } from "./SaveHeartButton";

/** Small location-pin glyph for the stat line (decorative). */
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** The pickleball mark, used as the photo placeholder (brand board). */
function BallMark({ className }: { className?: string }) {
  const holes: [number, number, number][] = [
    [16, 8, 2.1],
    [22.5, 12, 1.9],
    [22, 19, 1.9],
    [15.5, 22, 2.1],
    [9.5, 18.5, 1.8],
    [10.5, 11.5, 1.8],
  ];
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" className="fill-brand-lime stroke-accent" strokeWidth="2.5" />
      {holes.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} className="fill-background" />
      ))}
    </svg>
  );
}

const ACCESS_LABEL = {
  free: "Free",
  membership: "Membership",
  "one-time": "One-time",
  reservation: "Reservation",
} as const;

const FACILITY_LABEL = {
  public: "Public",
  club: "Club",
  school: "School",
  private: "Private",
} as const;

type Tone = "green" | "pink";
interface Tag {
  label: string;
  tone: Tone;
}

function deriveTags(court: CourtItem): Tag[] {
  const tags: Tag[] = [];
  if (court.indoorCourts > 0) tags.push({ label: "Indoor", tone: "pink" });
  if (court.outdoorCourts > 0) tags.push({ label: "Outdoor", tone: "green" });
  if (court.access) {
    tags.push({ label: ACCESS_LABEL[court.access], tone: court.access === "free" ? "green" : "pink" });
  }
  if (court.facilityType) {
    const isOpen = court.facilityType === "public" || court.facilityType === "school";
    tags.push({ label: FACILITY_LABEL[court.facilityType], tone: isOpen ? "green" : "pink" });
  }
  if (court.lighted) tags.push({ label: "Lighted", tone: "green" });
  if (court.dedicated) tags.push({ label: "Dedicated", tone: "green" });
  return tags;
}

function TagChip({ tag }: { tag: Tag }) {
  if (tag.tone === "pink") {
    // No Hot-Pink Chip color exists in HeroUI; a solid bubblegum fill + charcoal
    // (secondary-foreground, mode-independent) keeps AA contrast in light + dark.
    return (
      <Chip size="sm" className="bg-brand-bubblegum text-secondary-foreground">
        {tag.label}
      </Chip>
    );
  }
  return (
    <Chip size="sm" variant="soft" color="success">
      {tag.label}
    </Chip>
  );
}

export function CourtCard({
  court,
  index,
  distanceMi,
  variant = "list",
}: {
  court: CourtItem;
  index?: number;
  distanceMi?: number;
  variant?: "list" | "grid";
}): JSX.Element {
  const href = courtUrl(court);
  const photo = court.photos?.find((p) => p.visible);
  const tags = deriveTags(court);
  const showRank = index !== undefined && variant === "list";
  const courtWord = court.totalCourts === 1 ? "Court" : "Courts";
  const attributionName = photo?.attribution?.name;

  const isList = variant === "list";

  return (
    <div
      className={`group relative flex overflow-hidden rounded-2xl border border-border bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${
        isList ? "flex-row" : "flex-col"
      }`}
    >
      {/* Photo / placeholder */}
      <div
        className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-lime/25 to-secondary/20 ${
          isList ? "w-1/3 min-h-[7rem] self-stretch" : "aspect-[4/3] w-full"
        }`}
      >
        {photo ? (
          <Image
            src={photo.url}
            alt={`${court.name} pickleball courts`}
            fill
            sizes={isList ? "(max-width: 768px) 33vw, 280px" : "(max-width: 768px) 100vw, 380px"}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <BallMark className="size-12 opacity-80" />
          </span>
        )}

        {/* Rank badge (decorative — order already conveys rank) */}
        {showRank && (
          <span
            aria-hidden="true"
            className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground shadow"
          >
            {index! + 1}
          </span>
        )}

        {attributionName && (
          <span className="absolute bottom-1 right-1 max-w-[90%] truncate rounded bg-black/55 px-1 text-[10px] leading-4 text-white">
            {attributionName}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-display text-base font-bold leading-tight sm:text-lg">
            <Link
              href={href}
              className="text-accent outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
            >
              {court.name}
            </Link>
          </h3>
          {/* z-10 keeps the heart above the name link's ::after overlay */}
          <span className="relative z-10 -mr-1 -mt-1 shrink-0">
            <SaveHeartButton name={court.name} courtId={court.courtId} />
          </span>
        </div>

        <p className="flex items-center gap-1 text-sm text-muted">
          <PinIcon />
          <span>
            {court.totalCourts} {courtWord}
            {distanceMi !== undefined && ` · ${distanceMi} mi`}
          </span>
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <TagChip key={t.label} tag={t} />
            ))}
          </div>
        )}

        <div className="mt-auto pt-1">
          <RatingBadge rating={court.ratingAvg ?? 0} reviewCount={court.reviewCount ?? 0} size="sm" />
        </div>
      </div>
    </div>
  );
}
