"use client";

/**
 * ParticipantConsole — a member's league home (design-brief §7.3): this-week
 * matchup with score entry + opponent confirm, weekly availability / sub-pool,
 * the full team schedule, and the registration receipt. NO ads (a participant /
 * payment surface, §2.2). Loads the league via {@link useLeague}; loading states
 * are HeroUI Skeletons; the score/availability controls are optimistic.
 */

import { useMemo } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLeague } from "@/lib/api/leagues";
import { formatMoney } from "@/lib/money";
import { leaguePath, leagueRegisterPath, leagueStandingsPath } from "@/lib/urls";
import type { ScheduleMatchItem, LeagueTeamItem, AvailabilityStatus } from "@/lib/db/types";
import { formatDateRange, playModeLabel } from "./format";
import { MatchConfirmRow } from "./MatchConfirmRow";
import { AvailabilityToggle } from "./AvailabilityToggle";

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

export function ParticipantConsole({ lid }: { lid: string }): JSX.Element {
  const { user, loading, requireAuth } = useAuth();
  const { data, isLoading } = useLeague(user ? lid : undefined);

  const myUid = user?.uid;

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.teams ?? []) m.set(t.teamId, t.name);
    return (id: string | undefined): string => (id ? (m.get(id) ?? id) : "TBD");
  }, [data]);

  const reg = useMemo(
    () => data?.registrations?.find((r) => r.uid === myUid),
    [data, myUid],
  );

  const myTeam: LeagueTeamItem | undefined = useMemo(
    () => data?.teams?.find((t) => (reg?.teamId ? t.teamId === reg.teamId : t.memberUids.includes(myUid ?? ""))),
    [data, reg, myUid],
  );
  const myEntrantId = myTeam?.teamId ?? myUid;

  const myMatches: ScheduleMatchItem[] = useMemo(() => {
    if (!data || !myEntrantId) return [];
    return data.schedule
      .filter(
        (m) =>
          (!reg || m.did === reg.did) &&
          ((m.sideA ?? []).includes(myEntrantId) || (m.sideB ?? []).includes(myEntrantId)),
      )
      .sort((a, b) => a.week - b.week);
  }, [data, reg, myEntrantId]);

  const thisWeek = useMemo(
    () => myMatches.find((m) => m.confirmStatus !== "confirmed") ?? myMatches[myMatches.length - 1],
    [myMatches],
  );

  const availByWeek = useMemo(() => {
    const m = new Map<number, AvailabilityStatus>();
    for (const a of data?.availability ?? []) if (a.uid === myUid) m.set(a.week, a.status);
    return m;
  }, [data, myUid]);

  const division = data?.divisions.find((d) => d.did === reg?.did);
  const upcomingWeek = thisWeek?.week ?? 1;

  // ── auth / loading / empty gates ──
  // Auth resolves asynchronously (real Firebase leaves `user` null for the first few hundred
  // ms). Show the loading skeleton WHILE it resolves — checking `loading` before `!user` — so a
  // signed-in member never flashes the clickable "Sign in" gate (L20).
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted">Sign in to view your team, scores, and schedule.</p>
        <button
          type="button"
          onClick={() => requireAuth()}
          className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!reg) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-8">
        <p className="text-sm text-muted">You&apos;re not registered for {data.league.title} yet.</p>
        <Link
          href={leagueRegisterPath(lid)}
          className="inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Register for this league
        </Link>
      </div>
    );
  }

  const mySideOf = (m: ScheduleMatchItem): "A" | "B" =>
    (m.sideA ?? []).includes(myEntrantId ?? "") ? "A" : "B";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-foreground">{myTeam?.name ?? "My team"}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {data.league.title}
            {division ? ` · ${division.name}` : ""} · {playModeLabel(data.league.playMode)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={leagueStandingsPath(lid)}
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Standings
          </Link>
          <Link
            href={leaguePath(lid)}
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            League page
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* This week's matchup */}
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">This week&apos;s matchup</h2>
            <div className="mt-3">
              {thisWeek ? (
                <MatchConfirmRow
                  key={thisWeek.mid}
                  lid={lid}
                  match={thisWeek}
                  mySide={mySideOf(thisWeek)}
                  nameA={teamName(thisWeek.sideA?.[0])}
                  nameB={teamName(thisWeek.sideB?.[0])}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
                  No matchup scheduled yet — check back once the schedule is posted.
                </div>
              )}
            </div>
          </section>

          {/* Full schedule */}
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">Your schedule</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full text-sm">
                <caption className="sr-only">Your full league schedule</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={TH}>Week</th>
                    <th scope="col" className={TH}>Opponent</th>
                    <th scope="col" className={TH}>Result</th>
                    <th scope="col" className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myMatches.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted">
                        Your schedule will appear here once the season is set.
                      </td>
                    </tr>
                  ) : (
                    myMatches.map((m) => {
                      const side = mySideOf(m);
                      const oppId = side === "A" ? m.sideB?.[0] : m.sideA?.[0];
                      const myScore = side === "A" ? m.scoreA : m.scoreB;
                      const oppScore = side === "A" ? m.scoreB : m.scoreA;
                      const done = typeof myScore === "number" && typeof oppScore === "number";
                      return (
                        <tr key={m.mid} className="border-b border-border last:border-0">
                          <th scope="row" className={`text-left font-semibold text-foreground ${TD}`}>
                            {m.week}
                          </th>
                          <td className={`text-foreground ${TD}`}>{teamName(oppId)}</td>
                          <td className={`tabular-nums text-foreground ${TD}`}>
                            {done ? `${myScore}–${oppScore}` : "—"}
                          </td>
                          <td className={`${TD}`}>
                            <span className="text-xs font-medium capitalize text-muted">{m.confirmStatus}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Sidebar: availability + receipt */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-bold text-foreground">Availability — Week {upcomingWeek}</h2>
            <p className="mt-1 text-xs text-muted">Let your team and the sub pool know if you can play.</p>
            <div className="mt-3">
              <AvailabilityToggle key={upcomingWeek} lid={lid} week={upcomingWeek} status={availByWeek.get(upcomingWeek)} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-bold text-foreground">Receipt</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">League</dt>
                <dd className="text-right font-medium text-foreground">{data.league.title}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Season</dt>
                <dd className="text-right font-medium text-foreground">
                  {formatDateRange(data.league.startDate, data.league.endDate)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Amount paid</dt>
                <dd className="text-right font-semibold tabular-nums text-foreground">
                  {reg.amount ? formatMoney(reg.amount) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Status</dt>
                <dd className="text-right">
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold capitalize text-foreground">
                    {reg.paymentStatus}
                  </span>
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default ParticipantConsole;
