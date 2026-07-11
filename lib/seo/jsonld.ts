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
import type {
  CourtItem,
  OutingItem,
  TourneyItem,
  DivisionItem,
  LeagueItem,
  LeagueDivisionItem,
  LadderItem,
  GroupItem,
  ContentItem,
  NewsItem,
  AuthorItem,
} from "@/lib/db/types";

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
    author: { "@type": "Person", name: review.author || `${brand.identity.name} player` },
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
    ...(tournament.avatarUrl ? { image: tournament.avatarUrl } : {}),
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

/**
 * `Event` + `Offer` — a paid LEAGUE (Stage 7, §3.4 / §7.2). Rendered on the league
 * detail page alongside a `BreadcrumbList`. One `Offer` is emitted per division /
 * flight (schema.org accepts an array), priced from the division's `price` (major
 * units) with an `availability` that flips to `SoldOut` once a capped flight fills.
 *
 * EMPTY-SAFE: `endDate`, `description`, and `location.address` are omitted when
 * absent; a league with no divisions carries no `offers`.
 */
export function leagueEventJsonLd(
  league: LeagueItem,
  divisions: LeagueDivisionItem[],
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

  const venue = opts.venueName ?? league.venueName;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Event",
    name: league.title,
    url: absoluteUrl,
    sport: "Pickleball",
    startDate: league.startDate,
    ...(league.endDate ? { endDate: league.endDate } : {}),
    ...(league.description ? { description: league.description } : {}),
    ...(league.avatarUrl ? { image: league.avatarUrl } : {}),
    eventStatus:
      league.status === "cancelled"
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

/**
 * `SportsEvent` + `Offer` — a paid LADDER (Stage 7, §3.4 / §7.4). A ladder is an
 * ongoing, recurring competition, so it renders as a `SportsEvent` with a single
 * membership `Offer` (the join price). EMPTY-SAFE: `description` and the venue
 * address are omitted when absent.
 */
export function ladderEventJsonLd(
  ladder: LadderItem,
  opts: { url: string; cityName?: string; stateCode?: string; venueName?: string },
): JsonLd {
  const absoluteUrl = opts.url.startsWith("http") ? opts.url : `${brand.siteUrl}${opts.url}`;
  const digits = minorUnitDigits(ladder.price.currency);
  const venue = opts.venueName ?? ladder.venueName;

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SportsEvent",
    name: ladder.title,
    sport: "Pickleball",
    url: absoluteUrl,
    startDate: ladder.startDate,
    ...(ladder.description ? { description: ladder.description } : {}),
    ...(ladder.avatarUrl ? { image: ladder.avatarUrl } : {}),
    eventStatus:
      ladder.status === "cancelled"
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
    offers: {
      "@type": "Offer",
      price: (ladder.price.amount / 10 ** digits).toFixed(digits),
      priceCurrency: ladder.price.currency.toUpperCase(),
      availability: "https://schema.org/InStock",
      url: absoluteUrl,
    },
  };
}

/**
 * `SportsOrganization` — a PUBLIC group/club (Stage 8, §3.4 / §6.9). Rendered on
 * the group detail page (public groups only — the page emits `noindex` and skips
 * this markup for private/unlisted groups) alongside a `BreadcrumbList` and an
 * `ItemList` of the group's upcoming meet-ups. The group is a `subOrganization` of
 * the sitewide brand `Organization`.
 *
 * EMPTY-SAFE: `description`, `logo`/`image`, and the venue `location` are omitted
 * when absent. `memberCount` (when > 0) is surfaced via `member` count.
 */
export function sportGroupJsonLd(
  group: GroupItem,
  opts: { url: string; cityName?: string; stateCode?: string; memberCount?: number },
): JsonLd {
  const absoluteUrl = opts.url.startsWith("http") ? opts.url : `${brand.siteUrl}${opts.url}`;
  const count = opts.memberCount ?? group.memberCount;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "SportsOrganization",
    name: group.name,
    sport: "Pickleball",
    url: absoluteUrl,
    ...(group.description ? { description: group.description } : {}),
    ...(group.avatarUrl ? { logo: group.avatarUrl, image: group.avatarUrl } : {}),
    ...(opts.cityName || opts.stateCode
      ? {
          location: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              ...(opts.cityName ? { addressLocality: opts.cityName } : {}),
              ...(opts.stateCode ? { addressRegion: opts.stateCode } : {}),
            },
          },
        }
      : {}),
    ...(typeof count === "number" && count > 0
      ? { member: { "@type": "OrganizationRole", numberOfEmployees: count } }
      : {}),
    parentOrganization: { "@type": "Organization", name: brand.identity.name, url: brand.siteUrl },
  };
}

// ── Content Hub + News (Stage 9, §3.4 / §6.5 / §6.6) ─────────────────────────

/** Absolute-ize a relative path with the brand origin (idempotent for URLs). */
function absolute(url: string): string {
  return url.startsWith("http") ? url : `${brand.siteUrl}${url}`;
}

/** The sitewide publisher `Organization` node (with a logo `ImageObject`). */
function publisherOrg(): JsonLd {
  return {
    "@type": "Organization",
    name: brand.identity.name,
    url: brand.siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${brand.siteUrl}${brand.logos.lockup}`,
    },
  };
}

/**
 * A schema.org `Person` for a content AUTHOR (E-E-A-T). Distinct from
 * {@link personJsonLd} (which is a *player* profile keyed off `UserProfileItem`);
 * this one is keyed off `AuthorItem`. Used standalone on the author page and
 * inlined as `Article.author`. `sameAs` collects the author's social profiles.
 */
export function authorPersonJsonLd(author: AuthorItem, opts?: { url?: string }): JsonLd {
  const sameAs: string[] = [];
  const s = author.socials ?? {};
  if (s.twitter) sameAs.push(`https://x.com/${s.twitter.replace(/^@/, "")}`);
  if (s.instagram) sameAs.push(`https://www.instagram.com/${s.instagram.replace(/^@/, "")}`);
  if (s.website) sameAs.push(s.website);
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Person",
    name: author.name,
    url: absolute(opts?.url ?? `/learn/authors/${author.slug}`),
    knowsAbout: "Pickleball",
    ...(author.credentials ? { jobTitle: author.credentials } : {}),
    ...(author.bio ? { description: author.bio } : {}),
    ...(author.avatarUrl ? { image: author.avatarUrl } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/**
 * `Article` — an evergreen guide/gear/rules article (Stage 9, §3.4). Rendered on
 * the article page alongside a `BreadcrumbList` and (where present) an `FAQPage`.
 *
 * The `author` is a `Person` built from the article's `AuthorItem` when supplied
 * (falling back to the denormalized `authorName`, then the brand). `publisher` is
 * the sitewide `Organization` with a logo `ImageObject` (required for the Article
 * rich result). EMPTY-SAFE: `image`, `keywords`, and `articleSection` are omitted
 * when absent. `dateModified` falls back to `datePublished`.
 */
export function articleJsonLd(
  content: ContentItem,
  opts: { url: string; author?: AuthorItem | null },
): JsonLd {
  const url = absolute(opts.url);
  const author: JsonLd = opts.author
    ? {
        "@type": "Person",
        name: opts.author.name,
        url: absolute(`/learn/authors/${opts.author.slug}`),
        ...(opts.author.avatarUrl ? { image: opts.author.avatarUrl } : {}),
      }
    : content.authorName
      ? { "@type": "Person", name: content.authorName }
      : { "@type": "Organization", name: brand.identity.name, url: brand.siteUrl };

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    headline: content.title,
    description: content.excerpt,
    ...(content.coverImage ? { image: absolute(content.coverImage) } : {}),
    datePublished: content.publishedAt,
    dateModified: content.updatedAt || content.publishedAt,
    author,
    publisher: publisherOrg(),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    ...(content.category ? { articleSection: content.category } : {}),
    ...(content.tags && content.tags.length > 0 ? { keywords: content.tags.join(", ") } : {}),
  };
}

/**
 * `NewsArticle` — a dated news item (Stage 9, §3.4 / §6.6). Rendered on the news
 * article page alongside a `BreadcrumbList`. `publisher` is the sitewide brand;
 * the original outlet is attributed via `sourceOrganization` + `isBasedOn` when a
 * source is present (so the coverage credits the original reporting). EMPTY-SAFE:
 * `image` and the source fields are omitted when absent.
 */
export function newsArticleJsonLd(news: NewsItem, opts: { url: string }): JsonLd {
  const url = absolute(opts.url);
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "NewsArticle",
    headline: news.title,
    description: news.excerpt,
    ...(news.coverImage ? { image: absolute(news.coverImage) } : {}),
    datePublished: news.publishedAt,
    dateModified: news.updatedAt || news.publishedAt,
    author: { "@type": "Organization", name: brand.identity.name, url: brand.siteUrl },
    publisher: publisherOrg(),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    ...(news.topics && news.topics.length > 0 ? { keywords: news.topics.join(", ") } : {}),
    ...(news.source?.name
      ? {
          sourceOrganization: {
            "@type": "Organization",
            name: news.source.name,
            ...(news.source.url ? { url: news.source.url } : {}),
          },
          ...(news.source.url ? { isBasedOn: news.source.url } : {}),
        }
      : {}),
  };
}

/**
 * `CollectionPage` — the /learn hub and /news index (Stage 9, §3.4). Wraps an
 * `ItemList` of the surfaced articles/items as `mainEntity` so the collection's
 * membership is machine-readable. EMPTY-SAFE: `mainEntity` is omitted when the
 * collection is empty.
 */
export function collectionPageJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  items?: { name: string; url: string }[];
}): JsonLd {
  const items = opts.items ?? [];
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: absolute(opts.url),
    ...(items.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.name,
              url: absolute(item.url),
            })),
          },
        }
      : {}),
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
