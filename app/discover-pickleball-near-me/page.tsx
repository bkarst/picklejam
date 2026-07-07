import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverFinder } from "@/components/discover/DiscoverFinder";

/**
 * /discover-pickleball-near-me — the unified finder for groups, leagues, ladders,
 * and tournaments near you. A client-driven, personalized utility (its own view,
 * distinct from the court `/search` map), so it's NOINDEX — canonical discovery
 * traffic lands on the static per-city finder pages (`/groups/in/...`,
 * `/leagues/in/...`, etc.). The descriptive slug is for humans sharing the link, not
 * for ranking.
 */
export const metadata: Metadata = {
  title: "Discover Pickleball Groups, Leagues, Ladders & Tournaments Near You",
  robots: { index: false },
};

export default function DiscoverPage() {
  return (
    <main id="main" className="flex-1">
      {/* DiscoverFinder reads `?type=` via useSearchParams → needs a Suspense boundary. */}
      <Suspense>
        <DiscoverFinder />
      </Suspense>
    </main>
  );
}
