"use client";

/**
 * StandingsSchedule — the public league standings + weekly schedule + playoff
 * bracket (design 12.3.4). SERVER-FED: the standings page fetches the league
 * (ISR) and passes discrete props, so this stays hydration-stable and crawlable.
 * Interactivity (division tabs, week nav) is client-side over the already-loaded
 * data — no fetching here.
 *
 * Read-only tables are NATIVE `<table>` with `<th scope>` (NOT the react-aria
 * HeroUI Table, which caused a prod hydration mismatch on read-only tables). The
 * playoff bracket reuses the shared {@link BracketRenderer}. Movement/points never
 * rely on color alone (a sign + label accompany the tint).
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type {
  LeagueItem,
  LeagueDivisionItem,
  LeagueTeamItem,
  ScheduleMatchItem,
  LeagueStandingItem,
} from "@/lib/db/types";
import { BracketRenderer, type BracketMatch } from "@/components/brackets/BracketRenderer";
import { ratingRange, playModeLabel } from "./format";

const TH = "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

/** Standard league table points (3 per win, 1 per tie). */
function standingPoints(s: Pick<LeagueStandingItem, "wins" | "ties">): number {
  return s.wins * 3 + s.ties;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export interface StandingsScheduleProps {
  league: Pick<LeagueItem, "lid" | "title" | "seasonWeeks">;
  divisions: LeagueDivisionItem[];
  teams: LeagueTeamItem[];
  schedule: ScheduleMatchItem[];
  standings: LeagueStandingItem[];
  /** Top N teams advance to playoffs (footer note). */
  playoffCut?: number;
}

export function StandingsSchedule({
  league,
  divisions,
  teams,
  schedule,
  standings,
  playoffCut = 4,
}: StandingsScheduleProps): JSX.Element {
  const [did, setDid] = useState<string>(divisions[0]?.did ?? "");

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams) m.set(t.teamId, t.name);
    return (id: string | undefined): string => (id ? (m.get(id) ?? id) : "TBD");
  }, [teams]);

  const divStandings = useMemo(
    () => standings.filter((s) => s.did === did).sort((a, b) => a.rank - b.rank),
    [standings, did],
  );

  const divSchedule = useMemo(
    () => schedule.filter((m) => m.did === did),
    [schedule, did],
  );

  const regularWeeks = useMemo(
    () =>
      [...new Set(divSchedule.filter((m) => m.week <= league.seasonWeeks).map((m) => m.week))].sort(
        (a, b) => a - b,
      ),
    [divSchedule, league.seasonWeeks],
  );

  const [weekIdx, setWeekIdx] = useState(0);
  const activeWeek = regularWeeks[Math.min(weekIdx, Math.max(0, regularWeeks.length - 1))];
  const weekMatches = useMemo(
    () =>
      divSchedule
        .filter((m) => m.week === activeWeek)
        .sort((a, b) => (a.playedAt ?? a.mid).localeCompare(b.playedAt ?? b.mid)),
    [divSchedule, activeWeek],
  );

  // Playoff bracket = any fixtures scheduled beyond the regular season.
  const playoffMatches: BracketMatch[] = useMemo(() => {
    const rows = divSchedule
      .filter((m) => m.week > league.seasonWeeks)
      .sort((a, b) => a.week - b.week || a.mid.localeCompare(b.mid));
    const perRound = new Map<number, number>();
    return rows.map((m): BracketMatch => {
      const round = m.week - league.seasonWeeks;
      const index = perRound.get(round) ?? 0;
      perRound.set(round, index + 1);
      const done = typeof m.scoreA === "number" && typeof m.scoreB === "number";
      const aWins = done && (m.scoreA ?? 0) > (m.scoreB ?? 0);
      const bWins = done && (m.scoreB ?? 0) > (m.scoreA ?? 0);
      return {
        round,
        index,
        sideA: {
          name: teamName(m.sideA?.[0]),
          ...(typeof m.scoreA === "number" ? { score: m.scoreA } : {}),
          isWinner: aWins,
          dot: aWins ? "won" : "idle",
        },
        sideB: {
          name: teamName(m.sideB?.[0]),
          ...(typeof m.scoreB === "number" ? { score: m.scoreB } : {}),
          isWinner: bWins,
          dot: bWins ? "won" : "idle",
        },
        status: done ? "complete" : "pending",
      };
    });
  }, [divSchedule, league.seasonWeeks, teamName]);

  const activeDiv = divisions.find((d) => d.did === did);
  const gate = activeDiv ? ratingRange(activeDiv) : null;

  const onDivChange = (next: string) => {
    setDid(next);
    setWeekIdx(0);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Division tabs */}
      {divisions.length > 1 && (
        <ToggleButtonGroup
          aria-label="Division"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([did])}
          onSelectionChange={(k) => {
            const first = [...k][0];
            if (first) onDivChange(String(first));
          }}
          className="flex flex-wrap gap-2"
        >
          {divisions.map((d) => (
            <ToggleButton key={d.did} id={d.did} className="h-10 rounded-full px-4 text-sm font-semibold">
              {d.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Standings */}
        <section aria-labelledby="standings-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="standings-heading" className="font-display text-xl font-bold text-foreground">
              Standings
            </h2>
            {gate?.system && (
              <span className="text-xs text-muted">
                {gate.system} {gate.text} · {activeDiv ? playModeLabel(activeDiv.playMode) : ""}
              </span>
            )}
          </div>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">League standings for {activeDiv?.name ?? "the division"}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={`text-left ${TH}`}>#</th>
                  <th scope="col" className={`text-left ${TH}`}>Team</th>
                  <th scope="col" className={`text-left ${TH}`}>W–L</th>
                  <th scope="col" className={`text-left ${TH}`}>Games</th>
                  <th scope="col" className={`text-right ${TH}`}>Pts</th>
                  <th scope="col" className={`text-right ${TH}`}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {divStandings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">
                      Standings appear after the first weekly session.
                    </td>
                  </tr>
                ) : (
                  divStandings.map((s) => {
                    const advancing = s.rank <= playoffCut;
                    return (
                      <tr key={s.entrantId} className={`border-b border-border last:border-0 ${advancing ? "bg-success/5" : ""}`}>
                        <th scope="row" className={`text-left font-bold tabular-nums text-foreground ${TD}`}>
                          {s.rank}
                        </th>
                        <td className={`font-medium text-foreground ${TD}`}>{teamName(s.entrantId)}</td>
                        <td className={`tabular-nums text-foreground ${TD}`}>
                          {s.wins}–{s.losses}
                          {s.ties > 0 ? `–${s.ties}` : ""}
                        </td>
                        <td className={`tabular-nums text-muted ${TD}`}>
                          {s.pointsFor}–{s.pointsAgainst}
                        </td>
                        <td className={`text-right font-semibold tabular-nums text-foreground ${TD}`}>
                          {standingPoints(s)}
                        </td>
                        <td className={`text-right tabular-nums ${TD} ${s.pointDiff > 0 ? "text-success" : s.pointDiff < 0 ? "text-danger" : "text-muted"}`}>
                          {signed(s.pointDiff)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/5 p-3 text-sm text-muted">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-secondary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /></svg>
            <span>
              <span className="font-semibold text-foreground">Top {playoffCut} teams advance to playoffs.</span>{" "}
              Tiebreakers: head-to-head, then games won, then point differential.
            </span>
          </p>
        </section>

        {/* Schedule */}
        <section aria-labelledby="schedule-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="schedule-heading" className="font-display text-xl font-bold text-foreground">
              Schedule
            </h2>
            {regularWeeks.length > 0 && (
              <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
                  disabled={weekIdx <= 0}
                  aria-label="Previous week"
                  className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <span className="min-w-20 px-2 text-center text-sm font-semibold text-foreground">
                  Week {activeWeek ?? "—"}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekIdx((i) => Math.min(regularWeeks.length - 1, i + 1))}
                  disabled={weekIdx >= regularWeeks.length - 1}
                  aria-label="Next week"
                  className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {weekMatches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
                The weekly schedule will be posted once the season is set.
              </div>
            ) : (
              weekMatches.map((m) => {
                const done = typeof m.scoreA === "number" && typeof m.scoreB === "number";
                const aWins = done && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                const bWins = done && (m.scoreB ?? 0) > (m.scoreA ?? 0);
                return (
                  <div key={m.mid} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${aWins ? "font-bold text-foreground" : "text-foreground/90"}`}>
                        {teamName(m.sideA?.[0])}
                      </p>
                      <p className={`truncate text-sm ${bWins ? "font-bold text-foreground" : "text-foreground/90"}`}>
                        {teamName(m.sideB?.[0])}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {done ? (
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                            m.confirmStatus === "confirmed" ? "bg-success/15 text-foreground" : "border border-border text-foreground"
                          }`}
                        >
                          {m.scoreA} – {m.scoreB}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted">Not played</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Playoffs */}
      <section aria-labelledby="playoffs-heading">
        <h2 id="playoffs-heading" className="font-display text-xl font-bold text-foreground">
          Playoffs
        </h2>
        <p className="mt-1 text-sm text-muted">Top seeds compete in the post-season bracket.</p>
        <div className="mt-3">
          <BracketRenderer matches={playoffMatches} caption="League playoff bracket" />
        </div>
      </section>
    </div>
  );
}

export default StandingsSchedule;
