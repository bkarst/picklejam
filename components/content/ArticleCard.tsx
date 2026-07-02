/**
 * ArticleCard — an evergreen-article card for the Content Hub (§6.5, mockups
 * 8.1 "Featured"/"Latest" + 8.2 category list). A plain-div card (no HeroUI Card,
 * per CLAUDE.md) composing: cover image (or a branded gradient placeholder), a
 * category eyebrow, the title link, an excerpt, and an <AuthorByline>.
 *
 * Server component; fully crawlable. The whole card is reachable via the title
 * Link (a stretched ::after overlay). Two layouts:
 *   - "grid" — image on top (Latest rail / author + category grids)
 *   - "row"  — image on the left (Featured rail + category list)
 */

import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ContentItem } from "@/lib/db/types";
import { articlePath } from "@/lib/urls";
import { brand } from "@/brand.config";
import { categoryMeta } from "./categories";
import { AuthorByline } from "./AuthorByline";

/** The pickleball mark used as the cover-image placeholder (brand board). */
function BallMark({ className }: { className?: string }): JSX.Element {
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

export function ArticleCard({
  content,
  variant = "grid",
  featured = false,
  authorAvatarUrl,
}: {
  content: ContentItem;
  variant?: "grid" | "row";
  featured?: boolean;
  authorAvatarUrl?: string;
}): JSX.Element {
  const href = articlePath(content.category, content.slug);
  const meta = categoryMeta(content.category);
  const isRow = variant === "row";

  return (
    <article
      className={`group relative flex overflow-hidden rounded-2xl border border-border bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${
        isRow ? "flex-col sm:flex-row" : "flex-col"
      }`}
    >
      {/* Cover */}
      <div
        className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-lime/25 to-secondary/20 ${
          isRow ? "aspect-[16/10] sm:aspect-auto sm:w-2/5 sm:self-stretch" : "aspect-[16/10] w-full"
        }`}
      >
        {content.coverImage ? (
          <Image
            src={content.coverImage}
            alt=""
            fill
            sizes={isRow ? "(max-width: 640px) 100vw, 320px" : "(max-width: 768px) 100vw, 360px"}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <BallMark className="size-12 opacity-80" />
          </span>
        )}
        {featured && (
          <span className="absolute left-2 top-2 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground shadow">
            Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">{meta.label}</p>
        <h3 className="font-display text-lg font-bold leading-snug text-foreground">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
          >
            {content.title}
          </Link>
        </h3>
        {content.excerpt && (
          <p className="line-clamp-3 text-sm text-muted">{content.excerpt}</p>
        )}
        <div className="relative z-10 mt-auto pt-1">
          <AuthorByline
            name={content.authorName ?? brand.identity.name}
            avatarUrl={authorAvatarUrl}
            readMinutes={content.readMinutes}
            date={content.publishedAt}
          />
        </div>
      </div>
    </article>
  );
}
