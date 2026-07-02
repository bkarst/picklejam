import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCourtBySlug, getNearbyCourts } from "@/lib/data/courts";
import { getCity, getState, getCitiesByKeys } from "@/lib/data/geo";
import { getCourtCheckinsToday } from "@/lib/data/checkins";
import { getCourtReviews } from "@/lib/data/reviews";
import { getCourtGames } from "@/lib/data/outings";
import { courtLocalDay, nowMs } from "@/lib/directory/court-local-day";
import { UpcomingGamesGrid } from "@/components/outings/UpcomingGamesGrid";
import { buildMetadata, courtTitle } from "@/lib/seo/metadata";
import { courtJsonLd, faqPageJsonLd, breadcrumbListJsonLd, reviewJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CourtCard } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { AdSlot } from "@/components/ads/AdSlot";
import { CheckInSheet } from "@/components/community/CheckInSheet";
import { CheckedInTodayList } from "@/components/community/CheckedInTodayList";
import { ReviewsModule } from "@/components/community/ReviewsModule";
import { FollowButton } from "@/components/community/FollowButton";
import { cityUrlFromKey, courtUrl, metersToMiles } from "@/lib/urls";
import { stateAbbr } from "@/lib/geo/us-states";
import { surfaceFeatures, courtFaq } from "@/lib/directory/court-content";
import { brand } from "@/brand.config";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ country: string; state: string; city: string; court: string }>;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city, court } = await params;
  const c = await getCourtBySlug(country, state, city, court);
  const path = `/courts/${country}/${state}/${city}/${court}`;
  if (!c) return buildMetadata({ title: "Not found", path, noindex: true });
  return buildMetadata({
    title: courtTitle(c.name),
    description:
      c.description?.trim() ||
      `Play pickleball at ${c.name} — ${c.totalCourts} court(s), schedule, amenities, and reviews.`,
    path,
    ogImage: c.photos?.find((p) => p.visible)?.url,
    noindex: c.indexable === false,
  });
}

export default async function CourtDetailPage({ params }: { params: Params }) {
  const { country, state, city, court } = await params;
  const courtItem = await getCourtBySlug(country, state, city, court);
  if (!courtItem) notFound();

  const today = courtLocalDay(courtItem);
  const [cityItem, stateItem, nearbyCourts, checkinsToday, reviewsPage, courtGames] = await Promise.all([
    getCity(country, state, city),
    getState(country, state),
    getNearbyCourts(courtItem),
    getCourtCheckinsToday(courtItem.courtId, today),
    getCourtReviews(courtItem.courtId, { sort: "recent", limit: 20 }),
    getCourtGames(courtItem.courtId),
  ]);
  // Bucket upcoming games into a Today→+6d week grid (court-local days).
  const DAY_MS = 86_400_000;
  const startMs = nowMs();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = courtLocalDay(courtItem, startMs + i * DAY_MS);
    return {
      date: day,
      games: courtGames.filter((g) => courtLocalDay(courtItem, Date.parse(g.startTs)) === day),
    };
  });
  const cityName = cityItem?.name ?? court;
  const st = stateAbbr(state);
  const base = brand.siteUrl;
  const nearbyCities = await getCitiesByKeys((cityItem?.nearbyCityKeys ?? []).slice(0, 5));
  const faq = courtFaq(courtItem);
  const features = surfaceFeatures(courtItem);
  const reviews = reviewsPage.items;
  const photos = (courtItem.photos ?? []).filter((p) => p.visible);
  const hero = photos[0];
  const tags = [
    courtItem.access ? cap(courtItem.access) : null,
    (courtItem.indoorCourts ?? 0) > 0 ? "Indoor" : null,
    (courtItem.outdoorCourts ?? 0) > 0 ? "Outdoor" : null,
    courtItem.lighted ? "Lighted" : null,
    courtItem.dedicated ? "Dedicated" : null,
  ].filter(Boolean) as string[];

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: stateItem?.name ?? state, url: `${base}/courts/${country}/${state}` },
            { name: cityName, url: `${base}/courts/${country}/${state}/${city}` },
            { name: courtItem.name, url: `${base}${courtUrl(courtItem)}` },
          ]),
          courtJsonLd(courtItem, { cityName, stateCode: st }),
          faqPageJsonLd(faq),
          ...reviews.map((r) =>
            reviewJsonLd(
              { rating1to5: r.rating1to5, title: r.title, body: r.body, createdAt: r.createdAt },
              courtItem.name,
            ),
          ),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courts", href: "/courts" },
          { name: stateItem?.name ?? state, href: `/courts/${country}/${state}` },
          { name: cityName, href: `/courts/${country}/${state}/${city}` },
          { name: courtItem.name },
        ]}
      />

      {/* Header */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-surface-secondary">
          {hero ? (
            <Image src={hero.url} alt={courtItem.name} fill className="object-cover" sizes="(max-width:1024px) 100vw, 50vw" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent/15 to-brand-lime/25 text-muted">
              No photo yet
            </div>
          )}
          {hero?.attribution?.name && (
            <span className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 text-[10px] text-white">
              © {hero.attribution.name}
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="font-display text-3xl font-bold text-accent sm:text-4xl">{courtItem.name}</h1>
          <p className="mt-1 text-muted">
            {courtItem.totalCourts} court{courtItem.totalCourts === 1 ? "" : "s"} · {cityName}, {st}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-secondary px-3 py-1 text-sm text-foreground">
                {t}
              </span>
            ))}
          </div>
          {/* Follow + Check In (auth-gated; check-in also allows anonymous) */}
          <div className="mt-4 flex flex-wrap gap-3">
            <FollowButton courtId={courtItem.courtId} />
            <CheckInSheet courtId={courtItem.courtId} />
          </div>
          {/* Community band */}
          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div><dt className="inline text-muted">Players </dt><dd className="inline font-semibold text-foreground">{courtItem.playerCount ?? 0}</dd></div>
            <div><dt className="inline text-muted">Games </dt><dd className="inline font-semibold text-foreground">{courtItem.gamesCount ?? 0}</dd></div>
            <div><dt className="inline text-muted">Reviews </dt><dd className="inline font-semibold text-foreground">{courtItem.reviewCount ?? 0}</dd></div>
            <div><dt className="inline text-muted">Groups </dt><dd className="inline font-semibold text-foreground">{courtItem.groupCount ?? 0}</dd></div>
          </dl>
          {/* Checked in today (day-fresh, no live polling) */}
          {checkinsToday.length > 0 && (
            <div className="mt-4">
              <CheckedInTodayList checkins={checkinsToday} count={checkinsToday.length} />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          {courtItem.description?.trim() && (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">About</h2>
              <p className="mt-2 text-muted">{courtItem.description}</p>
            </section>
          )}

          {features.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">Surface &amp; Features</h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-foreground">
                    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(courtItem.openPlay?.length ?? 0) > 0 ? (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">Open-play schedule</h2>
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {courtItem.openPlay!.map((b, i) => (
                  <li key={i} className="text-foreground">
                    <span className="font-medium">{DAYS[b.dayOfWeek]}</span> · {b.start}–{b.end}
                    {b.skillMin != null && ` · ${b.skillMin}–${b.skillMax}`}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            courtItem.scheduleDetails?.trim() && (
              <section>
                <h2 className="font-display text-xl font-bold text-foreground">Schedule</h2>
                <p className="mt-2 text-muted">{courtItem.scheduleDetails}</p>
              </section>
            )
          )}

          {/* Upcoming Games — weekly grid + "+ add a game" on-ramp (§6.7) */}
          <section>
            <h2 className="font-display text-xl font-bold text-foreground">Upcoming games</h2>
            <div className="mt-3">
              <UpcomingGamesGrid days={weekDays} courtId={courtItem.courtId} />
            </div>
          </section>

          {/* Reviews — crawlable server-rendered list + client composer (§6.4).
              Review + AggregateRating JSON-LD emitted above. */}
          <section>
            <h2 className="font-display text-xl font-bold text-foreground">Reviews</h2>
            <div className="mt-3">
              <ReviewsModule
                courtId={courtItem.courtId}
                initialReviews={reviews}
                ratingAvg={courtItem.ratingAvg ?? 0}
                reviewCount={courtItem.reviewCount ?? 0}
              />
            </div>
          </section>

          <AdSlot kind="below-content" />

          {faq.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">Court FAQ</h2>
              <div className="mt-3"><FaqAccordion items={faq} /></div>
            </section>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-display text-lg font-bold text-foreground">Location &amp; Contact</h2>
            {courtItem.address && <p className="mt-2 text-sm text-muted">{courtItem.address}</p>}
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {courtItem.address && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${courtItem.lat},${courtItem.lng}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                  Directions
                </a>
              )}
              {courtItem.phone && <a href={`tel:${courtItem.phone}`} className="text-foreground hover:underline">{courtItem.phone}</a>}
              {courtItem.website && (
                <a href={courtItem.website} target="_blank" rel="noopener noreferrer" className="truncate text-accent hover:underline">
                  {courtItem.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {courtItem.hasReservations && courtItem.reservationUrl && (
                <a href={courtItem.reservationUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover">
                  Reserve a court
                </a>
              )}
            </div>
          </section>

          {nearbyCourts.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby courts</h2>
              <ul className="mt-3 flex flex-col gap-4">
                {nearbyCourts.map((n) => (
                  <li key={n.courtId}>
                    <CourtCard court={n} distanceMi={metersToMiles(n.distanceMeters)} variant="grid" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {nearbyCities.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby cities</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {nearbyCities.map((n) => (
                  <li key={n.cityKey}>
                    <Link href={cityUrlFromKey(n.cityKey)} className="flex items-baseline justify-between gap-2 hover:underline">
                      <span className="font-medium text-foreground">{n.name}, {stateAbbr(n.state)}</span>
                      <span className="text-muted">{n.counts?.locations ?? 0} locations</span>
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
