/**
 * AuthorByline — the author avatar + name (+ optional read-time & date) shown on
 * article/news cards and at the top of an article (§6.5, mockups 8.1/8.2/9.3).
 *
 * Server component. When `href` is given the name links to the author page (an
 * E-E-A-T signal); otherwise it renders as plain text. The avatar falls back to
 * initials when no image is present. Meta (read-time · date) is joined with a
 * middot that is hidden from assistive tech.
 */

import type { JSX } from "react";
import Link from "next/link";
import { readTimeLabel, formatArticleDate, initials } from "./format";

export function AuthorByline({
  name,
  avatarUrl,
  href,
  readMinutes,
  date,
  size = "sm",
  className = "",
}: {
  name: string;
  avatarUrl?: string;
  href?: string;
  readMinutes?: number;
  date?: string;
  size?: "sm" | "md";
  className?: string;
}): JSX.Element {
  const avatarSize = size === "md" ? "size-9" : "size-7";
  const meta: string[] = [];
  if (typeof readMinutes === "number" && readMinutes > 0) meta.push(readTimeLabel(readMinutes));
  if (date) meta.push(formatArticleDate(date));

  const nameEl = href ? (
    <Link
      href={href}
      className="rounded-sm font-semibold text-foreground hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {name}
    </Link>
  ) : (
    <span className="font-semibold text-foreground">{name}</span>
  );

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className={`${avatarSize} shrink-0 rounded-full object-cover`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`${avatarSize} inline-flex shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted`}
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate">{nameEl}</div>
        {meta.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
            {meta.map((m, i) => (
              <span key={m} className="flex items-center gap-x-1">
                {i > 0 && (
                  <span aria-hidden="true" className="select-none">
                    ·
                  </span>
                )}
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
