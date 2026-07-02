import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeague } from "@/lib/data/leagues";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { StandingsSchedule } from "@/components/leagues";
import { leaguePath, leagueStandingsPath, leaguesHub } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 600;
export const dynamicParams = true;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getLeague(id);
  const path = leagueStandingsPath(id);
  if (!data) return buildMetadata({ title: "Standings", path, noindex: true });
  return buildMetadata({
    title: `Standings & Schedule — ${data.league.title}`,
    description: `Live standings, weekly schedule, and playoff bracket for ${data.league.title}.`,
    path,
    noindex: data.league.status === "draft" || data.league.status === "cancelled",
  });
}

export default async function LeagueStandingsPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getLeague(id);
  if (!data) notFound();

  const { league, divisions, teams, schedule, standings } = data;
  const base = brand.siteUrl;

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={breadcrumbListJsonLd([
          { name: "Home", url: base },
          { name: "Leagues", url: `${base}${leaguesHub()}` },
          { name: league.title, url: `${base}${leaguePath(id)}` },
          { name: "Standings", url: `${base}${leagueStandingsPath(id)}` },
        ])}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Leagues", href: leaguesHub() },
          { name: league.title, href: leaguePath(id) },
          { name: "Standings" },
        ]}
      />

      <h1 className="mt-3 font-display text-3xl font-bold text-foreground sm:text-4xl">{league.title}</h1>
      <p className="mt-1 text-muted">Standings, schedule &amp; playoffs</p>

      <div className="mt-8">
        <StandingsSchedule
          league={league}
          divisions={divisions}
          teams={teams}
          schedule={schedule}
          standings={standings}
        />
      </div>
    </main>
  );
}
