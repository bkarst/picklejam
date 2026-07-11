import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLadder } from "@/lib/data/ladders";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { formatMoney, type Money } from "@/lib/money";
import { buildMetadata } from "@/lib/seo/metadata";
import { ladderEventJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { EditableEntityAvatar } from "@/components/ui/EditableEntityAvatar";
import { LadderBoard } from "@/components/ladders";
import { formatDateRange, playModeLabel } from "@/components/leagues/format";
import {
  ladderPath,
  ladderRegisterPath,
  ladderChallengesPath,
  laddersHub,
  laddersCityPath,
} from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 600;
export const dynamicParams = true;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getLadder(id);
  const path = ladderPath(id);
  if (!data) return buildMetadata({ title: "Ladder not found", path, noindex: true });
  const { ladder } = data;
  return buildMetadata({
    title: `${ladder.title} — Pickleball Ladder`,
    description:
      ladder.description?.trim() ||
      `Join ${ladder.title}, an ongoing ${playModeLabel(ladder.playMode)} pickleball ladder. Membership ${formatMoney(ladder.price as Money)}.`,
    path,
    openGraphType: "article",
    noindex: ladder.status === "draft" || ladder.status === "cancelled",
  });
}

export default async function LadderBoardPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getLadder(id);
  if (!data) notFound();

  const { ladder, rungs } = data;
  const base = brand.siteUrl;
  const registerable = ladder.status === "published";

  let cityName: string | undefined;
  let stateCode: string | undefined;
  let cityHref: string | undefined;
  if (ladder.cityKey) {
    const { country, state, city } = parseCityKey(ladder.cityKey);
    const cityItem = await getCity(country, state, city);
    cityName = cityItem?.name ?? city.replace(/-/g, " ");
    stateCode = stateAbbr(state);
    cityHref = laddersCityPath(country, state, city);
  }
  const cityLabel = cityName ? `${cityName}${stateCode ? `, ${stateCode}` : ""}` : undefined;

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Ladders", url: `${base}${laddersHub()}` },
            ...(cityHref ? [{ name: cityLabel ?? "City", url: `${base}${cityHref}` }] : []),
            { name: ladder.title, url: `${base}${ladderPath(id)}` },
          ]),
          ladderEventJsonLd(ladder, { url: ladderPath(id), cityName, stateCode, venueName: ladder.venueName }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Ladders", href: laddersHub() },
          ...(cityHref ? [{ name: cityLabel ?? "City", href: cityHref }] : []),
          { name: ladder.title },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <span className="inline-flex rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-foreground">
            {registerable ? "Open to join" : ladder.status === "cancelled" ? "Cancelled" : ladder.status === "complete" ? "Complete" : "Draft"}
          </span>
          <div className="mt-3 flex items-center gap-4">
            <EditableEntityAvatar
              name={ladder.title}
              avatarUrl={ladder.avatarUrl}
              organizerId={ladder.organizerId}
              patchUrl={`/api/ladders/${ladder.lid}`}
              fallback={
                <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" /></svg>
              }
              className="size-16 sm:size-20"
            />
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{ladder.title}</h1>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span>{playModeLabel(ladder.playMode)} ladder</span>
            <span>· Starts {formatDateRange(ladder.startDate)}</span>
            {(ladder.venueName || cityLabel) && <span>· {ladder.venueName ?? cityLabel}</span>}
          </div>

          <section className="mt-8">
            <h2 className="font-display text-2xl font-bold text-foreground">The board</h2>
            <p className="mt-1 text-sm text-muted">{rungs.length} player{rungs.length === 1 ? "" : "s"} · updated after every confirmed challenge.</p>
            <div className="mt-4">
              <LadderBoard rungs={rungs} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Membership</h2>
            <p className="mt-3 text-sm text-muted">
              <span className="font-display text-3xl font-bold text-accent">{formatMoney(ladder.price as Money)}</span> to join
            </p>
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Challenge range</dt>
                <dd className="text-right font-medium text-foreground">±{ladder.challengeRange} rungs</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Response window</dt>
                <dd className="text-right font-medium text-foreground">{ladder.responseWindowDays} days</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              {registerable ? (
                <Link href={ladderRegisterPath(id)} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Join the ladder</Link>
              ) : (
                <span className="inline-flex h-12 w-full items-center justify-center rounded-full bg-surface-secondary px-6 text-base font-semibold text-muted">{ladder.status === "cancelled" ? "Cancelled" : "Closed"}</span>
              )}
              <Link href={ladderChallengesPath(id)} className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">My challenges</Link>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">How the ladder works</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
              <li>Challenge anyone up to {ladder.challengeRange} rung{ladder.challengeRange === 1 ? "" : "s"} above you.</li>
              <li>They have {ladder.responseWindowDays} day{ladder.responseWindowDays === 1 ? "" : "s"} to respond or forfeit.</li>
              <li>Win to take their rung — the board re-ranks automatically.</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
