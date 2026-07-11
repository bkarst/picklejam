/**
 * ComingSoon — a generic "this feature isn't live yet" page body. Used by the paid
 * surfaces (tournaments / leagues / ladders) while they're gated off behind
 * `NEXT_PUBLIC_PAID_EVENTS_ENABLED` (pre-Stripe launch), instead of a hard 404 —
 * so a stray link lands on a friendly placeholder, not an error page.
 *
 * Server-renderable, self-contained (renders its own <main>). Copy is overridable
 * but defaults to a fully generic message.
 */

import Link from "next/link";
import type { JSX } from "react";

export interface ComingSoonProps {
  title?: string;
  description?: string;
}

export function ComingSoon({
  title = "Coming soon",
  description = "This feature isn't available just yet — we're putting the finishing touches on it. Check back soon.",
}: ComingSoonProps = {}): JSX.Element {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-20 text-center"
    >
      <span
        className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-md text-muted">{description}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Back home
        </Link>
        <Link
          href="/round-robin"
          className="inline-flex h-12 items-center rounded-full border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Try the free round robin tool
        </Link>
      </div>
    </main>
  );
}

export default ComingSoon;
