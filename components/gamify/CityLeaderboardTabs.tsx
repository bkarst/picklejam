"use client";

/**
 * CityLeaderboardTabs — the city leaderboard's tabbed body (§G12.9 item 2). A HeroUI
 * `ToggleButtonGroup` switches between This month · Last month (both `BoardTable`s, RP) and
 * Your stats (the viewer's this-month RP + a link to full progress; signed-out → sign-in
 * prompt). Both boards are passed as props so they SSR into the initial HTML — the page
 * stays crawlable and JS-off shows the current-month board. The viewer's "your row" strip
 * hangs under the two board tabs.
 */

import { useState } from "react";
import Link from "next/link";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BoardTable, type BoardRow } from "./BoardTable";
import { CityYourRow } from "./LeaderboardYourRow";
import { MonthStatsPanel } from "./MonthStatsPanel";

type Tab = "this" | "last" | "you";

function YourStats() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-foreground">Sign in to see your Rally Points and stats.</p>
        <Link href="/login" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      {/* Same "vs. your past self" panel as My Progress (§G12.9 → G12.6 item 3). */}
      <MonthStatsPanel />
      <Link href="/account/progress" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
        Your full progress →
      </Link>
    </div>
  );
}

export function CityLeaderboardTabs({ thisMonth, lastMonth }: { thisMonth: BoardRow[]; lastMonth: BoardRow[] }) {
  const [tab, setTab] = useState<Tab>("this");
  const rows = tab === "this" ? thisMonth : lastMonth;
  const rankedUids = rows.map((r) => r.uid);

  return (
    <div>
      <ToggleButtonGroup
        aria-label="Leaderboard view"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([tab])}
        onSelectionChange={(k) => {
          const first = [...k][0];
          if (first) setTab(String(first) as Tab);
        }}
        className="flex flex-wrap gap-2"
      >
        <ToggleButton id="this" className="h-10 rounded-full px-4 text-sm font-semibold">This month</ToggleButton>
        <ToggleButton id="last" className="h-10 rounded-full px-4 text-sm font-semibold">Last month</ToggleButton>
        <ToggleButton id="you" className="h-10 rounded-full px-4 text-sm font-semibold">Your stats</ToggleButton>
      </ToggleButtonGroup>

      <div className="mt-5">
        {tab === "you" ? (
          <YourStats />
        ) : rows.length > 0 ? (
          <>
            <BoardTable rows={rows} valueHeader="Rally Points" />
            {tab === "this" && <CityYourRow rankedUids={rankedUids} />}
          </>
        ) : (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-muted">
            No ranked players {tab === "this" ? "this month" : "last month"} yet.
          </p>
        )}
      </div>
    </div>
  );
}
