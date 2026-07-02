import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getState, getCitiesInState } from "@/lib/data/geo";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CityCard, StatLine } from "@/components/directory";
import { cityUrl } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Long tail generated on-demand; a scheduled warmer + sitemap seed the cache.
  return [];
}

type Params = Promise<{ country: string; state: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country, state } = await params;
  const s = await getState(country, state);
  if (!s) return buildMetadata({ title: "Not found", path: `/courts/${country}/${state}`, noindex: true });
  return buildMetadata({
    title: `Pickleball Courts in ${s.name}`,
    description: `${s.counts?.locations ?? 0} places to play pickleball across ${s.name}. Browse courts by city.`,
    path: `/courts/${country}/${state}`,
  });
}

export default async function StatePage({ params }: { params: Params }) {
  const { country, state } = await params;
  const [s, cities] = await Promise.all([getState(country, state), getCitiesInState(country, state)]);
  if (!s) notFound();

  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: "United States", url: `${base}/courts/${country}` },
            { name: s.name, url: `${base}/courts/${country}/${state}` },
          ]),
          itemListJsonLd(cities.map((ct) => ({ name: ct.name, url: `${base}${cityUrl(ct)}` }))),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courts", href: "/courts" },
          { name: "United States", href: `/courts/${country}` },
          { name: s.name },
        ]}
      />
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Pickleball Courts in {s.name}
      </h1>
      <StatLine
        items={[
          { value: s.counts?.cities ?? cities.length, label: "Cities" },
          { value: s.counts?.locations ?? 0, label: "Locations" },
          { value: s.counts?.courts ?? 0, label: "Courts" },
        ]}
      />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((ct) => (
          <CityCard key={ct.cityKey} city={ct} />
        ))}
      </div>
    </main>
  );
}
