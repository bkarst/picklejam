"use client";

/**
 * LeagueOrganizerDashboard — the organizer's control surface for one league
 * (design 12.3.6, §7.2). NO ads (a payment surface, §2.2). Revenue / payout
 * tallies (all via {@link formatMoney}), roster/teams, the weekly schedule,
 * standings, scores, and registrations/payments — each a read-only NATIVE table.
 * Loads the full league via {@link useLeague}; loading states are HeroUI Skeletons.
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { addMoney, formatMoney, money, subMoney, type Money } from "@/lib/money";
import { useLeague } from "@/lib/api/leagues";
import { leaguePath, leagueStandingsPath } from "@/lib/urls";
import type { LeagueDivisionItem } from "@/lib/db/types";
import type { PaymentStatus } from "@/lib/stripe/types";
import { formatDateRange, statusMeta, playModeLabel } from "./format";

type Tab = "roster" | "schedule" | "standings" | "scores" | "payments" | "messaging";
const TABS: { id: Tab; label: string }[] = [
  { id: "roster", label: "Roster / Teams" },
  { id: "schedule", label: "Schedule" },
  { id: "standings", label: "Standings" },
  { id: "scores", label: "Scores" },
  { id: "payments", label: "Registrations / Payments" },
  { id: "messaging", label: "Messaging" },
];

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

const PAY_TONE: Record<PaymentStatus, string> = {
  paid: "bg-success/15 text-foreground",
  pending: "bg-warning/15 text-warning-foreground",
  partnerPending: "bg-warning/15 text-warning-foreground",
  unpaid: "bg-surface-secondary text-muted",
  refunded: "bg-surface-secondary text-muted",
  partiallyRefunded: "bg-surface-secondary text-muted",
  failed: "bg-danger/15 text-danger",
  cancelled: "bg-surface-secondary text-muted",
};

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function weeksElapsed(startDate: string, seasonWeeks: number): number {
  const start = new Date(startDate).getTime();
  if (Number.isNaN(start)) return 0;
  const weeks = Math.floor((Date.now() - start) / (7 * 86_400_000)) + 1;
  return Math.max(0, Math.min(seasonWeeks, weeks));
}

export function LeagueOrganizerDashboard({ lid }: { lid: string }): JSX.Element {
  const { data, isLoading } = useLeague(lid);
  const [tab, setTab] = useState<Tab>("roster");
  const [did, setDid] = useState<string>("");

  const divisionsById = useMemo(() => {
    const m = new Map<string, LeagueDivisionItem>();
    for (const d of data?.divisions ?? []) m.set(d.did, d);
    return m;
  }, [data]);

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.teams ?? []) m.set(t.teamId, t.name);
    return (id: string | undefined): string => (id ? (m.get(id) ?? id) : "TBD");
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const { league, divisions, teams, registrations = [], schedule, standings } = data;
  const activeDid = did || divisions[0]?.did || "";
  const currency = league.currency;
  const status = statusMeta(league.status);

  const paid = registrations.filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "partiallyRefunded");
  const revenue = paid.reduce<Money>((acc, r) => (r.amount ? addMoney(acc, r.amount) : acc), money(0, currency));
  const fees = paid.reduce<Money>((acc, r) => (r.applicationFee ? addMoney(acc, r.applicationFee) : acc), money(0, currency));
  const payout = subMoney(revenue, fees);
  const elapsed = weeksElapsed(league.startDate, league.seasonWeeks);

  const divStandings = standings.filter((s) => s.did === activeDid).sort((a, b) => a.rank - b.rank);
  const played = schedule.filter((m) => typeof m.scoreA === "number" && typeof m.scoreB === "number");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{league.title}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {league.venueName ? `${league.venueName} · ` : ""}
            {formatDateRange(league.startDate, league.endDate)} · {playModeLabel(league.playMode)}
          </p>
        </div>
        <Link
          href={leaguePath(lid)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          View league page
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Registrations" value={String(registrations.length)} sub={`${teams.length} teams`} />
        <StatTile label="Revenue" value={formatMoney(revenue)} sub="Collected" />
        <StatTile label="Net payout" value={formatMoney(payout)} sub={`${formatMoney(fees)} platform fees`} />
        <StatTile label="Weeks elapsed" value={`${elapsed} / ${league.seasonWeeks}`} />
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px h-10 rounded-t-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              tab === t.id ? "border-b-2 border-accent text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Division selector (standings/schedule/scores) */}
      {(tab === "standings" || tab === "schedule" || tab === "scores") && divisions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => (
            <button
              key={d.did}
              type="button"
              onClick={() => setDid(d.did)}
              className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                activeDid === d.did ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:bg-surface-secondary"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Roster / Teams */}
      {tab === "roster" && (
        <TableWrap caption="Roster and teams">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>Team</th>
              <th scope="col" className={TH}>Division</th>
              <th scope="col" className={TH}>Members</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <EmptyRow cols={3} text="No teams yet. Share your league page to fill the roster." />
            ) : (
              teams.map((t) => (
                <tr key={t.teamId} className="border-b border-border last:border-0">
                  <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>{t.name}</th>
                  <td className={`text-muted ${TD}`}>{divisionsById.get(t.did)?.name ?? t.did}</td>
                  <td className={`tabular-nums text-muted ${TD}`}>{t.memberUids.length}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      )}

      {/* Schedule */}
      {tab === "schedule" && (
        <TableWrap caption="Weekly schedule">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>Week</th>
              <th scope="col" className={TH}>Home</th>
              <th scope="col" className={TH}>Away</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.filter((m) => m.did === activeDid).length === 0 ? (
              <EmptyRow cols={4} text="No schedule yet — generate the weekly schedule once the roster is set." />
            ) : (
              schedule
                .filter((m) => m.did === activeDid)
                .sort((a, b) => a.week - b.week || a.mid.localeCompare(b.mid))
                .map((m) => (
                  <tr key={m.mid} className="border-b border-border last:border-0">
                    <th scope="row" className={`text-left font-semibold tabular-nums text-foreground ${TD}`}>{m.week}</th>
                    <td className={`text-foreground ${TD}`}>{teamName(m.sideA?.[0])}</td>
                    <td className={`text-foreground ${TD}`}>{teamName(m.sideB?.[0])}</td>
                    <td className={`${TD}`}>
                      <span className="text-xs font-medium capitalize text-muted">{m.confirmStatus}</span>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </TableWrap>
      )}

      {/* Standings */}
      {tab === "standings" && (
        <div className="space-y-3">
          <TableWrap caption="Standings">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH}>#</th>
                <th scope="col" className={TH}>Team</th>
                <th scope="col" className={TH}>W–L</th>
                <th scope="col" className={TH}>Games</th>
                <th scope="col" className={`text-right ${TH}`}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {divStandings.length === 0 ? (
                <EmptyRow cols={5} text="Standings appear after the first weekly session." />
              ) : (
                divStandings.map((s) => (
                  <tr key={s.entrantId} className="border-b border-border last:border-0">
                    <th scope="row" className={`text-left font-bold tabular-nums text-foreground ${TD}`}>{s.rank}</th>
                    <td className={`font-medium text-foreground ${TD}`}>{teamName(s.entrantId)}</td>
                    <td className={`tabular-nums text-foreground ${TD}`}>{s.wins}–{s.losses}</td>
                    <td className={`tabular-nums text-muted ${TD}`}>{s.pointsFor}–{s.pointsAgainst}</td>
                    <td className={`text-right tabular-nums ${TD}`}>{s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}</td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
          <Link href={leagueStandingsPath(lid)} className="inline-block text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            View public standings &amp; schedule
          </Link>
        </div>
      )}

      {/* Scores */}
      {tab === "scores" && (
        <TableWrap caption="Reported scores">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>Week</th>
              <th scope="col" className={TH}>Matchup</th>
              <th scope="col" className={TH}>Score</th>
              <th scope="col" className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {played.filter((m) => m.did === activeDid).length === 0 ? (
              <EmptyRow cols={4} text="No scores reported yet." />
            ) : (
              played
                .filter((m) => m.did === activeDid)
                .sort((a, b) => a.week - b.week)
                .map((m) => (
                  <tr key={m.mid} className="border-b border-border last:border-0">
                    <th scope="row" className={`text-left font-semibold tabular-nums text-foreground ${TD}`}>{m.week}</th>
                    <td className={`text-foreground ${TD}`}>
                      {teamName(m.sideA?.[0])} <span className="text-muted">vs</span> {teamName(m.sideB?.[0])}
                    </td>
                    <td className={`tabular-nums font-semibold text-foreground ${TD}`}>{m.scoreA}–{m.scoreB}</td>
                    <td className={`${TD}`}>
                      <span className="text-xs font-medium capitalize text-muted">{m.confirmStatus}</span>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </TableWrap>
      )}

      {/* Registrations / Payments */}
      {tab === "payments" && (
        <TableWrap caption="Registrations and payments">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={TH}>Player</th>
              <th scope="col" className={TH}>Division</th>
              <th scope="col" className={TH}>Type</th>
              <th scope="col" className={TH}>Payment</th>
              <th scope="col" className={TH}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {registrations.length === 0 ? (
              <EmptyRow cols={5} text="No registrations yet. Share your league page to start filling divisions." />
            ) : (
              registrations.map((r) => (
                <tr key={r.sk} className="border-b border-border last:border-0">
                  <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>{r.uid}</th>
                  <td className={`text-muted ${TD}`}>{divisionsById.get(r.did)?.name ?? r.did}</td>
                  <td className={`text-muted ${TD}`}>{r.freeAgent ? "Free agent" : r.partnerUid ? "Partnered" : "Team"}</td>
                  <td className={`${TD}`}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PAY_TONE[r.paymentStatus]}`}>
                      {r.paymentStatus}
                    </span>
                  </td>
                  <td className={`tabular-nums text-foreground ${TD}`}>{r.amount ? formatMoney(r.amount) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrap>
      )}

      {/* Messaging */}
      {tab === "messaging" && (
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Message participants</h2>
          <p className="mt-1 text-sm text-muted">
            Send an announcement to everyone in the league — schedule changes, weather calls, and reminders are
            delivered through the notification rail.
          </p>
          <textarea
            aria-label="Announcement message"
            rows={4}
            placeholder="Write an announcement…"
            className="mt-4 w-full rounded-xl border border-border bg-field p-3 text-sm text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="button"
            className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Send announcement
          </button>
        </section>
      )}
    </div>
  );
}

function TableWrap({ caption, children }: { caption: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }): JSX.Element {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-8 text-center text-sm text-muted">
        {text}
      </td>
    </tr>
  );
}

export default LeagueOrganizerDashboard;
