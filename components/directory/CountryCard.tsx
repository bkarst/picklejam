/**
 * CountryCard — a country entry in the top-level directory. Plain-div link card:
 * country name + a denormalized count line ("N states · N locations").
 */

import type { JSX } from "react";
import Link from "next/link";
import type { CountryItem } from "@/lib/db/types";
import { countryUrl } from "@/lib/urls";

export function CountryCard({ country }: { country: CountryItem }): JSX.Element {
  const c = country.counts ?? {};
  const states = c.states ?? 0;
  const locations = c.locations ?? 0;

  return (
    <Link
      href={countryUrl(country)}
      className="group flex flex-col gap-0.5 rounded-2xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="font-display text-base font-bold text-accent group-hover:underline">
        {country.name}
      </span>
      <span className="text-sm text-muted">
        {states} {states === 1 ? "state" : "states"} · {locations}{" "}
        {locations === 1 ? "location" : "locations"}
      </span>
    </Link>
  );
}
