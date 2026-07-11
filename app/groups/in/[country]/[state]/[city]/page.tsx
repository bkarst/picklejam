import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getCitiesByKeys } from "@/lib/data/geo";
import { getGroupsInCity } from "@/lib/data/groups";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { GroupCard } from "@/components/groups";
import { stateAbbr } from "@/lib/geo/us-states";
import {
  groupsHub,
  groupPath,
  groupNewPath,
  groupsCityPath,
  groupsCityPathFromKey,
} from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = Promise<{ country: string; state: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  const path = groupsCityPath(country, state, city);
  if (!cityItem) return buildMetadata({ title: "Groups not found", path, noindex: true });
  const st = stateAbbr(state);
  return buildMetadata({
    title: `Pickleball Groups & Clubs in ${cityItem.name}, ${st}`,
    description: `Find and join public pickleball groups and clubs in ${cityItem.name}, ${st}. Connect with regular crews, schedule meet-ups, and play more.`,
    path,
  });
}

export default async function CityGroupsPage({ params }: { params: Params }) {
  const { country, state, city } = await params;
  const cityItem = await getCity(country, state, city);
  if (!cityItem) notFound();

  const st = stateAbbr(state);
  const base = brand.siteUrl;
  const cityLabel = `${cityItem.name}, ${st}`;
  // PUBLIC groups only — private/unlisted are excluded from public finders (§6.9).
  const groups = await getGroupsInCity(cityItem.cityKey);
  const nearby = await getCitiesByKeys((cityItem.nearbyCityKeys ?? []).slice(0, 6));

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Groups", url: `${base}${groupsHub()}` },
            { name: cityLabel, url: `${base}${groupsCityPath(country, state, city)}` },
          ]),
          itemListJsonLd(groups.map((g) => ({ name: g.name, url: `${base}${groupPath(g.groupId)}` }))),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Groups", href: groupsHub() },
          { name: cityLabel },
        ]}
      />

      <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Pickleball Groups &amp; Clubs in {cityItem.name}, {st}
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Find your crew — join a public group, schedule meet-ups, and see who&apos;s looking to play.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-muted">
            {groups.length} public group{groups.length === 1 ? "" : "s"} in {cityItem.name}
          </p>

          {groups.length === 0 ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-8 text-sm text-muted">
              <p>No public groups in {cityItem.name} yet. Start the first one.</p>
              <Link
                href={groupNewPath()}
                className="inline-flex h-11 items-center rounded-full bg-secondary px-5 font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Start a group in {cityItem.name}
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {groups.map((g) => (
                <li key={g.groupId}>
                  <GroupCard
                    href={groupPath(g.groupId)}
                    name={g.name}
                    visibility={g.visibility}
                    memberCount={g.memberCount}
                    avatarUrl={g.avatarUrl}
                    cityLabel={cityLabel}
                    description={g.description}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Start your own group</h2>
            <p className="mt-1 text-sm text-muted">
              Bring your regulars together in one place — private and invite-only by default.
            </p>
            <Link
              href={groupNewPath()}
              className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Create a group
            </Link>
          </section>

          {nearby.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-bold text-foreground">Nearby cities</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {nearby.map((n) => (
                  <li key={n.cityKey}>
                    <Link
                      href={groupsCityPathFromKey(n.cityKey)}
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
