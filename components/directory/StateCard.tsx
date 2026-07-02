/**
 * StateCard — a state entry in country listings. Plain-div link card: state name
 * + a denormalized count line ("N cities · N locations").
 */

import type { JSX } from "react";
import Link from "next/link";
import type { StateItem } from "@/lib/db/types";
import { stateUrl } from "@/lib/urls";

export function StateCard({ state }: { state: StateItem }): JSX.Element {
  const c = state.counts ?? {};
  const cities = c.cities ?? 0;
  const locations = c.locations ?? 0;

  return (
    <Link
      href={stateUrl(state)}
      className="group flex flex-col gap-0.5 rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="font-display text-base font-bold text-accent group-hover:underline">
        {state.name}
      </span>
      <span className="text-sm text-muted">
        {cities} {cities === 1 ? "city" : "cities"} · {locations}{" "}
        {locations === 1 ? "location" : "locations"}
      </span>
    </Link>
  );
}
