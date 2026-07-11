/**
 * Hub building blocks — the shared Pickle Jam "sticker" layout used by the
 * marketing hubs (tournaments, ladders, leagues, round robin, groups).
 *
 * The look comes from the design system: `.pj-sticker` cards (2px ink outline +
 * hard offset shadow), pink overline eyebrows, uppercase display titles, and a
 * color-blocked motif panel. Keep these the single source for that style so all
 * hubs stay identical — see app/<hub>/page.tsx for usage.
 */
import type { JSX, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/brand.config";

// ── Actions ──────────────────────────────────────────────────────────────────

export type HubActionVariant = "primary" | "outline" | "ghost";
export interface HubAction {
  href: string;
  label: string;
  variant?: HubActionVariant;
  /** Optional leading icon (an SVG element). */
  icon?: ReactNode;
}

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

// rounded-full + bg-/border- → uppercased + bolded by the global button rule.
// Exported so one-off CTAs (e.g. a page's closing call-to-action) match the hero.
export const hubButtonClass: Record<HubActionVariant, string> = {
  primary: `inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary px-7 text-base text-secondary-foreground transition-transform hover:-translate-y-0.5 ${FOCUS}`,
  outline: `inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-foreground px-7 text-base text-foreground transition-transform hover:-translate-y-0.5 ${FOCUS}`,
  // Not a pill → intentionally stays sentence-case (a text link, per the DS).
  ghost: `inline-flex h-12 items-center gap-1 text-base font-semibold text-accent hover:underline ${FOCUS}`,
};

function Actions({ actions }: { actions: HubAction[] }): JSX.Element {
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3">
      {actions.map((a) => (
        <Link key={a.href + a.label} href={a.href} className={hubButtonClass[a.variant ?? "primary"]}>
          {a.icon}
          {a.label}
        </Link>
      ))}
    </div>
  );
}

// ── Overline ─────────────────────────────────────────────────────────────────

/** Eyebrow overline (DS SectionHeading) — hot pink, uppercase, wide tracking. */
export function Overline({ children }: { children: ReactNode }): JSX.Element {
  return <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">{children}</p>;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export type HubPanelTone = "lime" | "pink" | "softPink";
const PANEL_TONE: Record<HubPanelTone, string> = {
  lime: "bg-brand-lime",
  pink: "bg-secondary",
  softPink: "bg-brand-bubblegum",
};

/**
 * Sticker feature hero: content + a side panel (DS signature). The panel is
 * either a color-blocked `motif` (SVG) or a full-bleed `image` (stock photo).
 */
export function HubHero({
  overline,
  title,
  body,
  actions,
  motif,
  motifTone = "lime",
  image,
}: {
  overline: string;
  title: ReactNode;
  body: ReactNode;
  actions: HubAction[];
  motif?: ReactNode;
  motifTone?: HubPanelTone;
  image?: { src: string; alt: string };
}): JSX.Element {
  return (
    <section className="pj-sticker-lg mt-4 flex flex-col overflow-hidden rounded-[1.5rem] bg-surface md:flex-row">
      <div className="flex-1 p-6 sm:p-10">
        <Overline>{overline}</Overline>
        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[0.95] text-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-muted">{body}</p>
        <Actions actions={actions} />
      </div>
      {image ? (
        // Photos read best in a squarer frame than the narrow motif panel.
        <div className="relative min-h-[240px] shrink-0 border-t-2 border-foreground md:min-h-full md:w-96 md:border-l-2 md:border-t-0">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className={`flex min-h-[150px] items-center justify-center border-t-2 border-foreground p-6 md:min-h-full md:w-72 md:border-l-2 md:border-t-0 ${PANEL_TONE[motifTone]}`}
        >
          {motif}
        </div>
      )}
    </section>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

export interface HubStep {
  title: string;
  body: string;
}

// Number badges cycle the brand triad (pink → lime → ink).
const STEP_TONES = ["pink", "lime", "ink"] as const;

function StepCard({ n, title, body, tone }: { n: number; title: string; body: string; tone: (typeof STEP_TONES)[number] }): JSX.Element {
  const badge =
    tone === "pink"
      ? "bg-secondary text-secondary-foreground"
      : tone === "lime"
        ? "bg-brand-lime"
        : "bg-accent text-accent-foreground";
  // The lime badge always sits on a lime fill → force court-green digits (both themes).
  const limeStyle = tone === "lime" ? { color: brand.palette.courtGreen } : undefined;
  return (
    <li className="pj-sticker rounded-2xl bg-surface p-6">
      <span
        className={`inline-flex size-11 items-center justify-center rounded-full font-display text-lg ${badge}`}
        style={limeStyle}
      >
        {n}
      </span>
      <h3 className="mt-4 font-display text-xl text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </li>
  );
}

const STEP_COLS: Record<number, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

/** "How it works" — a row of sticker step cards with brand-triad number badges. */
export function HubSteps({
  overline = "Get started",
  title = "How it works",
  steps,
}: {
  overline?: string;
  title?: string;
  steps: HubStep[];
}): JSX.Element {
  const cols = STEP_COLS[steps.length] ?? "sm:grid-cols-3";
  return (
    <section className="mt-12">
      <Overline>{overline}</Overline>
      <h2 className="mt-2 font-display text-3xl text-foreground">{title}</h2>
      <ol className={`mt-6 grid grid-cols-1 gap-5 ${cols}`}>
        {steps.map((s, i) => (
          <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} tone={STEP_TONES[i % STEP_TONES.length]} />
        ))}
      </ol>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

export interface HubFaqItem {
  question: string;
  answer: string;
}

/** FAQ — a single sticker card with 2px dividers between questions. */
export function HubFaq({
  overline = "Good to know",
  title = "Frequently asked questions",
  faqs,
}: {
  overline?: string;
  title?: string;
  faqs: HubFaqItem[];
}): JSX.Element {
  return (
    <section className="mt-12 mb-4">
      <Overline>{overline}</Overline>
      <h2 className="mt-2 font-display text-3xl text-foreground">{title}</h2>
      <dl className="pj-sticker mt-6 divide-y-2 divide-border overflow-hidden rounded-2xl bg-surface">
        {faqs.map((f) => (
          <div key={f.question} className="p-6">
            <dt className="font-display text-lg text-foreground">{f.question}</dt>
            <dd className="mt-2 text-sm text-muted">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
