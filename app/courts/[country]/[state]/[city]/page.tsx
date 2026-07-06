import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getState, getCitiesByKeys } from "@/lib/data/geo";
import { getCourtsInCity, getCourt } from "@/lib/data/courts";
import { getCityGames } from "@/lib/data/outings";
import { getCityBoard, cityBoardMonth } from "@/lib/data/gamify-boards";
import { getCityCommunityQuest } from "@/lib/data/gamify-community";
import { CommunityQuestBar } from "@/components/gamify/CommunityQuestBar";
import { CityActiveTeaser } from "@/components/gamify/CityActiveTeaser";
import { courtLocalDay, nowMs } from "@/lib/directory/court-local-day";
import { OutingCard } from "@/components/outings/OutingCard";
import { cityGamesPath, cityLeaderboardPath } from "@/lib/urls";
import { buildMetadata, cityTitle } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CourtCard, StatLine, CourtsGamesToggle } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { AdSlot } from "@/components/ads/AdSlot";
import { cityUrlFromKey, courtUrl, courtTypePath } from "@/lib/urls";
import { stateAbbr } from "@/lib/geo/us-states";
import { citySubtitle, cityFaq } from "@/lib/directory/city-content";
import { brand } from "@/brand.config";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ country: string; state: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  if (!cityItem)
    return buildMetadata({ title: "Not found", path: `/courts/${country}/${state}/${city}`, noindex: true });
  const st = stateAbbr(state);
  const locations = cityItem.counts?.locations ?? 0;
  return buildMetadata({
    title: cityTitle(locations, cityItem.name, st),
    description: citySubtitle(cityItem.name, locations, cityItem.counts?.courts ?? 0),
    path: `/courts/${country}/${state}/${city}`,
  });
}

export default async function CityPage({ params }: { params: Params }) {
  const { country, state, city } = await params;
  const [cityItem, stateItem, courts] = await Promise.all([
    getCity(country, state, city),
    getState(country, state),
    getCourtsInCity(country, state, city),
  ]);
  if (!cityItem) notFound();

  const st = stateAbbr(state);
  const base = brand.siteUrl;
  const locations = cityItem.counts?.locations ?? courts.length;
  const totalCourts = cityItem.counts?.courts ?? courts.reduce((s, c) => s + c.totalCourts, 0);
  const nearby = await getCitiesByKeys((cityItem.nearbyCityKeys ?? []).slice(0, 6));
  const faq = cityFaq(cityItem.name, courts);
  const cityDay = courtLocalDay(
    { lat: cityItem.centroidLat, lng: cityItem.centroidLng ?? -98 },
    nowMs(),
  );
  const upcomingGames = (await getCityGames(cityItem.cityKey, cityDay)).slice(0, 3);
  // Gamification aside modules (§G12.8): a live community quest + the city RP board teaser.
  const cityMonth = cityBoardMonth(nowMs());
  const [communityQuest, cityBoard] = await Promise.all([
    getCityCommunityQuest(cityItem.cityKey, nowMs()),
    getCityBoard(cityItem.cityKey, cityMonth),
  ]);
  // Hydrate the (≤3) games' court names so the cards link to the venue.
  const upcomingCourts = new Map(
    (
      await Promise.all(
        [...new Set(upcomingGames.map((g) => g.courtId))].map(async (cid) => {
          const c = await getCourt(cid);
          return c ? ([cid, { name: c.name, href: courtUrl(c) }] as const) : null;
        }),
      )
    ).filter(Boolean) as [string, { name: string; href: string }][],
  );

  const popularSearches = [
    { label: "Indoor", href: courtTypePath("indoor") },
    { label: "Outdoor", href: courtTypePath("outdoor") },
    { label: "Lighted", href: courtTypePath("lighted") },
    { label: "Dedicated", href: courtTypePath("dedicated") },
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: stateItem?.name ?? state, url: `${base}/courts/${country}/${state}` },
            { name: cityItem.name, url: `${base}/courts/${country}/${state}/${city}` },
          ]),
          itemListJsonLd(courts.map((c) => ({ name: c.name, url: `${base}${courtUrl(c)}` }))),
          faqPageJsonLd(faq),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courts", href: "/courts" },
          { name: stateItem?.name ?? state, href: `/courts/${country}/${state}` },
          { name: cityItem.name },
        ]}
      />

      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
        {cityTitle(locations, cityItem.name, st)}
      </h1>
      <p className="mt-2 max-w-3xl text-muted">
        {citySubtitle(cityItem.name, locations, totalCourts)}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <StatLine
          items={[
            { value: `${cityItem.name}, ${st}`, label: "" },
            { value: locations, label: "Locations" },
            { value: totalCourts, label: "Courts" },
          ]}
        />
        <CourtsGamesToggle mode="courts" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Court list */}
        <div className="lg:col-span-2">
          {courts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center text-muted">
              No courts listed in {cityItem.name} yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {courts.map((court, i) => (
                <li key={court.courtId}>
                  <CourtCard court={court} index={i} variant="list" />
                </li>
              ))}
            </ul>
          )}
          <AdSlot kind="in-feed" className="mt-6" />
        </div>

        {/* Aside */}
        <aside className="flex flex-col gap-6">
          {/* Community quest (§G12.8-I1) — server frame + client-hydrated live progress */}
          {communityQuest && (
            <CommunityQuestBar
              questId={communityQuest.questId}
              month={cityMonth}
              title={communityQuest.title}
              goal={communityQuest.goal ?? communityQuest.rule.target}
              initialProgress={communityQuest.progress ?? 0}
            />
          )}

          {/* Upcoming games in the city (§6.7) → full finder at /play */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">Upcoming games in {cityItem.name}</h2>
              <Link href={cityGamesPath(country, state, city)} className="text-sm font-semibold text-accent hover:underline">
                See all →
              </Link>
            </div>
            {upcomingGames.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-3">
                {upcomingGames.map((g) => (
                  <li key={g.outingId}>
                    <OutingCard outing={g} court={upcomingCourts.get(g.courtId) ?? null} />
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">No games scheduled today.</p>
                <Link href="/outings/new" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
                  Host the first game →
                </Link>
              </>
            )}
          </section>

          {/* Tournaments & leagues — Stage 6/7 */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-bold text-foreground">Tournaments &amp; leagues in {cityItem.name}</h2>
            <p className="mt-2 text-sm text-muted">Nothing scheduled yet.</p>
            <Link href="/organize/tournaments/new" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
              Run a tournament →
            </Link>
          </section>

          {/* Most active this month (§G12.8-I2) — hidden below 3 ranked players */}
          {cityBoard.length >= 3 && (
            <CityActiveTeaser board={cityBoard} cityName={cityItem.name} leaderboardHref={cityLeaderboardPath(country, state, city)} />
          )}

          {/* Popular searches */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-bold text-foreground">Popular searches</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {popularSearches.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Nearby cities */}
          {nearby.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby cities to play</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {nearby.map((n) => (
                  <li key={n.cityKey}>
                    <Link href={cityUrlFromKey(n.cityKey)} className="flex items-baseline justify-between gap-2 text-sm hover:underline">
                      <span className="font-medium text-foreground">
                        {n.name}, {stateAbbr(n.state)}
                      </span>
                      <span className="text-muted">{n.counts?.locations ?? 0} locations</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {/* City FAQ */}
      {faq.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-2xl font-bold text-foreground">Pickleball in {cityItem.name}: FAQ</h2>
          <div className="mt-4">
            <FaqAccordion items={faq} />
          </div>
        </section>
      )}
    </main>
  );
}
