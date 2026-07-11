import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTournament } from "@/lib/data/tournaments";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/directory";
import { RegisterPanel } from "@/components/tournaments";
import { tournamentPath, tournamentRegisterPath, tournamentsHub } from "@/lib/urls";
import { publicEnv } from "@/lib/env";
import { ComingSoon } from "@/components/ui/ComingSoon";
import type { FeeConfig } from "@/lib/money";

// A payment surface that reads ?division — render dynamically per request (no ISR)
// to avoid a prod hydration mismatch, and NEVER place an ad here (§2.2).
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ division?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getTournament(id);
  const path = tournamentRegisterPath(id);
  if (!data) return buildMetadata({ title: "Register", path, noindex: true });
  return buildMetadata({
    title: `Register — ${data.tourney.title}`,
    description: `Register for ${data.tourney.title}.`,
    path,
    noindex: true, // checkout is never indexed
  });
}

export default async function TournamentRegisterPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  if (!publicEnv.paidEventsEnabled) return <ComingSoon />;
  const { id } = await params;
  const { division } = await searchParams;
  const data = await getTournament(id);
  if (!data) notFound();
  const { tourney, divisions } = data;

  const initialDid = Array.isArray(division) ? division[0] : division;

  let cityLabel: string | undefined;
  if (tourney.cityKey) {
    const { country, state, city } = parseCityKey(tourney.cityKey);
    const cityItem = await getCity(country, state, city);
    const name = cityItem?.name ?? city.replace(/-/g, " ");
    cityLabel = `${name}, ${stateAbbr(state)}`;
  }

  const feeConfig: FeeConfig = {
    mode: tourney.feeMode,
    percentBps: tourney.feePercentBps,
    fixed: tourney.feeFixed,
  };

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tournaments", href: tournamentsHub() },
          { name: tourney.title, href: tournamentPath(id) },
          { name: "Register" },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Tournament registration
      </h1>
      <p className="mt-1 text-muted">{tourney.title}</p>

      {divisions.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          This tournament isn&apos;t accepting registrations yet.
        </p>
      ) : (
        <div className="mt-8">
          <RegisterPanel
            tid={id}
            title={tourney.title}
            startDate={tourney.startDate}
            endDate={tourney.endDate}
            cityLabel={cityLabel}
            divisions={divisions}
            feeConfig={feeConfig}
            initialDid={initialDid}
          />
        </div>
      )}
    </main>
  );
}
