"use client";

/**
 * ConsentBanner — cookie/consent notice (PRD §2.1/§2.2).
 *
 * Privacy-preserving: "Reject non-essential" is presented as an equal, primary
 * choice (not buried). Hidden once a choice is made. Dismissing without choosing
 * is not offered — an explicit decision is required for EU/CA compliance.
 */

import Link from "next/link";
import { Button } from "@heroui/react";
import { useConsent } from "./ConsentProvider";
import { brand } from "@/brand.config";

export function ConsentBanner() {
  const { decided, accept, reject } = useConsent();
  if (decided) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 p-4 shadow-overlay backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-surface-foreground">
          We use cookies for analytics and ads to improve {brand.identity.name}. You can accept or
          keep only what&rsquo;s essential.{" "}
          <Link href="/legal/cookies" className="font-medium text-accent underline">
            Learn more about our cookie policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="tertiary" size="md" onPress={reject}>
            Reject non-essential
          </Button>
          <Button variant="primary" size="md" onPress={accept}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
