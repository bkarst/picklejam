import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGroup } from "@/lib/data/groups";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { buildMetadata } from "@/lib/seo/metadata";
import { sportGroupJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { GroupMeetups } from "@/components/groups/GroupMeetups";
import { GroupDetailClient } from "./GroupDetailClient";
import { PrivateGroupView } from "./PrivateGroupView";
import { visibilityMeta, memberCountLabel } from "@/components/groups/format";
import { GroupAvatar } from "@/components/groups";
import { groupsHub, groupsCityPath, groupPath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getGroup(id);
  const path = groupPath(id);
  if (!data) return buildMetadata({ title: "Group not found", path, noindex: true });
  const { group } = data;
  // A PRIVATE group must not leak its name/description in the (cached, shared) tab
  // title or link-unfurl description — it renders behind a members-only client gate.
  if (group.visibility === "private") {
    return buildMetadata({ title: "Private group", path, noindex: true });
  }
  // Unlisted groups are viewable-by-URL but never indexed (§6.9).
  const isPublic = group.visibility === "public";
  return buildMetadata({
    title: `${group.name} — Pickleball Group`,
    description:
      group.description?.trim() ||
      `${group.name} is a pickleball group with ${memberCountLabel(group.memberCount)}. See upcoming meet-ups and who's looking to play.`,
    path,
    openGraphType: "profile",
    noindex: !isPublic,
  });
}

export default async function GroupDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) notFound();

  const { group, courts } = data;
  const base = brand.siteUrl;
  const isPublic = group.visibility === "public";
  const isPrivate = group.visibility === "private";
  const vis = visibilityMeta(group.visibility);

  // A PRIVATE group is members-only. The server (Bearer-only auth) can't identify the
  // viewer and this shell is cached + shared, so NOTHING group-specific is rendered
  // here — the whole view is delivered client-side via the authenticated `useGroup`,
  // which 404s non-members. The breadcrumb stays generic to avoid leaking the name.
  if (isPrivate) {
    return (
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Groups", href: groupsHub() },
            { name: "Private group" },
          ]}
        />
        <PrivateGroupView groupId={id} joinPolicy={group.joinPolicy} />
      </main>
    );
  }

  // City label + finder link.
  let cityName: string | undefined;
  let stateCode: string | undefined;
  let cityHref: string | undefined;
  if (group.cityKey) {
    const { country, state, city } = parseCityKey(group.cityKey);
    const cityItem = await getCity(country, state, city);
    cityName = cityItem?.name ?? city.replace(/-/g, " ");
    stateCode = stateAbbr(state);
    cityHref = groupsCityPath(country, state, city);
  }
  const cityLabel = cityName ? `${cityName}${stateCode ? `, ${stateCode}` : ""}` : undefined;
  const homeCourtName = group.homeCourtId ? courts?.[group.homeCourtId]?.name : undefined;

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Groups", url: `${base}${groupsHub()}` },
            ...(isPublic && cityHref ? [{ name: cityLabel ?? "City", url: `${base}${cityHref}` }] : []),
            { name: group.name, url: `${base}${groupPath(id)}` },
          ]),
          // Public groups only: SportsOrganization (identity). Meet-ups are members-only
          // (§6.9), so they are NOT emitted to crawlers — no meet-up ItemList here.
          ...(isPublic
            ? [
                sportGroupJsonLd(group, {
                  url: groupPath(id),
                  cityName,
                  stateCode,
                  memberCount: group.memberCount,
                }),
              ]
            : []),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Groups", href: groupsHub() },
          ...(cityHref ? [{ name: cityLabel ?? "City", href: cityHref }] : []),
          { name: group.name },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${vis.tone}`}>
              {group.visibility === "public" ? (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              )}
              {vis.label}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Group</span>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <GroupAvatar name={group.name} avatarUrl={group.avatarUrl} className="size-16 sm:size-20" />
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{group.name}</h1>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
              {memberCountLabel(group.memberCount)}
            </span>
            {(homeCourtName || cityLabel) && (
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
                {homeCourtName ? `${homeCourtName}${cityLabel ? ` · ${cityLabel}` : ""}` : cityLabel}
              </span>
            )}
          </div>

          {group.description?.trim() && (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">About</p>
              <p className="mt-1 text-sm text-foreground">{group.description}</p>
            </div>
          )}

          {/* Upcoming meet-ups — MEMBERS-ONLY, loaded client-side (never in this shared
              ISR shell), so a non-member never sees a meet-up's place or time (§6.9). */}
          <GroupMeetups groupId={id} />
        </div>

        {/* Sidebar — per-viewer membership + live roster (CSR overlay) */}
        <aside>
          <GroupDetailClient groupId={id} joinPolicy={group.joinPolicy} />
        </aside>
      </div>
    </main>
  );
}
