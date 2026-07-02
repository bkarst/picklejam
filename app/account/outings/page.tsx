"use client";

/**
 * My games (/account/outings) — the caller's outings (§6.7), split into Hosting
 * and Attending tabs. noindex + the auth guard are inherited from the /account
 * layout. Loading = Skeletons; empty states point at the wizard / finder.
 */

import { useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useMyOutings } from "@/lib/api/account-lists";
import { OutingCard } from "@/components/outings/OutingCard";
import type { OutingItem } from "@/lib/db/types";

type Tab = "hosting" | "attending";

function List({
  games,
  courts,
  emptyText,
  emptyCta,
}: {
  games: OutingItem[];
  courts: Record<string, { name: string; url: string }>;
  emptyText: string;
  emptyCta: { href: string; label: string };
}): JSX.Element {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
        <p>{emptyText}</p>
        <Link
          href={emptyCta.href}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {emptyCta.label}
        </Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {games.map((g) => {
        const c = courts[g.courtId];
        return (
          <li key={g.outingId}>
            <OutingCard outing={g} court={c ? { name: c.name, href: c.url } : null} showDate />
          </li>
        );
      })}
    </ul>
  );
}

export default function MyOutingsPage(): JSX.Element {
  const { data, isLoading } = useMyOutings();
  const [tab, setTab] = useState<Tab>("hosting");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">My games</h1>
        <Link
          href="/outings/new"
          className="inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Host a game
        </Link>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="My games" className="inline-flex rounded-full border border-border bg-surface p-1">
        {(["hosting", "attending"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              tab === t ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-surface-secondary"
            }`}
          >
            {t === "hosting" ? "Hosting" : "Attending"}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : tab === "hosting" ? (
        <List
          games={data.hosting}
          courts={data.courts}
          emptyText="You're not hosting any games yet."
          emptyCta={{ href: "/outings/new", label: "Host a game" }}
        />
      ) : (
        <List
          games={data.attending}
          courts={data.courts}
          emptyText="You haven't RSVP'd to any games yet."
          emptyCta={{ href: "/courts", label: "Find games" }}
        />
      )}
    </div>
  );
}
