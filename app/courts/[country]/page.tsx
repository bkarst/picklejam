import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCountry, getStatesInCountry } from "@/lib/data/geo";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, StateCard, StatLine } from "@/components/directory";
import { stateUrl } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Pre-render the known countries (US in v1); long tail on-demand via ISR.
  try {
    return [{ country: "us" }];
  } catch {
    return [];
  }
}

type Params = Promise<{ country: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { country } = await params;
  const c = await getCountry(country);
  if (!c) return buildMetadata({ title: "Not found", path: `/courts/${country}`, noindex: true });
  return buildMetadata({
    title: `Pickleball Courts in ${c.name}`,
    description: `Find pickleball courts across ${c.name} — browse by state and city.`,
    path: `/courts/${country}`,
  });
}

export default async function CountryPage({ params }: { params: Params }) {
  const { country } = await params;
  const [c, states] = await Promise.all([getCountry(country), getStatesInCountry(country)]);
  if (!c) notFound();

  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Courts", url: `${base}/courts` },
            { name: c.name, url: `${base}/courts/${country}` },
          ]),
          itemListJsonLd(states.map((s) => ({ name: s.name, url: `${base}${stateUrl(s)}` }))),
        ]}
      />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Courts", href: "/courts" }, { name: c.name }]} />
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Pickleball Courts in {c.name}
      </h1>
      <StatLine
        items={[
          { value: c.counts?.states ?? states.length, label: "States" },
          { value: c.counts?.locations ?? 0, label: "Locations" },
          { value: c.counts?.courts ?? 0, label: "Courts" },
        ]}
      />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {states.map((s) => (
          <StateCard key={s.code} state={s} />
        ))}
      </div>
    </main>
  );
}
