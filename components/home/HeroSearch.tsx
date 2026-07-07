"use client";

/**
 * HeroSearch — the homepage hero search box (§6.1). A location-aware typeahead:
 * clicking the empty input requests the visitor's location and pre-fills a
 * PLACES + COURTS dropdown (nearest city + nearest courts); typing switches to
 * name suggestions. Selecting a suggestion opens the static page; the Search
 * button (or Enter) runs a full-text search on the map finder (`/search?q=`).
 */

import { SearchTypeahead } from "@/components/search/SearchTypeahead";

export function HeroSearch() {
  return (
    <div className="w-full max-w-xl">
      <SearchTypeahead
        placeholder="Search courts or cities…"
        ariaLabel="Search courts or cities"
        prepopulateNearby
        showSubmitButton
        submitLabel="Search"
        inputClassName="h-12 w-full rounded-full border border-border bg-field px-5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
    </div>
  );
}
