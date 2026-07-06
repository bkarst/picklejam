import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@heroui/react";
import { getUserByUsername, getUserRatings } from "@/lib/data/users";
import { getCitiesByKeys } from "@/lib/data/geo";
import { getCourt } from "@/lib/data/courts";
import { buildMetadata } from "@/lib/seo/metadata";
import { personJsonLd } from "@/lib/seo/jsonld";
import { profileIsIndexable } from "@/lib/seo/noindex";
import { JsonLd } from "@/components/JsonLd";
import { RatingTiles } from "@/components/account/RatingTiles";
import { primaryRating, skillBand } from "@/components/account/ratings";
import { stateAbbr } from "@/lib/geo/us-states";
import { courtUrl } from "@/lib/urls";
import { getGamifyProfile } from "@/lib/data/gamify";
import { getMyBadges } from "@/lib/data/gamify-badges";
import { levelName } from "@/lib/gamify/levels";
import { LevelChip } from "@/components/gamify/LevelChip";
import { BadgeTile } from "@/components/gamify/BadgeTile";
import type { UserProfileItem } from "@/lib/db/types";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ username: string }>;

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function memberSince(createdAt?: string): string | undefined {
  if (!createdAt) return undefined;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  const path = `/players/${username}`;
  if (!user) return buildMetadata({ title: "Player not found", path, noindex: true });
  return buildMetadata({
    title: `${user.displayName} — Pickleball Profile`,
    description: `${user.displayName}'s pickleball profile on PickleLoko — ratings, home court, and activity.`,
    path,
    noindex: !profileIsIndexable(user),
    openGraphType: "profile",
  });
}

/** Minimal, leak-free card for a private profile. */
function PrivateProfile({ user }: { user: UserProfileItem }) {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-10 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-secondary text-muted">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
        <h1 className="font-display text-2xl font-bold text-foreground">This profile is private</h1>
        <p className="max-w-sm text-muted">
          @{user.username} has chosen to keep their PickleLoko profile private.
        </p>
        <Link
          href="/players"
          className="inline-flex h-11 items-center rounded-full border border-border px-5 font-semibold text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Find other players
        </Link>
      </div>
    </main>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <span className="flex items-center gap-2 text-muted">
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={icon} />
        </svg>
        {label}
      </span>
      <span className="text-right font-semibold text-foreground">{children}</span>
    </div>
  );
}

const ICONS = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  bars: "M4 20V10M10 20V4M16 20v-7M20 20H2",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z",
};

export default async function PlayerProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  // Private profiles never leak fields, and are noindex (see generateMetadata).
  if (!profileIsIndexable(user)) return <PrivateProfile user={user} />;

  const [ratings, cities, homeCourt, gamify] = await Promise.all([
    getUserRatings(user.uid),
    user.homeCityKey ? getCitiesByKeys([user.homeCityKey]) : Promise.resolve([]),
    user.homeCourtId ? getCourt(user.homeCourtId) : Promise.resolve(undefined),
    getGamifyProfile(user.uid),
  ]);

  const city = cities[0];
  const location = city ? `${city.name}, ${stateAbbr(city.state)}` : undefined;
  const primary = primaryRating(ratings, user.defaultRatingSource);
  const band = skillBand(primary?.value);
  const since = memberSince(user.createdAt);

  // Gamification is public on public profiles, but suppressed if the owner turned it off (§G12.4).
  const gamifyOn = !!gamify && gamify.prefs.enabled;
  // Elite (§G11): a subtle gold profile ring + chip when the member holds any Elite year.
  const eliteYears = gamifyOn ? (gamify?.eliteYears ?? []) : [];
  const isElite = eliteYears.length > 0;
  const eliteLatest = isElite ? [...eliteYears].sort().at(-1) : undefined;
  const badgesView = gamifyOn
    ? await getMyBadges(user.uid, { ...gamify.counters, streakBest: gamify.streakBest }, gamify.showcase ?? [])
    : null;
  const showcaseBadges = (badgesView?.showcase ?? [])
    .map((id) => badgesView!.entries.find((e) => e.familyId === id))
    .filter((e): e is NonNullable<typeof e> => !!e && e.tier > 0);
  const earnedBadges = badgesView?.entries.filter((e) => e.tier > 0) ?? [];

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd data={personJsonLd(user, { cityName: city?.name })} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Header */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar className={`size-24 shrink-0 text-2xl sm:size-28${isElite ? " ring-4 ring-warning/70 ring-offset-2 ring-offset-surface" : ""}`}>
                {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt={user.displayName} />}
                <Avatar.Fallback className="bg-accent text-accent-foreground">
                  {initials(user.displayName)}
                </Avatar.Fallback>
              </Avatar>

              <div className="flex min-w-0 flex-col gap-3">
                <div>
                  <h1 className="font-display text-3xl font-bold text-accent sm:text-4xl">
                    {user.displayName}
                  </h1>
                  {location && (
                    <p className="mt-1 flex items-center gap-1.5 text-muted">
                      <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={ICONS.pin} />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      {location}
                    </p>
                  )}
                  {gamifyOn && gamify && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <LevelChip level={gamify.level} name={levelName(gamify.level)} />
                      {isElite && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-sm font-semibold text-warning">
                          <span aria-hidden="true">🏆</span> Elite{eliteLatest ? ` ${eliteLatest}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <RatingTiles ratings={ratings} />
                {showcaseBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2" aria-label="Pinned badges">
                    {showcaseBadges.map((b) => (
                      <BadgeTile key={b.familyId} name={b.name} tier={b.tier} tierName={b.tierName} earned size="sm" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Recent activity — populated in Stage 3/4; empty state for now. */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-bold text-foreground">Recent activity</h2>
            <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-muted">
              No public activity yet — check-ins and outings will show up here.
            </div>
          </section>

          {/* Reviews written — Stage 3; empty state for now. */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-bold text-foreground">Reviews</h2>
            <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-muted">
              {user.displayName.split(" ")[0]} hasn&apos;t written any court reviews yet.
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-accent">
              Details
            </h2>
            <dl className="mt-2">
              <DetailRow icon={ICONS.home} label="Home court">
                {homeCourt ? (
                  <Link href={courtUrl(homeCourt)} className="text-accent hover:underline">
                    {homeCourt.name}
                  </Link>
                ) : (
                  <span className="text-muted">Not set</span>
                )}
              </DetailRow>
              <DetailRow icon={ICONS.clock} label="Member since">
                {since ?? <span className="text-muted">—</span>}
              </DetailRow>
              <DetailRow icon={ICONS.bars} label="Skill band">
                {band ?? <span className="text-muted">Unrated</span>}
              </DetailRow>
              {gamifyOn && gamify && (
                <DetailRow icon={ICONS.bars} label="Level">
                  {gamify.level} · {levelName(gamify.level)}
                </DetailRow>
              )}
              {gamifyOn && gamify && gamify.streakWeeks > 0 && (
                <DetailRow icon={ICONS.clock} label="Play streak">
                  {gamify.streakWeeks} {gamify.streakWeeks === 1 ? "week" : "weeks"}
                </DetailRow>
              )}
            </dl>
          </section>

          {/* Achievement badges — the trophy case (§G12.4-I4). */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-accent">
              Achievement badges
            </h2>
            {earnedBadges.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {earnedBadges.length} {earnedBadges.length === 1 ? "badge" : "badges"} earned
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {earnedBadges.map((b) => (
                    <BadgeTile key={b.familyId} name={b.name} tier={b.tier} tierName={b.tierName} earned />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Badges are earned by playing, hosting, and reviewing. None yet — the courts are calling.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
