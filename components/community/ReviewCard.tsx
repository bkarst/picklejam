/**
 * ReviewCard — a single court review (design 4.5 "Reviews" module).
 * Presentational + server-renderable, so review text ships in the crawlable HTML
 * (§14.4 render moat) and matches any Review JSON-LD.
 *
 * `ReviewItem` intentionally carries no identity, so the reviewer name/avatar are
 * an OPTIONAL hydrated `author` — absent, we show a neutral avatar + "Player".
 * Accessibility (CLAUDE.md/HIG): the "Verified via check-in" state is carried by
 * text, never a bare icon; ratings go through <StarsDisplay> (text aria-label).
 */

import type { JSX, ReactNode } from "react";
import { Chip } from "@heroui/react";
import type { ReviewItem } from "@/lib/db/types";
import { LevelChip } from "@/components/gamify/LevelChip";
import { StarsDisplay } from "./Stars";

export interface ReviewAuthor {
  name?: string;
  avatarUrl?: string;
  /** Gamification (§G12.16) — hydrated for public reviewers; absent ⇒ no chips. */
  level?: number;
  /** Crew at THIS court (≥4 check-in days this window, §G7.1). */
  isCrew?: boolean;
  /** Elite member (any year) — a subtle review crest (§G11/§G12.17). */
  isElite?: boolean;
}

function initialOf(name: string | undefined): string {
  return name?.trim()?.charAt(0)?.toUpperCase() || "";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Avatar({ author, mine }: { author?: ReviewAuthor; mine?: boolean }) {
  const initial = initialOf(author?.name);
  if (author?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={author.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent"
    >
      {initial || (
        <svg viewBox="0 0 24 24" className="size-5 text-accent" fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
        </svg>
      )}
      <span className="sr-only">{mine ? "You" : "Player"}</span>
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 13l4 4L19 7" />
      </svg>
      Verified via check-in
    </span>
  );
}

export function ReviewCard({
  review,
  author,
  mine,
  actions,
}: {
  review: ReviewItem;
  author?: ReviewAuthor;
  mine?: boolean;
  /** Optional trailing controls (e.g. Edit / Delete on the "My Reviews" page). */
  actions?: ReactNode;
}): JSX.Element {
  const name = author?.name || (mine ? "You" : "Player");
  const date = formatDate(review.createdAt);
  const helpful = review.helpfulCount ?? 0;

  return (
    <article className="flex gap-3 border-b border-border py-4 last:border-b-0">
      <Avatar author={author} mine={mine} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-foreground">{name}</span>
            {/* Elite crest (§G11) — subtle, ≤14px, a trusted-local-voice marker. */}
            {author?.isElite && (
              <span className="text-[14px] leading-none text-warning" role="img" aria-label="Elite member" title="Elite member">🏆</span>
            )}
            {/* Gamification chips (§G12.16) — only for hydrated (public) authors, never "Player". */}
            {author?.level != null && <LevelChip level={author.level} size="sm" />}
            {author?.isCrew && (
              <Chip size="sm" variant="soft" color="success" aria-label="Court Crew member">
                Crew
              </Chip>
            )}
            <StarsDisplay rating={review.rating1to5} size="sm" />
          </div>
          {date && <time className="shrink-0 text-xs text-muted">{date}</time>}
        </div>

        {review.title && (
          <p className="mt-1.5 font-semibold text-foreground">{review.title}</p>
        )}
        {review.body && <p className="mt-1 text-sm text-foreground/90">{review.body}</p>}

        {review.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.photoUrl}
            alt={`Photo from ${name}'s review`}
            className="mt-2 max-h-48 rounded-xl border border-border object-cover"
          />
        )}

        {review.tags && review.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {review.tags.map((tag) => (
              <Chip key={tag} size="sm" variant="soft" color="success">
                {tag}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 10v11M2 12v7a2 2 0 0 0 2 2h13.3a2 2 0 0 0 2-1.7l1.3-8a2 2 0 0 0-2-2.3H14l1-5a2 2 0 0 0-2-2l-4 8" />
            </svg>
            Helpful ({helpful})
          </span>
          {review.checkinVerified && <VerifiedBadge />}
          {actions && <span className="ml-auto flex items-center gap-2">{actions}</span>}
        </div>
      </div>
    </article>
  );
}
