import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourtsMatching } from "@/lib/data/courts";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CourtCard } from "@/components/directory";
import { AdSlot } from "@/components/ads/AdSlot";
import { courtUrl, courtTypePath } from "@/lib/urls";
import type { CourtItem } from "@/lib/db/types";
import { brand } from "@/brand.config";

export const revalidate = 86400;
export const dynamicParams = false;

const TYPES: Record<string, { title: string; blurb: string; predicate: (c: CourtItem) => boolean }> = {
  indoor: { title: "Indoor Pickleball Courts", blurb: "Play year-round, rain or shine, at indoor pickleball facilities.", predicate: (c) => (c.indoorCourts ?? 0) > 0 },
  outdoor: { title: "Outdoor Pickleball Courts", blurb: "Find outdoor pickleball courts at parks and public facilities.", predicate: (c) => (c.outdoorCourts ?? 0) > 0 },
  lighted: { title: "Lighted Pickleball Courts", blurb: "Courts with lights for evening and night play.", predicate: (c) => Boolean(c.lighted) },
  dedicated: { title: "Dedicated Pickleball Courts", blurb: "Purpose-built courts with permanent nets and lines.", predicate: (c) => Boolean(c.dedicated) },
};

export function generateStaticParams() {
  return Object.keys(TYPES).map((type) => ({ type }));
}

type Params = Promise<{ type: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { type } = await params;
  const cfg = TYPES[type];
  if (!cfg) return buildMetadata({ title: "Not found", path: courtTypePath(type), noindex: true });
  return buildMetadata({ title: cfg.title, description: cfg.blurb, path: courtTypePath(type) });
}

export default async function CourtTypePage({ params }: { params: Params }) {
  const { type } = await params;
  const cfg = TYPES[type];
  if (!cfg) notFound();
  const courts = await getCourtsMatching("us", cfg.predicate);
  const base = brand.siteUrl;

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: cfg.title, url: `${base}${courtTypePath(type)}` },
          ]),
          itemListJsonLd(courts.map((c) => ({ name: c.name, url: `${base}${courtUrl(c)}` }))),
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Courts", href: "/courts" }, { name: cfg.title }]} />
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">{cfg.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{cfg.blurb}</p>

      {courts.length === 0 ? (
        <p className="mt-8 text-muted">No matching courts listed yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.map((c) => (
            <CourtCard key={c.courtId} court={c} variant="grid" />
          ))}
        </div>
      )}
      <AdSlot kind="in-feed" className="mt-6" />
    </main>
  );
}
