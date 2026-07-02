import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournament } from "@/lib/data/tournaments";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { BracketRenderer, bracketFromItems, defaultRoundLabels } from "@/components/brackets/BracketRenderer";
import { formatDateRange } from "@/components/tournaments/format";
import { tournamentPath, tournamentBracketPath, tournamentsHub } from "@/lib/urls";
import { brand } from "@/brand.config";
import type { BracketMatchItem } from "@/lib/db/types";

// The live bracket reads ?division and must reflect the latest scores → render
// dynamically per request (SSR keeps it crawlable) rather than ISR, avoiding a
// prod hydration mismatch (docs/next-conventions.md).
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ division?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getTournament(id);
  const path = tournamentBracketPath(id);
  if (!data) return buildMetadata({ title: "Bracket not found", path, noindex: true });
  return buildMetadata({
    title: `${data.tourney.title} — Live Bracket & Results`,
    description: `Live bracket, scores, and results for ${data.tourney.title}.`,
    path,
  });
}

/** Champion = the winner of the highest-round complete match, if any. */
function championName(matches: BracketMatchItem[], names: Map<string, string>): string {
  if (matches.length === 0) return "TBD";
  const maxRound = Math.max(...matches.map((m) => m.round));
  const final = matches.find((m) => m.round === maxRound);
  if (!final || typeof final.scoreA !== "number" || typeof final.scoreB !== "number") return "TBD";
  const side = final.scoreA > final.scoreB ? final.sideA : final.sideB;
  if (!side || side.length === 0) return "TBD";
  return side.map((s) => names.get(s) ?? s).join(" / ");
}

export default async function TournamentBracketPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const { division } = await searchParams;
  const data = await getTournament(id);
  if (!data) notFound();

  const { tourney, divisions, bracket, registrations } = data;
  const base = brand.siteUrl;

  // Divisions that actually have a bracket.
  const seeded = new Set(bracket.map((m) => m.did));
  const withBracket = divisions.filter((d) => seeded.has(d.did));
  const requested = Array.isArray(division) ? division[0] : division;
  const activeDid =
    requested && seeded.has(requested) ? requested : withBracket[0]?.did ?? divisions[0]?.did;

  // Best-effort name map (uid → registrant handle). Falls back to the id.
  const names = new Map<string, string>();
  for (const r of registrations) if (r.partnerUid) names.set(r.uid, `${r.uid} / ${r.partnerUid}`);

  const divMatches = bracket.filter((m) => m.did === activeDid);
  const normalized = bracketFromItems(divMatches, names);
  const rounds = normalized.length > 0 ? Math.max(...normalized.map((m) => m.round)) : 0;
  const labels = defaultRoundLabels(rounds);
  const champ = championName(divMatches, names);

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={breadcrumbListJsonLd([
          { name: "Home", url: base },
          { name: "Tournaments", url: `${base}${tournamentsHub()}` },
          { name: tourney.title, url: `${base}${tournamentPath(id)}` },
          { name: "Bracket", url: `${base}${tournamentBracketPath(id)}` },
        ])}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tournaments", href: tournamentsHub() },
          { name: tourney.title, href: tournamentPath(id) },
          { name: "Bracket" },
        ]}
      />

      <div className="mt-4 flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
          {tourney.title}
        </h1>
        <p className="text-sm text-muted">
          {formatDateRange(tourney.startDate, tourney.endDate)} · Live bracket &amp; results
        </p>
      </div>

      {/* Division switcher */}
      {withBracket.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Division">
          {withBracket.map((d) => {
            const active = d.did === activeDid;
            return (
              <Link
                key={d.did}
                href={tournamentBracketPath(id, d.did)}
                aria-current={active ? "true" : undefined}
                className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "border border-border text-foreground hover:bg-surface-secondary"
                }`}
              >
                {d.name}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {normalized.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            The bracket will appear here once the organizer seeds this division.
          </div>
        ) : (
          <BracketRenderer
            matches={normalized}
            roundLabels={labels}
            championLabel={champ}
            caption={`${tourney.title} bracket`}
          />
        )}
      </div>
    </main>
  );
}
