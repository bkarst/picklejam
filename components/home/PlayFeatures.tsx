import type { JSX, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { roundRobinLanding, leaguesHub, laddersHub, tournamentsHub } from "@/lib/urls";

/* ------------------------------------------------------------------ *
 * Home-page feature sections — Round Robin, Leagues, Tournaments.
 * Each is a full-bleed band with its own background wash, accent color,
 * and lifestyle photo, so the three read as distinct sections rather
 * than one flat scroll. A themed product-preview card floats over the
 * photo (HIG "Depth") to preview the real surface.
 * ------------------------------------------------------------------ */

type Point = { title: string; body: string };
type Cta = { label: string; href: string };

/**
 * Per-section visual identity. Every value is a complete literal class string
 * so Tailwind's scanner keeps them (never build these by concatenation).
 * Palette is green-forward, so sections are separated by hue *family*:
 * pickle-green → forest → hot-pink.
 */
type Theme = {
  /** Full-bleed band background. */
  band: string;
  /** Eyebrow pill background tint. */
  pill: string;
  /** Eyebrow dot + numbered-step background. */
  dot: string;
  /** Numbered-step fill + legible foreground. */
  step: string;
  /** Bottom-up gradient tint on the photo, tying it to the floating card. */
  scrim: string;
};

const THEMES = {
  roundRobin: {
    band: "bg-background",
    pill: "bg-success/15",
    dot: "bg-success",
    step: "bg-success text-white",
    scrim: "from-success/45",
  },
  leagues: {
    band: "bg-surface",
    pill: "bg-accent/12",
    dot: "bg-accent",
    step: "bg-accent text-accent-foreground",
    scrim: "from-accent/45",
  },
  tournaments: {
    band: "bg-secondary/[0.06]",
    pill: "bg-secondary/20",
    dot: "bg-secondary",
    step: "bg-secondary text-secondary-foreground",
    scrim: "from-secondary/45",
  },
} satisfies Record<string, Theme>;

/* ------------------------------ Layout ------------------------------ */

function FeatureSection({
  theme,
  eyebrow,
  title,
  body,
  points,
  primaryCta,
  secondaryCta,
  photo,
  card,
  reverse = false,
}: {
  theme: Theme;
  eyebrow: string;
  title: string;
  body: string;
  points: Point[];
  primaryCta: Cta;
  secondaryCta?: Cta;
  photo: { src: string; alt: string };
  card: ReactNode;
  reverse?: boolean;
}): JSX.Element {
  return (
    <section className={theme.band}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <div className={reverse ? "lg:order-2" : undefined}>
          <span
            className={`inline-flex items-center gap-2 rounded-full ${theme.pill} px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground`}
          >
            <span className={`size-1.5 rounded-full ${theme.dot}`} aria-hidden="true" />
            {eyebrow}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-xl text-lg text-muted">{body}</p>

          <ul className="mt-6 flex flex-col gap-4">
            {points.map((p, i) => (
              <li key={p.title} className="flex gap-3">
                <span
                  className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${theme.step}`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-display text-base font-bold text-foreground">{p.title}</p>
                  <p className="text-sm text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta && (
              <Link
                href={secondaryCta.href}
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-surface px-7 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>

        {/* Visual — photo panel with the product card floating over it */}
        <div className={reverse ? "lg:order-1" : undefined}>
          <FeatureVisual theme={theme} photo={photo}>
            {card}
          </FeatureVisual>
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({
  theme,
  photo,
  children,
}: {
  theme: Theme;
  photo: { src: string; alt: string };
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Lifestyle photo */}
      <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border border-border shadow-sm">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1024px) 42vw, (min-width: 640px) 32rem, 92vw"
          className="object-cover"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${theme.scrim} via-transparent to-transparent`} aria-hidden="true" />
      </div>
      {/* Floating product-preview card, overlapping the photo's lower edge */}
      <div className="relative z-10 -mt-14 mx-4 rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:-mt-16 sm:mx-8">
        {children}
      </div>
    </div>
  );
}

/* ------------------------- Product-card content ------------------------- */

/** Round robin: a live scoreboard the whole court follows from one link. */
function RoundRobinCard(): JSX.Element {
  const matches = [
    { court: "Court 1", a: "Ana & Ben", b: "Cam & Dee", sa: 11, sb: 7 },
    { court: "Court 2", a: "Eli & Fay", b: "Gus & Hana", sa: 9, sb: 8 },
    { court: "Court 3", a: "Ivy & Jo", b: "Kai & Liv", sa: 6, sb: 5 },
  ];
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-foreground">Round 3 of 6</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-foreground">
          <span className="inline-block size-2 animate-pulse rounded-full bg-success" aria-hidden="true" />
          Live
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {matches.map((m) => (
          <li
            key={m.court}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{m.court}</p>
              <p className="truncate text-sm text-foreground">
                {m.a} <span className="text-muted">vs</span> {m.b}
              </p>
            </div>
            <div className="flex items-center gap-1 font-display text-base font-bold tabular-nums">
              <span className={m.sa >= m.sb ? "text-foreground" : "text-muted"}>{m.sa}</span>
              <span className="text-muted">–</span>
              <span className={m.sb > m.sa ? "text-foreground" : "text-muted"}>{m.sb}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Leagues: division standings that update every week. */
function LeaguesCard(): JSX.Element {
  const rows = [
    { rank: 1, team: "Dinkers United", w: 6, l: 0 },
    { rank: 2, team: "Net Ninjas", w: 5, l: 1 },
    { rank: 3, team: "Kitchen Sinkers", w: 4, l: 2 },
    { rank: 4, team: "Third Shot Pros", w: 3, l: 3 },
  ];
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-foreground">3.5 Division</p>
        <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-muted">Week 6</span>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {rows.map((r) => (
          <li key={r.team} className="flex items-center gap-3 py-2.5">
            <span
              className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                r.rank === 1 ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-muted"
              }`}
            >
              {r.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{r.team}</span>
            <span className="font-display text-sm font-bold tabular-nums text-foreground">
              {r.w}–{r.l}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Tournaments: a live bracket everyone can follow on event day. */
function BracketTeam({ name, win = false }: { name: string; win?: boolean }): JSX.Element {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-semibold ${
        win ? "border-secondary/50 bg-secondary/10 text-foreground" : "border-border bg-background/60 text-muted"
      }`}
    >
      <span className="truncate">{name}</span>
    </div>
  );
}

function TournamentsCard(): JSX.Element {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-foreground">Mixed 4.0 · Bracket</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-semibold text-foreground">
          Semifinals
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Semifinals */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <BracketTeam name="Smash Bros" win />
            <BracketTeam name="Court Jesters" />
          </div>
          <div className="flex flex-col gap-1.5">
            <BracketTeam name="Paddle Batts" />
            <BracketTeam name="Rally Cats" win />
          </div>
        </div>
        {/* Connector */}
        <div className="flex h-full flex-col items-center justify-center text-muted" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6h6M9 18h6M15 6v12" />
          </svg>
        </div>
        {/* Final */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary/15 text-secondary" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 4H5a2 2 0 0 0 0 4h1M17 4h2a2 2 0 0 1 0 4h-1" />
            </svg>
          </span>
          <BracketTeam name="Smash Bros" win />
        </div>
      </div>
    </>
  );
}

/* ------------------------------- Section ------------------------------- */

export function PlayFeatures(): JSX.Element {
  return (
    <div>
      <FeatureSection
        theme={THEMES.roundRobin}
        eyebrow="Round Robin · Free"
        title="Run a round robin in minutes"
        body="Add your players, pick a format, and share one link. Everyone at the courts follows the schedule, live scores, and standings — no accounts, no spreadsheets."
        points={[
          { title: "Add your players", body: "Type names or paste a list — 4 to 24+, singles or doubles. Ratings optional." },
          { title: "Pick a format", body: "Round robin, mixer, Swiss, king of the court, or pools → bracket. Take the quiz if you're unsure." },
          { title: "Share the link", body: "You tap in scores from your phone; standings update live for everyone watching." },
        ]}
        primaryCta={{ label: "Create a round robin", href: roundRobinLanding() }}
        photo={{ src: "/images/home/roundrobin-crew.jpg", alt: "Four players' paddles and balls gathered on an outdoor court before a round robin" }}
        card={<RoundRobinCard />}
      />

      <FeatureSection
        reverse
        theme={THEMES.leagues}
        eyebrow="Leagues · Weekly"
        title="Join a league, play all season"
        body="Fixed teams, a set weekly schedule, and standings that mean something. Register with a partner or jump into the free-agent pool — we handle brackets, matchups, scheduling, and playoffs."
        points={[
          { title: "A reason to play weekly", body: "Same night, same crew, real matches — the easiest way to build a consistent game." },
          { title: "Balanced divisions", body: "Play others in your skill or DUPR range so every match stays competitive." },
          { title: "Standings & playoffs", body: "Track live standings all season, then chase the title in the playoffs." },
        ]}
        primaryCta={{ label: "Browse leagues", href: leaguesHub() }}
        secondaryCta={{ label: "Explore ladders", href: laddersHub() }}
        photo={{ src: "/images/home/leagues-team.jpg", alt: "League players meeting at the net under the lights after a weeknight match" }}
        card={<LeaguesCard />}
      />

      <FeatureSection
        theme={THEMES.tournaments}
        eyebrow="Tournaments · Compete"
        title="Find your next tournament"
        body="Register online in a couple of taps, pick your division, add a partner for doubles, and follow the live bracket on event day. From your first local event to the podium."
        points={[
          { title: "A division for you", body: "Skill and DUPR ranges for every level, in singles or doubles — you'll find your bracket." },
          { title: "Register in seconds", body: "Secure online registration and payment. Confirmation lands the moment you're in." },
          { title: "Follow the live bracket", body: "See who's up next and how far you've advanced, updated in real time." },
        ]}
        primaryCta={{ label: "Find tournaments", href: tournamentsHub() }}
        photo={{ src: "/images/home/tournaments-action.jpg", alt: "A player lunging to return a shot during a competitive pickleball match" }}
        card={<TournamentsCard />}
      />
    </div>
  );
}
