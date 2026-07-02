/**
 * NewsCard — a dated-news card for the News surface (§6.6, mockups 9.1/9.3). A
 * plain-div card (no HeroUI Card) with three layouts:
 *   - "grid"    — image on top, topic chip, title, source + relative time (Latest)
 *   - "row"     — large image on the left, "Featured" badge (hero on the index)
 *   - "compact" — no image, a leading dot + title + source + time (Recent stories)
 *
 * Server component; fully crawlable. Relative time is computed server-side; the
 * absolute timestamp is exposed via a <time dateTime> for machines + a11y.
 */

import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { Chip } from "@heroui/react";
import type { NewsItem } from "@/lib/db/types";
import { newsArticlePath } from "@/lib/urls";
import { relativeTime, titleize } from "./format";

function SourceLine({
  news,
  showTime = true,
}: {
  news: NewsItem;
  showTime?: boolean;
}): JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
      {news.source?.name && <span className="font-medium text-foreground">{news.source.name}</span>}
      {news.source?.name && showTime && (
        <span aria-hidden="true" className="select-none">
          ·
        </span>
      )}
      {showTime && (
        <time dateTime={news.publishedAt}>{relativeTime(news.publishedAt)}</time>
      )}
    </p>
  );
}

export function NewsCard({
  news,
  variant = "grid",
  featured = false,
}: {
  news: NewsItem;
  variant?: "grid" | "row" | "compact";
  featured?: boolean;
}): JSX.Element {
  const href = newsArticlePath(news.slug);
  const topic = news.topics?.[0];

  // Compact: text-only recent-stories list row.
  if (variant === "compact") {
    return (
      <article className="group relative flex gap-3 py-3">
        <span
          aria-hidden="true"
          className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug text-foreground">
            <Link
              href={href}
              className="outline-none after:absolute after:inset-0 hover:text-accent hover:underline focus-visible:underline"
            >
              {news.title}
            </Link>
          </h3>
          <SourceLine news={news} />
        </div>
      </article>
    );
  }

  const isRow = variant === "row";

  return (
    <article
      className={`group relative flex overflow-hidden rounded-2xl border border-border bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${
        isRow ? "flex-col sm:flex-row" : "flex-col"
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-lime/20 to-secondary/15 ${
          isRow ? "aspect-video sm:aspect-auto sm:w-1/2 sm:self-stretch" : "aspect-video w-full"
        }`}
      >
        {news.coverImage ? (
          <Image
            src={news.coverImage}
            alt=""
            fill
            sizes={isRow ? "(max-width: 640px) 100vw, 480px" : "(max-width: 768px) 100vw, 300px"}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted">
            <svg viewBox="0 0 24 24" className="size-10 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 5h13a2 2 0 0 1 2 2v10a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 9h7M8 13h7M8 17h4" strokeLinecap="round" />
            </svg>
          </span>
        )}
        {featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground shadow">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>
            Featured
          </span>
        )}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col gap-2 p-4 ${isRow ? "sm:justify-center sm:p-6" : ""}`}>
        {topic && (
          <div>
            <Chip size="sm" variant="soft" color="success">
              {titleize(topic)}
            </Chip>
          </div>
        )}
        <h3
          className={`font-display font-bold leading-snug text-foreground ${
            isRow ? "text-xl sm:text-2xl" : "text-base"
          }`}
        >
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 hover:text-accent hover:underline focus-visible:underline"
          >
            {news.title}
          </Link>
        </h3>
        {isRow && news.excerpt && (
          <p className="line-clamp-2 text-sm text-muted">{news.excerpt}</p>
        )}
        <SourceLine news={news} />
      </div>
    </article>
  );
}
