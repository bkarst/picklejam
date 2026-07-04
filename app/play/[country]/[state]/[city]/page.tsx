import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getCitiesByKeys } from "@/lib/data/geo";
import { getCityGames } from "@/lib/data/outings";
import { courtLocalDay, nowMs } from "@/lib/directory/court-local-day";
import { getCourt } from "@/lib/data/courts";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { DateStepper } from "@/components/outings/DateStepper";
import { OutingCard } from "@/components/outings/OutingCard";
import { cityGamesPath, cityGamesPathFromKey, courtUrl, outingPath } from "@/lib/urls";
import { stateAbbr } from "@/lib/geo/us-states";
import { brand } from "@/brand.config";
import type { OutingItem } from "@/lib/db/types";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = Promise<{ country: string; state: string; city: string }>;
type Search = Promise<{ date?: string | string[] }>;

/**
 * The day to show: an explicit `?date=yyyymmdd`, else `fallbackDay`. The fallback MUST
 * be the CITY-local day (not the server's), because games are keyed by the court-local
 * `yyyymmdd` (see getCityGames). Using the server's UTC date defaulted a US-west city to
 * TOMORROW's games from ~late afternoon until midnight UTC — hiding tonight's games
 * during peak evening hours.
 */
function resolveDay(raw: string | string[] | undefined, fallbackDay: string): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && /^\d{8}$/.test(v) ? v : fallbackDay;
}

function labelForDay(yyyymmdd: string): string {
  const d = new Date(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  const path = cityGamesPath(country, state, city);
  if (!cityItem) return buildMetadata({ title: "Games not found", path, noindex: true });
  const st = stateAbbr(state);
  return buildMetadata({
    title: `Pickleball Games in ${cityItem.name}, ${st}`,
    description: `Find pickleball games and open play in ${cityItem.name}, ${st}. RSVP to a game or host your own — all skill levels welcome.`,
    path,
  });
}

export default async function CityGamesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { country, state, city } = await params;
  const { date } = await searchParams;
  const cityItem = await getCity(country, state, city);
  if (!cityItem) notFound();

  // Default to the CITY's local day (from its centroid longitude), matching how games
  // are keyed and how the /courts city page resolves "today". `-98` ≈ US center.
  const day = resolveDay(date, courtLocalDay({ lng: cityItem.centroidLng ?? -98 }, nowMs()));
  const st = stateAbbr(state);
  const base = brand.siteUrl;

  const games: OutingItem[] = await getCityGames(cityItem.cityKey, day);

  // Hydrate court names for the cards.
  const courtIds = [...new Set(games.map((g) => g.courtId))];
  const courtEntries = await Promise.all(
    courtIds.map(async (cid) => {
      const c = await getCourt(cid);
      return c ? ([cid, { name: c.name, href: courtUrl(c) }] as const) : null;
    }),
  );
  const courts = new Map(courtEntries.filter(Boolean) as [string, { name: string; href: string }][]);

  const nearby = await getCitiesByKeys((cityItem.nearbyCityKeys ?? []).slice(0, 6));

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Games", url: `${base}/search` },
            { name: `${cityItem.name}, ${st}`, url: `${base}${cityGamesPath(country, state, city)}` },
          ]),
          itemListJsonLd(
            games.map((g) => ({ name: g.title, url: `${base}${outingPath(g.outingId)}` })),
          ),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Games", href: "/search" },
          { name: `${cityItem.name}, ${st}` },
        ]}
      />

      <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Pickleball Games &amp; Open Play in {cityItem.name}, {st}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Find games and open play for all skill levels. Everyone&apos;s welcome.
      </p>

      <div className="mt-6">
        <DateStepper selected={day} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-muted">
            {games.length} game{games.length === 1 ? "" : "s"} found for {labelForDay(day)}
          </p>

          {games.length === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-8 text-sm text-muted">
              <p>No games scheduled in {cityItem.name} for {labelForDay(day)} yet.</p>
              <Link
                href="/outings/new"
                className="inline-flex h-11 items-center rounded-full bg-secondary px-5 font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Host the first game in {cityItem.name}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {games.map((g) => (
                <li key={g.outingId}>
                  <OutingCard outing={g} court={courts.get(g.courtId) ?? null} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {/* Host CTA */}
          <section className="rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Host a game in {cityItem.name}</h2>
            <p className="mt-1 text-sm text-muted">Create your own game and invite players of your choosing.</p>
            <Link
              href="/outings/new"
              className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Host a Game
            </Link>
          </section>

          {/* Nearby cities */}
          {nearby.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby cities</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {nearby.map((n) => (
                  <li key={n.cityKey}>
                    <Link
                      href={cityGamesPathFromKey(n.cityKey)}
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
