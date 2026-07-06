/**
 * City Leaderboard — `/leaderboards/[country]/[state]/[city]` (§G12.9). ISR(900).
 *
 * Most-active-players-by-RP board for a city, this month and last, plus a "your stats" tab.
 * Reuses the geo breadcrumb trail (Home → Courts → State → City → Leaderboard). Indexable at
 * ≥10 ranked players this month, else noindex (§14.4). `BreadcrumbList` + `ItemList` JSON-LD.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getState } from "@/lib/data/geo";
import { getCityBoard, prevMonth, cityBoardMonth } from "@/lib/data/gamify-boards";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { CityLeaderboardTabs } from "@/components/gamify/CityLeaderboardTabs";
import { toBoardRows } from "@/components/gamify/BoardTable";
import { nowMs } from "@/lib/directory/court-local-day";
import { stateAbbr } from "@/lib/geo/us-states";
import { brand } from "@/brand.config";

export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ country: string; state: string; city: string }>;

const INDEX_MIN = 10; // ≥10 ranked players ⇒ indexable (§14.4)

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  const path = `/leaderboards/${country}/${state}/${city}`;
  if (!cityItem) return buildMetadata({ title: "Not found", path, noindex: true });
  const board = await getCityBoard(cityItem.cityKey, cityBoardMonth(nowMs()));
  return buildMetadata({
    title: `Most active players in ${cityItem.name}`,
    description: `The pickleball players earning the most Rally Points in ${cityItem.name} this month.`,
    path,
    noindex: board.length < INDEX_MIN,
  });
}

export default async function CityLeaderboardPage({ params }: { params: Params }) {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  if (!cityItem) notFound();

  const month = cityBoardMonth(nowMs());
  const [stateItem, thisBoard, lastBoard] = await Promise.all([
    getState(country, state),
    getCityBoard(cityItem.cityKey, month),
    getCityBoard(cityItem.cityKey, prevMonth(month)),
  ]);

  const st = stateAbbr(state);
  const base = brand.siteUrl;
  const thisRows = toBoardRows(thisBoard);
  const lastRows = toBoardRows(lastBoard);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: stateItem?.name ?? state, url: `${base}/courts/${country}/${state}` },
            { name: cityItem.name, url: `${base}/courts/${country}/${state}/${city}` },
            { name: "Leaderboard", url: `${base}/leaderboards/${country}/${state}/${city}` },
          ]),
          ...(thisRows.length >= INDEX_MIN
            ? [
                {
                  "@context": "https://schema.org",
                  "@type": "ItemList",
                  name: `Most active players in ${cityItem.name}`,
                  itemListElement: thisRows.map((r) => ({
                    "@type": "ListItem",
                    position: r.rank,
                    name: r.displayName,
                    ...(r.username ? { url: `${base}/players/${r.username}` } : {}),
                  })),
                },
              ]
            : []),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courts", href: "/courts" },
          { name: stateItem?.name ?? state, href: `/courts/${country}/${state}` },
          { name: cityItem.name, href: `/courts/${country}/${state}/${city}` },
          { name: "Leaderboard" },
        ]}
      />

      <div className="mt-4">
        <h1 className="font-display text-3xl font-bold text-accent">Most active players in {cityItem.name}</h1>
        <p className="mt-1 text-muted">Rally Points earned this month · {cityItem.name}, {st}</p>
      </div>

      <div className="mt-6">
        <CityLeaderboardTabs thisMonth={thisRows} lastMonth={lastRows} />
      </div>

      <div className="mt-8 border-t border-border pt-4 text-sm">
        <Link href={`/courts/${country}/${state}/${city}`} className="font-semibold text-accent hover:underline">
          ← Courts in {cityItem.name}
        </Link>
      </div>
    </main>
  );
}
