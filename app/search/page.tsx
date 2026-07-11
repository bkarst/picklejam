import type { Metadata } from "next";
import { MapFinder } from "@/components/search/MapFinder";

// Map finder (§6.1) — interactive utility; NOINDEX (canonical traffic goes to the
// static city pages, §9.7). Server shell exports metadata; MapFinder is CSR.
export const metadata: Metadata = {
  title: "Search Courts & Games",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  return (
    // White page surface (overrides the app's cream canvas) for the map utility.
    <main id="main" className="flex-1 bg-surface">
      <MapFinder />
    </main>
  );
}
