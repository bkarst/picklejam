import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament } from "@/lib/data/tournaments";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { formatMoney } from "@/lib/money";
import { buildMetadata } from "@/lib/seo/metadata";
import { tournamentEventJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { DivisionsTable } from "@/components/tournaments";
import { priceFrom, formatDateRange, statusMeta } from "@/components/tournaments/format";
import {
  tournamentPath,
  tournamentRegisterPath,
  tournamentBracketPath,
  tournamentsHub,
  tournamentsCityPath,
} from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 600;
export const dynamicParams = true;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getTournament(id);
  const path = tournamentPath(id);
  if (!data) return buildMetadata({ title: "Tournament not found", path, noindex: true });
  const { tourney, divisions } = data;
  const from = priceFrom(divisions);
  return buildMetadata({
    title: `${tourney.title} — Pickleball Tournament`,
    description:
      tourney.description?.trim() ||
      `Register for ${tourney.title} on ${formatDateRange(tourney.startDate, tourney.endDate)}${
        tourney.venueName ? ` at ${tourney.venueName}` : ""
      }.${from ? ` Divisions from ${formatMoney(from)}.` : ""}`,
    path,
    openGraphType: "article",
    // Drafts / cancelled tournaments are reachable by link but not indexed.
    noindex: tourney.status === "draft" || tourney.status === "cancelled",
  });
}

function IncludedItem({ children }: { children: string }): JSX.Element {
  return (
    <li className="flex items-center gap-2 text-sm text-foreground">
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
      </svg>
      {children}
    </li>
  );
}

export default async function TournamentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getTournament(id);
  if (!data) notFound();

  const { tourney, divisions } = data;
  const base = brand.siteUrl;
  const status = statusMeta(tourney.status);
  const from = priceFrom(divisions);
  const registerable = tourney.status === "published";

  // Geo (optional — cityKey may be absent on a draft).
  let cityName: string | undefined;
  let stateCode: string | undefined;
  let cityHref: string | undefined;
  if (tourney.cityKey) {
    const { country, state, city } = parseCityKey(tourney.cityKey);
    const cityItem = await getCity(country, state, city);
    cityName = cityItem?.name ?? city.replace(/-/g, " ");
    stateCode = stateAbbr(state);
    cityHref = tournamentsCityPath(country, state, city);
  }
  const cityLabel = cityName ? `${cityName}${stateCode ? `, ${stateCode}` : ""}` : undefined;

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Tournaments", url: `${base}${tournamentsHub()}` },
            ...(cityHref ? [{ name: cityLabel ?? "City", url: `${base}${cityHref}` }] : []),
            { name: tourney.title, url: `${base}${tournamentPath(id)}` },
          ]),
          tournamentEventJsonLd(tourney, divisions, {
            url: tournamentPath(id),
            cityName,
            stateCode,
            venueName: tourney.venueName,
          }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tournaments", href: tournamentsHub() },
          ...(cityHref ? [{ name: cityLabel ?? "City", href: cityHref }] : []),
          { name: tourney.title },
        ]}
      />

      {/* Header */}
      <div className="mt-4">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
          {status.label}
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
          {tourney.title}
        </h1>
        <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            <span className="text-foreground">{formatDateRange(tourney.startDate, tourney.endDate)}</span>
          </span>
          {(tourney.venueName || cityLabel) && (
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
              <span className="text-foreground">
                {tourney.venueName ?? cityLabel}
                {tourney.venueName && cityLabel ? <span className="text-muted"> · {cityLabel}</span> : null}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          {tourney.description?.trim() && (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">About</h2>
              <p className="mt-2 whitespace-pre-line text-muted">{tourney.description}</p>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-2xl font-bold text-foreground">Divisions</h2>
            <p className="mt-1 text-sm text-muted">
              {tourney.elim === "double" ? "Double" : "Single"}-elimination · register for one division.
            </p>
            <div className="mt-4">
              <DivisionsTable tid={id} divisions={divisions} registerable={registerable} />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Registration</h2>
            {from ? (
              <p className="mt-3 text-sm text-muted">
                From{" "}
                <span className="font-display text-3xl font-bold text-accent">{formatMoney(from)}</span>{" "}
                per division
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted">Divisions coming soon.</p>
            )}

            <div className="mt-4">
              {registerable && divisions.length > 0 ? (
                <Link
                  href={tournamentRegisterPath(id)}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Register now
                </Link>
              ) : (
                <span className="inline-flex h-12 w-full items-center justify-center rounded-full bg-surface-secondary px-6 text-base font-semibold text-muted">
                  {tourney.status === "cancelled" ? "Cancelled" : "Registration closed"}
                </span>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="font-display text-sm font-bold text-foreground">What&apos;s included</h3>
              <ul className="mt-3 flex flex-col gap-2">
                <IncludedItem>Tournament play</IncludedItem>
                <IncludedItem>Live bracket &amp; results</IncludedItem>
                <IncludedItem>Secure checkout via Stripe</IncludedItem>
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Bracket &amp; results</h2>
            <p className="mt-1 text-sm text-muted">
              Brackets and live scores are available during and after the event.
            </p>
            <Link
              href={tournamentBracketPath(id)}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              View brackets &amp; results
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
