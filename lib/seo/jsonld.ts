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
import { minorUnitDigits } from "@/lib/money";
import type { CourtItem, OutingItem, TourneyItem, DivisionItem } from "@/lib/db/types";

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
/**
 * `Review` JSON-LD (§3.4) — one per court review, embedded on the court page so
 * SERP review snippets render. Pair with the court's `AggregateRating` (already
 * in `courtJsonLd`, empty-safe until reviewCount>0).
 */
export function reviewJsonLd(
  review: { rating1to5: number; title?: string; body?: string; author?: string; createdAt?: string },
  courtName: string,
): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Review",
    itemReviewed: { "@type": "SportsActivityLocation", name: courtName },
    reviewRating: { "@type": "Rating", ratingValue: review.rating1to5, bestRating: 5, worstRating: 1 },
    ...(review.title ? { name: review.title } : {}),
    ...(review.body ? { reviewBody: review.body } : {}),
    author: { "@type": "Person", name: review.author || "PickleLoko player" },
    ...(review.createdAt ? { datePublished: review.createdAt } : {}),
  };
}

/**
 * `SportsEvent` — an outing/game (Stage 4, §3.4 / §6.7). Rendered on the outing
 * detail page alongside a `BreadcrumbList`; public outings only (the page gates
 * private/unlisted out of the crawlable markup).
 *
 * EMPTY-SAFE: optional fields (`endDate`, `description`,
 * `maximumAttendeeCapacity`) are omitted when absent. The `location` is a
 * `Place` (the court venue). A free `Offer` (price 0) is emitted so the event can
 * qualify for event rich-results without implying a paid ticket.
 */
export function sportsEventJsonLd(
  outing: OutingItem,
  opts: { courtName: string; url: string; cityName?: string; stateCode?: string },
): JsonLd {
  const absoluteUrl = opts.url.startsWith("http") ? opts.url : `${brand.siteUrl}${opts.url}`;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SportsEvent",
    name: outing.title,
    sport: "Pickleball",
    url: absoluteUrl,
    startDate: outing.startTs,
    ...(outing.endTs ? { endDate: outing.endTs } : {}),
    ...(outing.description ? { description: outing.description } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: opts.courtName,
      ...(opts.cityName || opts.stateCode
        ? {
            address: {
              "@type": "PostalAddress",
              ...(opts.cityName ? { addressLocality: opts.cityName } : {}),
              ...(opts.stateCode ? { addressRegion: opts.stateCode } : {}),
            },
          }
        : {}),
    },
    ...(typeof outing.capacity === "number" && outing.capacity > 0
      ? { maximumAttendeeCapacity: outing.capacity }
      : {}),
    organizer: { "@type": "Organization", name: brand.identity.name, url: brand.siteUrl },
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: absoluteUrl,
    },
  };
}

/**
 * `SoftwareApplication` — the free Round-Robin generator tool (Stage 5, §6.8).
 *
 * Rendered on the round-robin landing (and each public event page) so the tool
 * can qualify for the software rich-result. It is a free, browser-based utility,
 * so a zero-price `Offer` is emitted (`price: "0"`) and the app category is
 * `SportsApplication`. `url`/`name`/`description` default to the tool's brand
 * values but every field is overridable for per-event pages.
 */
export function softwareApplicationJsonLd(opts?: {
  name?: string;
  description?: string;
  url?: string;
}): JsonLd {
  const absoluteUrl = opts?.url
    ? opts.url.startsWith("http")
      ? opts.url
      : `${brand.siteUrl}${opts.url}`
    : `${brand.siteUrl}/round-robin`;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SoftwareApplication",
    name: opts?.name ?? `${brand.identity.name} Round Robin Generator`,
    description:
      opts?.description ??
      "Free round-robin generator for pickleball — build fair, balanced schedules for round robins, mixers, Swiss, and pool-play brackets in seconds. No sign-up required.",
    url: absoluteUrl,
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: { "@type": "Organization", name: brand.identity.name, url: brand.siteUrl },
  };
}

/**
 * `Event` + `Offer` — a paid tournament (Stage 6, §3.4 / §7.1). Rendered on the
 * tournament detail page alongside a `BreadcrumbList`. One `Offer` is emitted per
 * division (schema.org accepts an array), each priced from the division's `price`
 * (major units, computed from the stored minor units) with an `availability` that
 * flips to `SoldOut` once a capped division fills. Emitting per-division offers
 * lets a "from $X" price + per-division rich result render.
 *
 * EMPTY-SAFE: `endDate`, `description`, and `location.address` are omitted when
 * absent; a tournament with no divisions carries no `offers`.
 */
export function tournamentEventJsonLd(
  tournament: TourneyItem,
  divisions: DivisionItem[],
  opts: { url: string; cityName?: string; stateCode?: string; venueName?: string },
): JsonLd {
  const absoluteUrl = opts.url.startsWith("http") ? opts.url : `${brand.siteUrl}${opts.url}`;

  const offers = divisions.map((d): JsonLd => {
    const digits = minorUnitDigits(d.price.currency);
    const isFull =
      typeof d.capacity === "number" && d.capacity > 0 && d.registeredCount >= d.capacity;
    return {
      "@type": "Offer",
      name: d.name,
      price: (d.price.amount / 10 ** digits).toFixed(digits),
      priceCurrency: d.price.currency.toUpperCase(),
      availability: isFull ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      url: absoluteUrl,
    };
  });

  const venue = opts.venueName ?? tournament.venueName;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Event",
    name: tournament.title,
    url: absoluteUrl,
    startDate: tournament.startDate,
    ...(tournament.endDate ? { endDate: tournament.endDate } : {}),
    ...(tournament.description ? { description: tournament.description } : {}),
    eventStatus:
      tournament.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: venue ?? "Pickleball venue",
      ...(opts.cityName || opts.stateCode
        ? {
            address: {
              "@type": "PostalAddress",
              ...(opts.cityName ? { addressLocality: opts.cityName } : {}),
              ...(opts.stateCode ? { addressRegion: opts.stateCode } : {}),
            },
          }
        : {}),
    },
    organizer: { "@type": "Organization", name: brand.identity.name, url: brand.siteUrl },
    ...(offers.length > 0 ? { offers: offers.length === 1 ? offers[0] : offers } : {}),
  };
}

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

/**
 * `Person` — a player's public profile (Stage 2, §3.4 / §6.3). Sport-scoped via
 * `knowsAbout`. `url` is the canonical brand-sourced player page. Only public,
 * non-sensitive fields are emitted (never gender/email); the caller must gate on
 * {@link profileIsIndexable} before rendering. `homeLocation` (with a
 * `PostalAddress` locality) is included only when a city name is supplied.
 */
export function personJsonLd(
  user: import("@/lib/db/types").UserProfileItem,
  opts?: { cityName?: string },
): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Person",
    name: user.displayName,
    url: `${brand.siteUrl}/players/${user.username}`,
    knowsAbout: "Pickleball",
    ...(user.avatarUrl ? { image: user.avatarUrl } : {}),
    ...(opts?.cityName
      ? {
          homeLocation: {
            "@type": "Place",
            name: opts.cityName,
            address: { "@type": "PostalAddress", addressLocality: opts.cityName },
          },
        }
      : {}),
  };
}
