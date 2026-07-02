import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getCitiesByKeys } from "@/lib/data/geo";
import { getTournamentsInCity } from "@/lib/data/tournaments";
import { buildMetadata, tournamentFinderTitle } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { TournamentCard } from "@/components/tournaments";
import { stateAbbr } from "@/lib/geo/us-states";
import {
  tournamentsHub,
  tournamentsCityPath,
  tournamentsCityPathFromKey,
  tournamentPath,
} from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = Promise<{ country: string; state: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  const path = tournamentsCityPath(country, state, city);
  if (!cityItem) return buildMetadata({ title: "Tournaments not found", path, noindex: true });
  const st = stateAbbr(state);
  return buildMetadata({
    title: tournamentFinderTitle(cityItem.name, st),
    description: `Find and register for pickleball tournaments in ${cityItem.name}, ${st}. Browse divisions, entry fees, and dates.`,
    path,
  });
}

export default async function CityTournamentsPage({ params }: { params: Params }) {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  if (!cityItem) notFound();

  const st = stateAbbr(state);
  const base = brand.siteUrl;
  const tournaments = await getTournamentsInCity(cityItem.cityKey);
  const nearby = await getCitiesByKeys((cityItem.nearbyCityKeys ?? []).slice(0, 6));

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Tournaments", url: `${base}${tournamentsHub()}` },
            { name: `${cityItem.name}, ${st}`, url: `${base}${tournamentsCityPath(country, state, city)}` },
          ]),
          itemListJsonLd(
            tournaments.map((t) => ({ name: t.title, url: `${base}${tournamentPath(t.tid)}` })),
          ),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tournaments", href: tournamentsHub() },
          { name: `${cityItem.name}, ${st}` },
        ]}
      />

      <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Pickleball Tournaments in {cityItem.name}, {st}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Browse upcoming tournaments and register online. All skill levels welcome.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-muted">
            {tournaments.length} tournament{tournaments.length === 1 ? "" : "s"} in {cityItem.name}
          </p>

          {tournaments.length === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-8 text-sm text-muted">
              <p>No tournaments scheduled in {cityItem.name} yet.</p>
              <Link
                href="/organize/tournaments/new"
                className="inline-flex h-11 items-center rounded-full bg-secondary px-5 font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Host a tournament in {cityItem.name}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tournaments.map((t) => (
                <li key={t.tid}>
                  <TournamentCard tournament={t} cityLabel={`${cityItem.name}, ${st}`} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Organizing a tournament?</h2>
            <p className="mt-1 text-sm text-muted">
              Publish your event, collect entry fees, and run brackets — all in one place.
            </p>
            <Link
              href="/organize/tournaments/new"
              className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Create a tournament
            </Link>
          </section>

          {nearby.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby cities</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {nearby.map((n) => (
                  <li key={n.cityKey}>
                    <Link
                      href={tournamentsCityPathFromKey(n.cityKey)}
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
