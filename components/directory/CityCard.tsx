/**
 * CityCard — a city entry in "nearby cities" rails and state listings (4.3).
 * Plain-div link card (no HeroUI Card): city name + a denormalized count line.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { CityItem } from "@/lib/db/types";
import { cityUrl } from "@/lib/urls";

export function CityCard({ city }: { city: CityItem }): JSX.Element {
  const c = city.counts ?? {};
  const locations = c.locations ?? 0;
  const courts = c.courts ?? 0;

  return (
    <Link
      href={cityUrl(city)}
      className="group flex flex-col gap-0.5 rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="font-display text-base font-bold text-accent group-hover:underline">
        {city.name}
      </span>
      <span className="text-sm text-muted">
        {locations} {locations === 1 ? "location" : "locations"} · {courts}{" "}
        {courts === 1 ? "court" : "courts"}
        {c.games ? ` · ${c.games} games` : ""}
      </span>
    </Link>
  );
}
