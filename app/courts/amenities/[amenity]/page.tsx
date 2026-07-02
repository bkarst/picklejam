import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourtsMatching } from "@/lib/data/courts";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CourtCard } from "@/components/directory";
import { AdSlot } from "@/components/ads/AdSlot";
import { courtUrl, amenityPath } from "@/lib/urls";
import { slugify } from "@/lib/util/slug";
import { brand } from "@/brand.config";

export const revalidate = 86400;
export const dynamicParams = false;

const AMENITIES: Record<string, { title: string; blurb: string }> = {
  restrooms: { title: "Pickleball Courts with Restrooms", blurb: "Courts with restroom facilities on site." },
  water: { title: "Pickleball Courts with Water", blurb: "Courts with drinking water or fountains available." },
  "wheelchair-accessible": { title: "Wheelchair-Accessible Pickleball Courts", blurb: "Accessible pickleball courts for players of all abilities." },
  food: { title: "Pickleball Courts with Food", blurb: "Play where food and refreshments are available." },
  "pro-shop": { title: "Pickleball Courts with a Pro Shop", blurb: "Courts with an on-site pro shop for gear and paddles." },
  training: { title: "Pickleball Courts with Training", blurb: "Facilities offering lessons and training programs." },
  youth: { title: "Pickleball Courts with Youth Programs", blurb: "Courts offering youth pickleball programs." },
};

export function generateStaticParams() {
  return Object.keys(AMENITIES).map((amenity) => ({ amenity }));
}

type Params = Promise<{ amenity: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { amenity } = await params;
  const cfg = AMENITIES[amenity];
  if (!cfg) return buildMetadata({ title: "Not found", path: amenityPath(amenity), noindex: true });
  return buildMetadata({ title: cfg.title, description: cfg.blurb, path: amenityPath(amenity) });
}

export default async function AmenityPage({ params }: { params: Params }) {
  const { amenity } = await params;
  const cfg = AMENITIES[amenity];
  if (!cfg) notFound();
  const courts = await getCourtsMatching("us", (c) => (c.amenities ?? []).some((a) => slugify(a) === amenity));
  const base = brand.siteUrl;

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: cfg.title, url: `${base}${amenityPath(amenity)}` },
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
