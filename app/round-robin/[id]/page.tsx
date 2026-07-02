import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRrEvent } from "@/lib/data/roundrobin";
import { buildMetadata } from "@/lib/seo/metadata";
import { softwareApplicationJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { StandingsTable, BracketView, TvStandings, formatMeta } from "@/components/roundrobin";
import { roundRobinPath, roundRobinLanding, roundRobinLivePath } from "@/lib/urls";
import { brand } from "@/brand.config";
import type { Entrant, Match, RrRound } from "@/lib/roundrobin/types";
import { EventActions } from "./EventActions";

// Public + indexable, and always fresh: a live scoreboard should reflect the
// latest scores immediately, and this page reads `searchParams` (?tv=1). Render
// dynamically per request — SSR keeps it crawlable while every viewer sees the
// current standings.
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type Search = Promise<{ tv?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getRrEvent(id);
  const path = roundRobinPath(id);
  if (!data) return buildMetadata({ title: "Round robin not found", path, noindex: true });
  const { event } = data;
  const meta = formatMeta(event.format);
  return buildMetadata({
    title: `${event.title} — Round Robin Scoreboard`,
    description: `Live scoreboard and standings for ${event.title}, a ${meta.name.toLowerCase()} pickleball round robin. Built free on ${brand.identity.name}.`,
    path,
  });
}

function statusLabel(status: string): string {
  return status === "complete" ? "Final" : status === "running" ? "In progress" : "Not started";
}

/** Read-only match line for the public board. */
function MatchRow({ match, names }: { match: Match; names: Map<string, string> }): JSX.Element {
  const a = match.sideA.map((x) => names.get(x) ?? x).join(" / ");
  const b = match.sideB.map((x) => names.get(x) ?? x).join(" / ");
  const done = typeof match.scoreA === "number" && typeof match.scoreB === "number";
  const aWins = done && (match.scoreA ?? 0) > (match.scoreB ?? 0);
  const bWins = done && (match.scoreB ?? 0) > (match.scoreA ?? 0);
  return (
    <li className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="inline-flex h-7 min-w-14 shrink-0 items-center justify-center rounded-md bg-accent/10 px-2 text-xs font-semibold text-accent">
        {match.court ? `Court ${match.court}` : (match.label ?? "Match")}
      </span>
      <span className={`min-w-0 flex-1 truncate ${aWins ? "font-bold text-foreground" : "text-foreground"}`}>{a}</span>
      <span className="shrink-0 tabular-nums font-semibold text-foreground">
        {done ? `${match.scoreA}–${match.scoreB}` : "–"}
      </span>
      <span className={`min-w-0 flex-1 truncate text-right ${bWins ? "font-bold text-foreground" : "text-foreground"}`}>{b}</span>
    </li>
  );
}

function RoundBlock({ round, names }: { round: RrRound; names: Map<string, string> }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-bold text-foreground">
          {round.label ?? `Round ${round.round}`}
        </h3>
      </div>
      <ul className="divide-y divide-border">
        {round.matches.map((m) => (
          <MatchRow key={m.id} match={m} names={names} />
        ))}
      </ul>
      {round.byes.length > 0 && (
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          Sitting out: {round.byes.map((id) => names.get(id) ?? id).join(", ")}
        </p>
      )}
    </div>
  );
}

export default async function RoundRobinEventPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const { tv } = await searchParams;
  const data = await getRrEvent(id);
  if (!data) notFound();

  const { event, entrants, rounds, standings } = data;
  const names = new Map<string, string>((entrants as Entrant[]).map((e) => [e.id, e.name]));
  const meta = formatMeta(event.format);
  const base = brand.siteUrl;
  const isTv = (Array.isArray(tv) ? tv[0] : tv) === "1";
  const champ = event.championId ? (names.get(event.championId) ?? null) : null;

  // TV mode: a big, glanceable board for the venue screen.
  if (isTv) {
    return (
      <main id="main" className="flex-1">
        <TvStandings
          title={event.title}
          subtitle={`${meta.name} · ${statusLabel(event.status)}`}
          standings={standings}
          entrants={entrants}
          championId={event.championId}
        />
        <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-8">
          <Link
            href={roundRobinPath(id)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            Exit TV mode
          </Link>
        </div>
      </main>
    );
  }

  const bracketMatches: Match[] =
    event.format === "poolsBracket"
      ? rounds.flatMap((r) => r.matches).filter((m) => m.label != null && !/^pool/i.test(m.label))
      : [];

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Round Robin", url: `${base}${roundRobinLanding()}` },
            { name: event.title, url: `${base}${roundRobinPath(id)}` },
          ]),
          softwareApplicationJsonLd({ name: event.title, url: roundRobinPath(id) }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Round Robin", href: roundRobinLanding() },
          { name: event.title },
        ]}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-accent">
            <span>{meta.name}</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <span className="text-foreground">{event.mode === "doubles" ? "Doubles" : "Singles"}</span>
            <span aria-hidden="true" className="text-muted">·</span>
            <span className="text-muted">{statusLabel(event.status)}</span>
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">{event.title}</h1>
        </div>
        <Link
          href={`${roundRobinPath(id)}?tv=1`}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
          TV mode
        </Link>
      </div>

      {champ && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <svg viewBox="0 0 24 24" className="size-8 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" /></svg>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Champion</p>
            <p className="font-display text-xl font-bold text-foreground">{champ}</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Standings + bracket */}
        <div className="lg:col-span-2">
          <h2 className="font-display text-2xl font-bold text-foreground">Standings</h2>
          <div className="mt-4">
            <StandingsTable standings={standings} entrants={entrants} championId={event.championId} />
          </div>

          {bracketMatches.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-2xl font-bold text-foreground">Bracket</h2>
              <div className="mt-4">
                <BracketView matches={bracketMatches} entrants={entrants} />
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-display text-2xl font-bold text-foreground">Rounds</h2>
            {rounds.length === 0 ? (
              <p className="mt-3 text-muted">The schedule will appear here once the event starts.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {rounds.map((r) => (
                  <RoundBlock key={r.round} round={r} names={names} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Share this board</h2>
            <p className="mt-1 text-sm text-muted">
              Anyone with the link sees live standings and scores — no sign-up needed.
            </p>
            <div className="mt-4">
              <EventActions eventId={id} claimed={Boolean(event.organizerId)} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Running this event?</h2>
            <p className="mt-1 text-sm text-muted">Enter scores round by round from the run console.</p>
            <Link
              href={roundRobinLivePath(id)}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Open run console
            </Link>
          </section>

          <section className="rounded-2xl border border-secondary/40 bg-secondary/5 p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Make your own</h2>
            <p className="mt-1 text-sm text-muted">Build a free round robin in a couple of minutes.</p>
            <Link
              href={roundRobinLanding()}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Create a round robin
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
