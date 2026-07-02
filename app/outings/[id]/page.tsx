import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOuting } from "@/lib/data/outings";
import { getCourt } from "@/lib/data/courts";
import { getCity } from "@/lib/data/geo";
import { getUserProfile } from "@/lib/data/users";
import { getForecast } from "@/lib/weather";
import { nextOccurrences } from "@/lib/outings/rrule";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { buildMetadata } from "@/lib/seo/metadata";
import { sportsEventJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { RsvpControl } from "@/components/outings/RsvpControl";
import { WeatherChip } from "@/components/outings/WeatherChip";
import { formatOutingDate, formatTimeRange, formatSkillRange } from "@/components/outings/format";
import { courtUrl, cityGamesPath, outingPath } from "@/lib/urls";
import { brand } from "@/brand.config";
import type { RsvpItem, UserProfileItem } from "@/lib/db/types";

export const revalidate = 600;
export const dynamicParams = true;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getOuting(id);
  const path = outingPath(id);
  if (!data?.outing) return buildMetadata({ title: "Game not found", path, noindex: true });
  const { outing } = data;
  const court = await getCourt(outing.courtId);
  const courtName = court?.name;
  return buildMetadata({
    title: courtName ? `${outing.title} at ${courtName}` : outing.title,
    description:
      outing.description?.trim() ||
      `${outing.type === "open" ? "Open play" : "A pickleball game"} on ${formatOutingDate(outing.startTs, outing.tz)}${courtName ? ` at ${courtName}` : ""}. RSVP on ${brand.identity.name}.`,
    path,
    openGraphType: "article",
    // Private / unlisted outings are reachable by link but never indexed (§3.7).
    noindex: outing.visibility !== "public",
  });
}

/** Map a WMO weather-interpretation code to a short condition label. */
function wmoCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

function Avatar({ profile }: { profile?: UserProfileItem }): JSX.Element {
  if (profile?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted">
      {profile ? initials(profile.displayName) : "?"}
    </span>
  );
}

function RsvpList({
  title,
  rows,
  users,
  organizerId,
  showPosition = false,
  emptyLabel,
}: {
  title: string;
  rows: RsvpItem[];
  users: Map<string, UserProfileItem>;
  organizerId: string;
  showPosition?: boolean;
  emptyLabel?: string;
}): JSX.Element {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">
        {title} ({rows.length})
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyLabel ?? "No one yet."}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r, i) => {
            const p = users.get(r.uid);
            return (
              <li key={r.uid} className="flex items-center gap-3">
                <Avatar profile={p} />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {p?.displayName ?? "Player"}
                  {r.uid === organizerId && <span className="ml-1 text-xs font-normal text-muted">(Host)</span>}
                </span>
                {showPosition && (
                  <span className="shrink-0 text-xs font-semibold text-muted">
                    #{r.waitlistPos ?? i + 1}
                  </span>
                )}
                {r.guestCount ? (
                  <span className="shrink-0 text-xs text-muted">
                    +{r.guestCount} guest{r.guestCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default async function OutingDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getOuting(id);
  if (!data?.outing) notFound();
  const { outing, rsvps } = data;

  const { country, state, city } = parseCityKey(outing.cityKey);
  const [court, cityItem] = await Promise.all([getCourt(outing.courtId), getCity(country, state, city)]);
  const cityName = cityItem?.name ?? city.replace(/-/g, " ");
  const st = stateAbbr(state);
  const base = brand.siteUrl;

  // Hydrate RSVP + host identities (bounded by capacity).
  const uids = [...new Set([outing.organizerId, ...rsvps.map((r) => r.uid)])];
  const profiles = await Promise.all(uids.map((u) => getUserProfile(u)));
  const users = new Map<string, UserProfileItem>();
  for (const p of profiles) if (p) users.set(p.uid, p);
  const host = users.get(outing.organizerId);

  const going = rsvps.filter((r) => r.status === "going");
  const maybe = rsvps.filter((r) => r.status === "maybe");
  const declined = rsvps.filter((r) => r.status === "declined");
  const waitlist = rsvps
    .filter((r) => r.status === "waitlist")
    .sort((a, b) => (a.waitlistPos ?? 0) - (b.waitlistPos ?? 0));

  const goingCount = outing.goingCount ?? going.length;

  // Weather: outdoor courts only. Pick the forecast day matching the game's date
  // and reduce it to the chip's { tempF, condition } shape (null hides the chip).
  const isOutdoor = (court?.outdoorCourts ?? 0) > 0;
  const forecastDays = isOutdoor && court ? await getForecast(court.lat, court.lng) : null;
  const dayStr = new Date(outing.startTs).toLocaleDateString(
    "en-CA",
    outing.tz ? { timeZone: outing.tz } : undefined,
  );
  const fday = forecastDays?.find((f) => f.date === dayStr) ?? forecastDays?.[0] ?? null;
  const weather = fday ? { tempF: fday.tempMax, condition: wmoCondition(fday.weatherCode) } : null;

  const occurrences = outing.rrule
    ? nextOccurrences(outing.rrule, outing.startTs, new Date().toISOString(), 6)
    : [];

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: `${cityName} games`, url: `${base}${cityGamesPath(country, state, city)}` },
            ...(court ? [{ name: court.name, url: `${base}${courtUrl(court)}` }] : []),
            { name: outing.title, url: `${base}${outingPath(id)}` },
          ]),
          sportsEventJsonLd(outing, {
            courtName: court?.name ?? "Pickleball court",
            url: outingPath(id),
            cityName,
            stateCode: st,
          }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: `${cityName} games`, href: cityGamesPath(country, state, city) },
          ...(court ? [{ name: court.name, href: courtUrl(court) }] : []),
          { name: outing.title },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-accent">
            <span>{outing.type === "open" ? "Open Play" : "Private"}</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <span className="text-foreground">{formatOutingDate(outing.startTs, outing.tz)}</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <span className="text-foreground">
              {formatTimeRange(outing.startTs, outing.endTs, outing.tz)}
            </span>
          </p>

          <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
            {outing.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Hosted by <span className="font-semibold text-foreground">{host?.displayName ?? "the organizer"}</span>
          </p>

          {/* Court card */}
          {court && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link
                  href={courtUrl(court)}
                  className="font-display text-lg font-bold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {court.name} →
                </Link>
                {court.address && <p className="mt-1 text-sm text-muted">{court.address}</p>}
                <p className="mt-1 text-xs text-muted">
                  {court.totalCourts} court{court.totalCourts === 1 ? "" : "s"}
                  {isOutdoor ? " · Outdoor" : ""}
                  {(court.indoorCourts ?? 0) > 0 ? " · Indoor" : ""}
                  {court.lighted ? " · Lights" : ""}
                </p>
              </div>
              {court.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${court.lat},${court.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Directions
                </a>
              )}
            </div>
          )}

          {/* Quick facts + weather */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="text-sm">
              <span className="text-muted">Skill </span>
              <span className="font-semibold text-foreground">
                {formatSkillRange(outing.skillMin, outing.skillMax)}
              </span>
            </div>
            {typeof outing.capacity === "number" && outing.capacity > 0 && (
              <div className="text-sm">
                <span className="text-muted">Spots </span>
                <span className="font-semibold text-foreground">{outing.capacity}</span>
              </div>
            )}
            <WeatherChip forecast={weather} />
          </div>

          {/* About */}
          {outing.description?.trim() && (
            <section className="mt-6">
              <h2 className="font-display text-xl font-bold text-foreground">About</h2>
              <p className="mt-2 whitespace-pre-line text-muted">{outing.description}</p>
            </section>
          )}

          {/* Recurring series */}
          {outing.rrule && occurrences.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-lg font-bold text-foreground">This series</h2>
              <p className="mt-1 text-sm text-muted">Recurring game. Upcoming dates:</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {occurrences.map((o) => {
                  const d = new Date(o);
                  return (
                    <li
                      key={d.toISOString()}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Private access note */}
          {outing.visibility === "private" && (
            <p className="mt-6 rounded-xl border border-secondary/40 bg-secondary/5 p-4 text-sm text-muted">
              This is a private game — only people with the invite link can view and RSVP.
            </p>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          {/* Who's coming */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">
              Who&apos;s coming{" "}
              <span className="text-muted">
                ({goingCount}
                {typeof outing.capacity === "number" && outing.capacity > 0 ? `/${outing.capacity}` : ""})
              </span>
            </h2>
            <div className="mt-4 flex flex-col gap-5">
              <RsvpList title="Going" rows={going} users={users} organizerId={outing.organizerId} emptyLabel="Be the first to say you're in." />
              {maybe.length > 0 && (
                <RsvpList title="Maybe" rows={maybe} users={users} organizerId={outing.organizerId} />
              )}
              {waitlist.length > 0 && (
                <RsvpList title="Waitlist" rows={waitlist} users={users} organizerId={outing.organizerId} showPosition />
              )}
              {declined.length > 0 && (
                <RsvpList title="Can't make it" rows={declined} users={users} organizerId={outing.organizerId} />
              )}
            </div>
          </section>

          {/* RSVP */}
          <RsvpControl
            outingId={outing.outingId}
            capacity={outing.capacity}
            goingCount={goingCount}
            waitlistCount={outing.waitlistCount ?? waitlist.length}
            waitlistEnabled={Boolean(outing.waitlist)}
            guestPolicy={outing.guestPolicy}
          />

          {/* Add to calendar */}
          <a
            href={`${outingPath(id)}/calendar.ics`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Add to calendar
          </a>
        </aside>
      </div>
    </main>
  );
}
