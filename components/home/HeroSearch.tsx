"use client";

/**
 * HeroSearch — the homepage hero search box (§6.1). Stage 1: submits to the map
 * finder (`/search?q=`). The rich typeahead (PLACES + COURTS) lands in Stage 1.5.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="flex w-full max-w-xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
      }}
    >
      <label htmlFor="hero-search" className="sr-only">
        Search courts, cities, or games
      </label>
      <input
        id="hero-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search courts, cities, or games…"
        className="h-12 min-w-0 flex-1 rounded-full border border-border bg-field px-5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <Button type="submit" variant="primary" size="lg">
        Search
      </Button>
    </form>
  );
}
