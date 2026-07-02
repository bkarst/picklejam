import type { ContentItem, NewsItem } from "@/lib/db/types";

export const article: ContentItem = {
  pk: "CONTENT#c-getting-started",
  sk: "META",
  entity: "CONTENT",
  id: "c-getting-started",
  slug: "complete-guide-to-getting-started",
  category: "how-to-play",
  title: "The Complete Guide to Getting Started",
  excerpt:
    "Everything you need to know to step on the court with confidence — equipment, basics, and first games.",
  body: "## Gear\n\nYou need a paddle.\n\n## Rules\n\nServe underhand.",
  keyTakeaways: ["Get a paddle you like", "Learn the two-bounce rule", "Play with better players"],
  faq: [{ question: "Is pickleball easy to learn?", answer: "Yes — most people rally on day one." }],
  authorId: "a-matt",
  authorName: "Matt H.",
  relatedCityKey: "us#kansas#lenexa",
  coverImage: "https://cdn.example.com/getting-started.jpg",
  tags: ["beginner", "equipment"],
  readMinutes: 8,
  status: "published",
  publishedAt: "2024-05-20T12:00:00.000Z",
  updatedAt: "2024-05-20T12:00:00.000Z",
  createdAt: "2024-05-20T12:00:00.000Z",
};

export const news: NewsItem = {
  pk: "NEWS#n-ppa-texas",
  sk: "META",
  entity: "NEWS",
  id: "n-ppa-texas",
  slug: "ben-johns-wins-ppa-texas-open",
  title: "Ben Johns wins PPA Texas Open in dominant fashion",
  excerpt:
    "World No. 1 Ben Johns captures his third title of the season with a straight-games win in the men's singles final in Austin.",
  body: "World No. 1 Ben Johns won again.",
  source: { name: "Pickleball Central", url: "https://example.com/story" },
  topics: ["pro-tour"],
  coverImage: "https://cdn.example.com/ppa.jpg",
  status: "published",
  publishedAt: "2025-05-23T09:42:00.000Z",
  updatedAt: "2025-05-23T09:42:00.000Z",
  createdAt: "2025-05-23T09:42:00.000Z",
};
