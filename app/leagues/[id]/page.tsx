import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeague } from "@/lib/data/leagues";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { formatMoney } from "@/lib/money";
import { buildMetadata } from "@/lib/seo/metadata";
import { leagueEventJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { ratingRange } from "@/components/tournaments/format";
import {
  formatDateRange,
  playModeLabel,
  seasonLabel,
  leaguePriceFrom,
  spotsRemaining,
} from "@/components/leagues/format";
import {
  leaguePath,
  leagueRegisterPath,
  leagueStandingsPath,
  leaguesHub,
  leaguesCityPath,
} from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 600;
export const dynamicParams = true;

type Params = Promise<{ id: string }>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Wed, Jul 9" for the Nth week after the (yyyy-mm-dd) season start. */
function weekDate(startYmd: string, weekIndex: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startYmd);
  if (!m) return `Week ${weekIndex + 1}`;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + weekIndex * 7);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getLeague(id);
  const path = leaguePath(id);
  if (!data) return buildMetadata({ title: "League not found", path, noindex: true });
  const { league, divisions } = data;
  const from = leaguePriceFrom(divisions);
  return buildMetadata({
    title: `${league.title} — Pickleball League`,
    description:
      league.description?.trim() ||
      `Register for ${league.title}, a ${seasonLabel(league.seasonWeeks)} pickleball league starting ${formatDateRange(league.startDate)}.${from ? ` From ${formatMoney(from)} per player.` : ""}`,
    path,
    openGraphType: "article",
    noindex: league.status === "draft" || league.status === "cancelled",
  });
}

function IncludedItem({ children }: { children: ReactNode }): JSX.Element {
  return (
    <li className="flex items-center gap-2 text-sm text-foreground">
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
      </svg>
      {children}
    </li>
  );
}

const TH = "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

export default async function LeagueDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getLeague(id);
  if (!data) notFound();

  const { league, divisions, teams, standings } = data;
  const base = brand.siteUrl;
  const from = leaguePriceFrom(divisions);
  const registerable = league.status === "published";

  let cityName: string | undefined;
  let stateCode: string | undefined;
  let cityHref: string | undefined;
  if (league.cityKey) {
    const { country, state, city } = parseCityKey(league.cityKey);
    const cityItem = await getCity(country, state, city);
    cityName = cityItem?.name ?? city.replace(/-/g, " ");
    stateCode = stateAbbr(state);
    cityHref = leaguesCityPath(country, state, city);
  }
  const cityLabel = cityName ? `${cityName}${stateCode ? `, ${stateCode}` : ""}` : undefined;

  const capacity = divisions.reduce((n, d) => n + (d.capacity ?? 0), 0);
  const registered = divisions.reduce((n, d) => n + d.registeredCount, 0);
  const spotsLeft = capacity > 0 ? Math.max(0, capacity - registered) : null;

  // Standings preview: top of the first division.
  const teamName = new Map(teams.map((t) => [t.teamId, t.name] as const));
  const firstDid = divisions[0]?.did;
  const preview = standings
    .filter((s) => s.did === firstDid)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);

  const weeksToShow = Math.min(league.seasonWeeks, 4);

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Leagues", url: `${base}${leaguesHub()}` },
            ...(cityHref ? [{ name: cityLabel ?? "City", url: `${base}${cityHref}` }] : []),
            { name: league.title, url: `${base}${leaguePath(id)}` },
          ]),
          leagueEventJsonLd(league, divisions, {
            url: leaguePath(id),
            cityName,
            stateCode,
            venueName: league.venueName,
          }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Leagues", href: leaguesHub() },
          ...(cityHref ? [{ name: cityLabel ?? "City", href: cityHref }] : []),
          { name: league.title },
        ]}
      />

      {/* Header */}
      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <span className="inline-flex rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-foreground">
            {registerable ? "Registering" : league.status === "cancelled" ? "Cancelled" : league.status === "complete" ? "Complete" : "Draft"}
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">{league.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              {seasonLabel(league.seasonWeeks)} · Starts {formatDateRange(league.startDate)}
            </span>
            {(league.venueName || cityLabel) && (
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {league.venueName ?? cityLabel}
              </span>
            )}
          </div>

          {/* Info cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3">
            {league.description?.trim() && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">About</p>
                <p className="mt-1 text-sm text-foreground">{league.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Format</p>
              <p className="mt-1 text-sm text-foreground">
                {playModeLabel(league.playMode)} · {seasonLabel(league.seasonWeeks)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Divisions</p>
              <p className="mt-1 text-sm text-foreground">
                {divisions.length} flight{divisions.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {/* Divisions / Flights */}
          <section className="mt-8">
            <h2 className="font-display text-2xl font-bold text-foreground">Divisions &amp; flights</h2>
            <p className="mt-1 text-sm text-muted">Register for one flight that matches your skill level.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full text-sm">
                <caption className="sr-only">Divisions and flights</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={`text-left ${TH}`}>Flight</th>
                    <th scope="col" className={`text-left ${TH}`}>Skill</th>
                    <th scope="col" className={`text-left ${TH}`}>Format</th>
                    <th scope="col" className={`text-left ${TH}`}>Fee</th>
                    <th scope="col" className={`text-left ${TH}`}>Spots</th>
                    <th scope="col" className={`text-right ${TH}`}><span className="sr-only">Register</span></th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">Flights will be announced soon.</td></tr>
                  ) : (
                    divisions.map((d) => {
                      const rating = ratingRange(d);
                      const left = spotsRemaining(d);
                      const full = left !== null && left <= 0;
                      return (
                        <tr key={d.did} className="border-b border-border last:border-0">
                          <th scope="row" className={`text-left font-semibold text-foreground ${TD}`}>{d.name}</th>
                          <td className={TD}>
                            <span className="inline-flex items-center gap-1.5">
                              {rating.system === "DUPR" && (
                                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">DUPR</span>
                              )}
                              <span className="text-foreground">{rating.text}</span>
                            </span>
                          </td>
                          <td className={`text-foreground ${TD}`}>{playModeLabel(d.playMode)}</td>
                          <td className={`font-medium tabular-nums text-foreground ${TD}`}>{formatMoney(d.price)}</td>
                          <td className={TD}>
                            {left === null ? <span className="text-muted">Open</span> : full ? <span className="font-semibold text-danger">Full</span> : <span className="tabular-nums text-foreground">{left} / {d.capacity}</span>}
                          </td>
                          <td className={`text-right ${TD}`}>
                            {registerable && !full ? (
                              <Link href={leagueRegisterPath(id, d.did)} className="inline-flex h-9 min-w-24 items-center justify-center rounded-full border border-accent px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Register</Link>
                            ) : (
                              <span className="inline-flex h-9 min-w-24 items-center justify-center rounded-full bg-surface-secondary px-4 text-sm font-semibold text-muted">{full ? "Full" : "Closed"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Schedule + standings preview */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Schedule overview</h2>
                <Link href={leagueStandingsPath(id)} className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Full schedule</Link>
              </div>
              <ol className="mt-3 flex flex-col gap-2">
                {Array.from({ length: weeksToShow }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="text-sm font-semibold text-foreground">Week {i + 1}</span>
                    <span className="ml-auto text-sm text-muted">{weekDate(league.startDate, i)}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Standings preview</h2>
                <Link href={leagueStandingsPath(id)} className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Full standings</Link>
              </div>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <caption className="sr-only">Standings preview</caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className={`text-left ${TH}`}>#</th>
                      <th scope="col" className={`text-left ${TH}`}>Team</th>
                      <th scope="col" className={`text-right ${TH}`}>W–L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-muted">Standings update after each weekly session.</td></tr>
                    ) : (
                      preview.map((s) => (
                        <tr key={s.entrantId} className="border-b border-border last:border-0">
                          <th scope="row" className={`text-left font-bold tabular-nums text-foreground ${TD}`}>{s.rank}</th>
                          <td className={`font-medium text-foreground ${TD}`}>{teamName.get(s.entrantId) ?? s.entrantId}</td>
                          <td className={`text-right tabular-nums text-foreground ${TD}`}>{s.wins}–{s.losses}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Rules */}
          <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Rules &amp; refund policy</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm text-muted">
              <div>
                <p className="font-semibold text-foreground">Rules</p>
                <p className="mt-1">USA Pickleball rules apply. Respect your opponents, have fun, and play your best.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Refund policy</p>
                <p className="mt-1">Full refund before the season starts. Refunds are handled by the organizer after that.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Registration</h2>
            {from ? (
              <p className="mt-3 text-sm text-muted">
                <span className="font-display text-3xl font-bold text-accent">{formatMoney(from)}</span> / player
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">Flights coming soon.</p>
            )}

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Season</dt>
                <dd className="text-right font-medium text-foreground">{formatDateRange(league.startDate, league.endDate)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Spots remaining</dt>
                <dd className="text-right font-medium text-foreground">
                  {spotsLeft === null ? "Open" : `${spotsLeft}${capacity > 0 ? ` of ${capacity}` : ""}`}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              {registerable && divisions.length > 0 ? (
                <Link href={leagueRegisterPath(id)} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Register now</Link>
              ) : (
                <span className="inline-flex h-12 w-full items-center justify-center rounded-full bg-surface-secondary px-6 text-base font-semibold text-muted">{league.status === "cancelled" ? "Cancelled" : "Registration closed"}</span>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-display text-sm font-bold text-foreground">What&apos;s included</h3>
              <ul className="mt-3 flex flex-col gap-2">
                <IncludedItem>{seasonLabel(league.seasonWeeks)} of competitive play</IncludedItem>
                <IncludedItem>Standings, playoffs &amp; prizes</IncludedItem>
                <IncludedItem>Secure checkout via Stripe</IncludedItem>
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Standings &amp; schedule</h2>
            <p className="mt-1 text-sm text-muted">Live standings and the weekly schedule update after each session.</p>
            <Link href={leagueStandingsPath(id)} className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              View standings &amp; schedule
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
