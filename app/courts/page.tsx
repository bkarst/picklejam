import type { Metadata } from "next";
import { getCountries } from "@/lib/data/geo";
import { buildMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, CountryCard } from "@/components/directory";
import { countryUrl } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 86400;

export const metadata: Metadata = buildMetadata({
  title: "Pickleball Courts Directory",
  description:
    "Browse pickleball courts by country, state, and city. Find courts, open play, and games near you.",
  path: "/courts",
});

export default async function CourtHubPage() {
  const countries = await getCountries();
  const crumbs = [{ name: "Home", href: "/" }, { name: "Courts" }];

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([{ name: "Home", url: brand.siteUrl }, { name: "Courts", url: `${brand.siteUrl}/courts` }]),
          itemListJsonLd(countries.map((c) => ({ name: c.name, url: `${brand.siteUrl}${countryUrl(c)}` }))),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
        Find Pickleball Courts
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Explore courts across the country — browse by state and city to find places to play near you.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => (
          <CountryCard key={c.code} country={c} />
        ))}
      </div>
    </main>
  );
}
