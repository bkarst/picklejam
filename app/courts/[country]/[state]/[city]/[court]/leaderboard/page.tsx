/**
 * Court Leaderboard — `/courts/[c]/[st]/[city]/[court]/leaderboard` (§G12.3). ISR(900).
 *
 * Check-in-days board for a court, one month at a time. The current month is the ISR
 * default; `?month=YYYYMM` reads a (frozen, immutable) past partition. Server-rendered
 * `BoardTable` (JS-off complete) + a client "your row" island + a captain-history strip.
 * Indexable at ≥5 ranked players, else noindex (§14.4 low-value-page pattern).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourtBySlug } from "@/lib/data/courts";
import { getState, getCity } from "@/lib/data/geo";
import { getCourtBoard } from "@/lib/data/gamify-boards";
import { getCaptainHistory } from "@/lib/data/gamify-crew";
import { prevMonth } from "@/lib/data/gamify-boards";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { BoardTable } from "@/components/gamify/BoardTable";
import { CourtYourRow } from "@/components/gamify/LeaderboardYourRow";
import { LeaderboardMonthPicker } from "@/components/gamify/LeaderboardMonthPicker";
import { CaptainHistoryStrip } from "@/components/gamify/CaptainHistoryStrip";
import { monthName, monthYearLabel } from "@/lib/gamify/time";
import { courtUrl } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ country: string; state: string; city: string; court: string }>;
type Search = Promise<{ month?: string | string[] }>;

const INDEX_MIN = 5; // ≥5 ranked players ⇒ indexable (§14.4)
const MONTH_OPTIONS = 6;

function recentMonths(current: string, count: number): string[] {
  const out: string[] = [];
  let m = current;
  for (let i = 0; i < count; i++) {
    out.push(m);
    m = prevMonth(m);
  }
  return out;
}

function resolveMonth(raw: string | string[] | undefined, current: string): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^\d{6}$/.test(v) ? v : current;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { country, state, city, court } = await params;
  const c = await getCourtBySlug(country, state, city, court);
  const path = `/courts/${country}/${state}/${city}/${court}/leaderboard`;
  if (!c) return buildMetadata({ title: "Not found", path, noindex: true });
  const current = courtLocalDay(c).slice(0, 6);
  const month = resolveMonth((await searchParams).month, current);
  const board = await getCourtBoard(c.courtId, month);
  return buildMetadata({
    title: `${c.name} leaderboard`,
    description: `Most active players at ${c.name} — check-in days this month.`,
    path,
    noindex: board.length < INDEX_MIN,
  });
}

export default async function CourtLeaderboardPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { country, state, city, court } = await params;
  const courtItem = await getCourtBySlug(country, state, city, court);
  if (!courtItem) notFound();

  const currentMonth = courtLocalDay(courtItem).slice(0, 6);
  const month = resolveMonth((await searchParams).month, currentMonth);

  const [stateItem, cityItem, board, captains] = await Promise.all([
    getState(country, state),
    getCity(country, state, city),
    getCourtBoard(courtItem.courtId, month),
    getCaptainHistory(courtItem.courtId, currentMonth, 6),
  ]);

  const cityName = cityItem?.name ?? city;
  const base = brand.siteUrl;
  const courtHref = courtUrl(courtItem);
  const rows = board;
  const rankedUids = rows.map((r) => r.uid);
  const isCurrent = month === currentMonth;

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: stateItem?.name ?? state, url: `${base}/courts/${country}/${state}` },
            { name: cityName, url: `${base}/courts/${country}/${state}/${city}` },
            { name: courtItem.name, url: `${base}${courtHref}` },
            { name: "Leaderboard", url: `${base}${courtHref}/leaderboard` },
          ]),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courts", href: "/courts" },
          { name: stateItem?.name ?? state, href: `/courts/${country}/${state}` },
          { name: cityName, href: `/courts/${country}/${state}/${city}` },
          { name: courtItem.name, href: courtHref },
          { name: "Leaderboard" },
        ]}
      />

      <div className="mt-4">
        <h1 className="font-display text-3xl font-bold text-accent">{courtItem.name} leaderboard</h1>
        <p className="mt-1 text-muted">Check-in days · {isCurrent ? monthName(month) : monthYearLabel(month)}</p>
      </div>

      <div className="mt-5">
        <LeaderboardMonthPicker months={recentMonths(currentMonth, MONTH_OPTIONS)} selected={month} currentMonth={currentMonth} />
      </div>

      <div className="mt-5">
        {rows.length > 0 ? (
          <>
            <BoardTable rows={rows} valueHeader="Check-in days" />
            <CourtYourRow courtId={courtItem.courtId} rankedUids={rankedUids} />
          </>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-foreground">No check-ins ranked for {isCurrent ? "this month" : monthYearLabel(month)} yet.</p>
            <p className="mt-1 text-sm text-muted">Check in at {courtItem.name} to put yourself on the board.</p>
            <Link
              href={courtHref}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover"
            >
              Be the first — check in
            </Link>
          </div>
        )}
      </div>

      {captains.length > 0 && (
        <section className="mt-8" aria-labelledby="captain-history-heading">
          <h2 id="captain-history-heading" className="font-display text-lg font-bold text-foreground">Past Captains</h2>
          <div className="mt-3">
            <CaptainHistoryStrip captains={captains} />
          </div>
        </section>
      )}

      <div className="mt-8 border-t border-border pt-4 text-sm">
        <Link href={courtHref} className="font-semibold text-accent hover:underline">← Back to {courtItem.name}</Link>
      </div>
    </main>
  );
}
