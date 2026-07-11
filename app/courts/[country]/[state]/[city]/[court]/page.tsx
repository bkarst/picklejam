import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCourtBySlug, getNearbyCourts, courtFacilityScore } from "@/lib/data/courts";
import { getCity, getState } from "@/lib/data/geo";
import { getCourtCheckinsToday } from "@/lib/data/checkins";
import { getCourtReviews } from "@/lib/data/reviews";
import { getCourtGames } from "@/lib/data/outings";
import { getGroupsAtCourt } from "@/lib/data/groups";
import { getCourtCrew, getCourtStatus } from "@/lib/data/gamify-crew";
import { hydrateReviewAuthors } from "@/lib/data/gamify-reviews";
import { getCourtBoard } from "@/lib/data/gamify-boards";
import { CourtStatusLine } from "@/components/gamify/CourtStatusLine";
import { CourtCrewSection } from "@/components/gamify/CourtCrewSection";
import { courtLocalDay, nowMs } from "@/lib/directory/court-local-day";
import { UpcomingGamesGrid } from "@/components/outings/UpcomingGamesGrid";
import { GroupsRail } from "@/components/groups";
import { buildMetadata, courtTitle } from "@/lib/seo/metadata";
import { courtJsonLd, faqPageJsonLd, breadcrumbListJsonLd, reviewJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CourtCard, FacilityRating, SurfaceFeatures } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { AdSlot } from "@/components/ads/AdSlot";
import { CheckInSheet } from "@/components/community/CheckInSheet";
import { CheckedInTodayList } from "@/components/community/CheckedInTodayList";
import { ReviewsModule } from "@/components/community/ReviewsModule";
import { WriteReviewButton } from "@/components/community/WriteReviewButton";
import { StarsDisplay } from "@/components/community/Stars";
import { FollowButton } from "@/components/community/FollowButton";
import { courtUrl, metersToMiles, groupsCityPath } from "@/lib/urls";
import { formatPhone, telHref } from "@/lib/util/phone";
import { stateAbbr } from "@/lib/geo/us-states";
import { courtSpecs, courtAmenities, courtFaq } from "@/lib/directory/court-content";
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
  const boardMonth = today.slice(0, 6);
  const [cityItem, stateItem, nearbyCourts, checkinsToday, reviewsPage, courtGames, groupsHere, crew, courtBoard, courtStatus] =
    await Promise.all([
      getCity(country, state, city),
      getState(country, state),
      getNearbyCourts(courtItem),
      getCourtCheckinsToday(courtItem.courtId, today),
      getCourtReviews(courtItem.courtId, { sort: "recent", limit: 20 }),
      getCourtGames(courtItem.courtId),
      // PUBLIC groups whose home/play court is this venue (§9.5 #28) — private
      // groups are filtered out server-side, so the rail is safe on a public page.
      getGroupsAtCourt(courtItem.courtId),
      // Gamification social proof (§G12.1): Court Crew, this-month board, status line.
      getCourtCrew(courtItem.courtId, boardMonth),
      getCourtBoard(courtItem.courtId, boardMonth),
      getCourtStatus(courtItem),
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
  const faq = courtFaq(courtItem);
  const specs = courtSpecs(courtItem);
  const amenities = courtAmenities(courtItem);
  const reviews = reviewsPage.items;
  // Review-card author chips (§G12.16) — public reviewers get name · level · Crew.
  const reviewAuthors = await hydrateReviewAuthors(courtItem.courtId, reviews, boardMonth);
  const photos = (courtItem.photos ?? []).filter((p) => p.visible);
  const hero = photos[0];
  const tags = [
    courtItem.access ? cap(courtItem.access) : null,
    (courtItem.indoorCourts ?? 0) > 0 ? "Indoor" : null,
    (courtItem.outdoorCourts ?? 0) > 0 ? "Outdoor" : null,
    courtItem.lighted ? "Lighted" : null,
    courtItem.dedicated ? "Dedicated" : null,
  ].filter(Boolean) as string[];
  // Facility-quality score (setup-only, §9.8). Prefer the value denormalized at
  // ingest; fall back to computing live for any court not yet backfilled.
  const facility =
    courtItem.facilityScore != null && courtItem.facilityTier != null
      ? { score: courtItem.facilityScore, tier: courtItem.facilityTier }
      : courtFacilityScore(courtItem);

  return (
    // White page surface (overrides the app's cream canvas), full-bleed.
    <main id="main" className="flex-1 bg-surface">
      <div className="mx-auto w-full max-w-7xl px-4 py-8">
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

      {/* Hero (design 4.5) — identity + review CTA + Location & Contact, compact photo */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Compact photo — deliberately small so the identity + review CTA lead */}
            <div className="relative aspect-[4/3] w-full max-w-64 shrink-0 overflow-hidden rounded-2xl bg-surface-secondary sm:w-64">
              {hero ? (
                <Image src={hero.url} alt={courtItem.name} fill className="object-cover" sizes="256px" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent/15 to-brand-lime/25 p-2 text-center text-sm text-muted">
                  No photo yet
                </div>
              )}
              {hero?.attribution?.name && (
                <span className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 text-[10px] text-white">
                  © {hero.attribution.name}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
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

              {/* Location & Contact — under the title (§4.5) */}
              {(courtItem.address || courtItem.phone || courtItem.website || (courtItem.hasReservations && courtItem.reservationUrl)) && (
                <div className="mt-4 flex flex-col gap-1.5 text-sm">
                  {courtItem.address && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${courtItem.lat},${courtItem.lng}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {courtItem.address}
                      <ExternalIcon />
                    </a>
                  )}
                  {courtItem.phone && <a href={telHref(courtItem.phone)} className="text-foreground hover:underline">{formatPhone(courtItem.phone)}</a>}
                  {courtItem.website && (
                    <a href={courtItem.website} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center text-accent hover:underline">
                      <span className="truncate">{courtItem.website.replace(/^https?:\/\//, "")}</span>
                      <ExternalIcon />
                    </a>
                  )}
                  {courtItem.hasReservations && courtItem.reservationUrl && (
                    <a href={courtItem.reservationUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex h-10 items-center justify-center self-start rounded-full bg-accent px-4 font-semibold text-accent-foreground hover:bg-accent-hover">
                      Reserve a court
                      <ExternalIcon />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status line (§G12.1-I1) — Captain + Trailblazer, JS-off complete */}
          <CourtStatusLine status={courtStatus} />
          {/* Checked in today (day-fresh, no live polling) */}
          {checkinsToday.length > 0 && (
            <CheckedInTodayList checkins={checkinsToday} count={checkinsToday.length} />
          )}
        </div>

        {/* Action panel (no title) — facility rating + reviews + Check In / Write a review / Follow (§4.5) */}
        <section className="flex flex-col gap-3 self-start rounded-2xl border border-border bg-surface p-4 lg:col-span-1">
          {/* Objective facility-quality score (setup, not reviews) */}
          <FacilityRating score={facility.score} tier={facility.tier} />
          <div className="h-px bg-border" />
          {(courtItem.reviewCount ?? 0) > 0 ? (
            <a href="#reviews" className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <span className="font-display text-2xl font-bold text-foreground">{(courtItem.ratingAvg ?? 0).toFixed(1)}</span>
              <StarsDisplay rating={courtItem.ratingAvg ?? 0} size="md" />
              <span className="text-sm text-muted underline-offset-2 hover:underline">
                {courtItem.reviewCount} review{courtItem.reviewCount === 1 ? "" : "s"}
              </span>
            </a>
          ) : (
            <p className="text-center text-sm text-muted">Be the first to review this court</p>
          )}
          <CheckInSheet courtId={courtItem.courtId} courtName={courtItem.name} triggerClassName="w-full" />
          <WriteReviewButton className="w-full" />
          <FollowButton courtId={courtItem.courtId} className="flex w-full flex-col gap-1" triggerClassName="w-full" />
        </section>
      </div>

      {/* Body */}
      <div className="mt-8">
        <div className="flex flex-col gap-8">
          {courtItem.description?.trim() && (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">About</h2>
              <p className="mt-2 text-muted">{courtItem.description}</p>
            </section>
          )}

          {(specs.length > 0 || amenities.length > 0) && (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">Surface &amp; Features</h2>
              <SurfaceFeatures specs={specs} amenities={amenities} />
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

          {/* Groups that play here — PUBLIC groups only; self-hides when empty (§6.9) */}
          <GroupsRail
            groups={groupsHere}
            title="Groups that play here"
            cityLabel={`${cityName}, ${st}`}
            courtNames={{ [courtItem.courtId]: courtItem.name }}
            seeAllHref={groupsCityPath(country, state, city)}
            seeAllLabel={`All groups in ${cityName}`}
          />

          {/* Court Crew (§G12.1-I2) — local credibility directly above the reviews it boosts */}
          <CourtCrewSection
            courtId={courtItem.courtId}
            crew={crew}
            board={courtBoard}
            leaderboardHref={`${courtUrl(courtItem)}/leaderboard`}
          />

          {/* Reviews — crawlable server-rendered list + client composer (§6.4).
              Review + AggregateRating JSON-LD emitted above. */}
          <section id="reviews" className="scroll-mt-24">
            <h2 className="font-display text-xl font-bold text-foreground">Reviews</h2>
            <div className="mt-3">
              <ReviewsModule
                courtId={courtItem.courtId}
                initialReviews={reviews}
                ratingAvg={courtItem.ratingAvg ?? 0}
                reviewCount={courtItem.reviewCount ?? 0}
                authors={reviewAuthors}
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
      </div>

      {/* Nearby courts — a horizontal, scrollable row at the foot of the page */}
      {nearbyCourts.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold text-foreground">Nearby courts</h2>
          <ul className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {nearbyCourts.map((n) => (
              <li key={n.courtId} className="w-64 shrink-0 snap-start">
                <CourtCard court={n} distanceMi={metersToMiles(n.distanceMeters)} variant="grid" />
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </main>
  );
}

/** "Opens in a new window" affordance for external (target="_blank") links. */
function ExternalIcon() {
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="ml-1 inline-block size-3.5 shrink-0 align-[-0.125em]"
      >
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
      <span className="sr-only"> (opens in a new window)</span>
    </>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
