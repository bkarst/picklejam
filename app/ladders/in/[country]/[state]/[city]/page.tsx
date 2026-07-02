import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getCitiesByKeys } from "@/lib/data/geo";
import { getLaddersInCity } from "@/lib/data/ladders";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { LeagueCard } from "@/components/leagues";
import { formatDateRange, playModeLabel } from "@/components/leagues/format";
import { stateAbbr } from "@/lib/geo/us-states";
import type { Money } from "@/lib/money";
import {
  laddersHub,
  ladderPath,
  laddersCityPath,
  laddersCityPathFromKey,
  organizeLeagueNew,
} from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = Promise<{ country: string; state: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  const path = laddersCityPath(country, state, city);
  if (!cityItem) return buildMetadata({ title: "Ladders not found", path, noindex: true });
  const st = stateAbbr(state);
  return buildMetadata({
    title: `Pickleball Ladders in ${cityItem.name}, ${st}`,
    description: `Join a pickleball ladder in ${cityItem.name}, ${st}. Challenge players above you and climb the rankings.`,
    path,
  });
}

export default async function CityLaddersPage({ params }: { params: Params }) {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  if (!cityItem) notFound();

  const st = stateAbbr(state);
  const base = brand.siteUrl;
  const cityLabel = `${cityItem.name}, ${st}`;
  const ladders = await getLaddersInCity(cityItem.cityKey);
  const nearby = await getCitiesByKeys((cityItem.nearbyCityKeys ?? []).slice(0, 6));

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Ladders", url: `${base}${laddersHub()}` },
            { name: cityLabel, url: `${base}${laddersCityPath(country, state, city)}` },
          ]),
          itemListJsonLd(ladders.map((l) => ({ name: l.title, url: `${base}${ladderPath(l.lid)}` }))),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Ladders", href: laddersHub() },
          { name: cityLabel },
        ]}
      />

      <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Pickleball Ladders in {cityItem.name}, {st}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Join an ongoing ladder and climb by challenging players above you.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-muted">
            {ladders.length} ladder{ladders.length === 1 ? "" : "s"} in {cityItem.name}
          </p>

          {ladders.length === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-8 text-sm text-muted">
              <p>No ladders in {cityItem.name} yet.</p>
              <Link
                href={organizeLeagueNew()}
                className="inline-flex h-11 items-center rounded-full bg-secondary px-5 font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Run a ladder in {cityItem.name}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {ladders.map((l) => (
                <li key={l.lid}>
                  <LeagueCard
                    href={ladderPath(l.lid)}
                    title={l.title}
                    status={l.status}
                    kind="ladder"
                    dateLabel={`Starts ${formatDateRange(l.startDate)} · Ongoing`}
                    meta={`${playModeLabel(l.playMode)} · Challenge ±${l.challengeRange}`}
                    place={l.venueName ? `${l.venueName} · ${cityLabel}` : cityLabel}
                    priceFrom={l.price as Money}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Organizing a ladder?</h2>
            <p className="mt-1 text-sm text-muted">Publish your ladder, collect membership fees, and let the challenges run themselves.</p>
            <Link
              href={organizeLeagueNew()}
              className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Create a ladder
            </Link>
          </section>

          {nearby.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby cities</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {nearby.map((n) => (
                  <li key={n.cityKey}>
                    <Link
                      href={laddersCityPathFromKey(n.cityKey)}
                      className="font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {n.name}, {stateAbbr(n.state)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
