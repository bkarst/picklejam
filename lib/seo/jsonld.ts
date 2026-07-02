/**
 * jsonld.ts — typed schema.org JSON-LD builders (PRD §3.4).
 *
 * Every builder returns a plain object (rendered by `<JsonLd>` in
 * `components/JsonLd.tsx`). All brand-sourced values come from `brand.config`.
 *
 * Stage 0 set: Organization, WebSite (+ Sitelinks Searchbox SearchAction),
 * BreadcrumbList, FAQPage. Later stages add their own builders beside their
 * features (§3.4): `SportsActivityLocation` + `AggregateRating` + `Review`
 * (Stage 1 court detail), `ItemList` (Stage 1 directory), `Event`/`SportsEvent`
 * (Stage 4 outings), `Event` + `Offer` (Stage 6/7 tournaments/leagues),
 * `Article` + author `Person` + `BreadcrumbList` / `NewsArticle` (Stage 9),
 * sport-scoped `Organization` + `ItemList` of `SportsEvent` (Stage 8 groups).
 */

import { brand } from "@/brand.config";
import { courtUrl } from "@/lib/urls";
import { parseCityKey } from "@/lib/db/keys";
import type { CourtItem } from "@/lib/db/types";

/** A JSON-LD document (schema.org). Kept loose — schema.org is open-ended. */
export type JsonLd = Record<string, unknown>;

const SCHEMA_CONTEXT = "https://schema.org";

/** Convert the brand's social handles/URLs into absolute `sameAs` profile URLs. */
function socialSameAs(): string[] {
  const { socials } = brand.identity;
  const handle = (h: string) => h.replace(/^@/, "");
  const urls: string[] = [];
  if (socials.twitter) urls.push(`https://x.com/${handle(socials.twitter)}`);
  if (socials.instagram) urls.push(`https://www.instagram.com/${handle(socials.instagram)}`);
  if (socials.facebook) {
    urls.push(
      socials.facebook.startsWith("http")
        ? socials.facebook
        : `https://www.facebook.com/${handle(socials.facebook)}`,
    );
  }
  return urls;
}

/** `Organization` — sitewide brand entity (rendered on the homepage, §6.1). */
export function organizationJsonLd(): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name: brand.identity.name,
    legalName: brand.identity.legalName,
    url: brand.siteUrl,
    logo: `${brand.siteUrl}${brand.logos.lockup}`,
    description: brand.identity.description,
    email: brand.identity.supportEmail,
    sameAs: socialSameAs(),
  };
}

/**
 * `WebSite` with a `SearchAction` (Google Sitelinks Searchbox) that points at
 * the site's global search (§6.1). The target URL is user-facing; robots
 * disallows crawling `/search?*` (§3.7), which does not affect the searchbox.
 */
export function webSiteJsonLd(): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: brand.identity.name,
    url: brand.siteUrl,
    description: brand.identity.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${brand.siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * `BreadcrumbList` — reinforces the geo URL tree (§3.2). Pass items in order
 * (Home » Country » State » City » Court); positions are 1-based.
 */
export function breadcrumbListJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** `FAQPage` — the FAQ accordions on home/city/court pages (§6.1). */
export function faqPageJsonLd(qas: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: qas.map((qa) => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: { "@type": "Answer", text: qa.answer },
    })),
  };
}

/**
 * `SportsActivityLocation` — the court-detail structured data (Stage 1, §3.4).
 *
 * On the court page this renders ALONGSIDE {@link faqPageJsonLd} (the court FAQ)
 * and {@link breadcrumbListJsonLd} (Home » Country » State » City » Court); the
 * `<JsonLd>` component emits them together as a `@graph`/array.
 *
 * EMPTY-SAFE contract: every optional field is omitted entirely when absent
 * (`telephone`, `image`, `address.streetAddress`, `amenityFeature`). Critically,
 * `aggregateRating` is emitted ONLY when the court has ≥1 review — an
 * `AggregateRating` with `reviewCount: 0` is a Google rich-results violation, so
 * a review-less court simply carries no rating markup.
 *
 * `addressCountry` is the ISO code parsed from the court's `cityKey`, upper-cased
 * (e.g. `US`). `opts.countryName` is accepted for signature stability (parity
 * with the display/breadcrumb layer) but is not part of the PostalAddress shape.
 */
export function courtJsonLd(
  court: CourtItem,
  opts: { cityName: string; stateCode: string; countryName?: string },
): JsonLd {
  const { country } = parseCityKey(court.cityKey);
  const imageUrl = court.photos?.find((p) => p.visible)?.url;
  const amenities = court.amenities ?? [];
  const hasReviews = typeof court.reviewCount === "number" && court.reviewCount > 0;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SportsActivityLocation",
    name: court.name,
    url: `${brand.siteUrl}${courtUrl(court)}`,
    sport: "Pickleball",
    ...(court.phone ? { telephone: court.phone } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    address: {
      "@type": "PostalAddress",
      ...(court.address ? { streetAddress: court.address } : {}),
      addressLocality: opts.cityName,
      addressRegion: opts.stateCode,
      addressCountry: country.toUpperCase(),
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: court.lat,
      longitude: court.lng,
    },
    ...(amenities.length > 0
      ? {
          amenityFeature: amenities.map((name) => ({
            "@type": "LocationFeatureSpecification",
            name,
            value: true,
          })),
        }
      : {}),
    ...(hasReviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: court.ratingAvg,
            reviewCount: court.reviewCount,
          },
        }
      : {}),
  };
}

/**
 * `ItemList` — the ordered link list on directory hub pages (Stage 1, §3.4):
 * the country → state → city → court drill-down grids. Positions are 1-based.
 *
 * Each item's `url` is normalized to absolute: an already-absolute URL is kept
 * as-is, a relative path (e.g. from `cityUrl`) is prefixed with `brand.siteUrl`.
 */
export function itemListJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url.startsWith("http") ? item.url : `${brand.siteUrl}${item.url}`,
    })),
  };
}
