"use client";

/**
 * ErrorScreen — shared branded error UI (PRD §16.5). Used by the segment error
 * boundary (app/error.tsx) and the root boundary (app/global-error.tsx).
 */

import { Button } from "@heroui/react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function ErrorScreen({ reset }: { reset?: () => void }) {
  return (
    <main id="main" className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <Logo variant="mark" />
      <h1 className="font-display text-3xl font-bold text-foreground">Something went sideways</h1>
      <p className="max-w-md text-muted">
        We hit an unexpected error. Try again, or head back to safe ground.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reset && (
          <Button variant="primary" size="lg" onPress={reset}>
            Try again
          </Button>
        )}
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-full border border-border px-5 font-semibold text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
