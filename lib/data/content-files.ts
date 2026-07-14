/**
 * content-files.ts — file-backed source for the Learn hub (articles + authors).
 *
 * The evergreen Content Hub is small and editorial, so its articles live as
 * git-versioned YAML files in the repo rather than DynamoDB items:
 *
 *   content/learn/<category>/<slug>.yml   → one article (category = folder)
 *   content/authors/<slug>.yml            → one author
 *
 * These functions back the CONTENT/AUTHOR reads in content.ts (getContentBySlug,
 * getContentByCategory, getContentByAuthor, getAuthor, getAuthorBySlug), returning
 * the SAME ContentItem / AuthorItem shapes the Learn pages already consume — so the
 * pages are unchanged. NEWS and all city/court data stay in DynamoDB (untouched).
 *
 * The upstream source of truth is the zeitgeist studio; `publish-to-picklejam`
 * writes these files. Reads are synchronous fs (server components / ISR), cheap at
 * this catalog size; swap for a cached index if the hub ever grows large.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { readMinutes } from "@/lib/content/render";
import type { ContentItem, AuthorItem, FaqEntry, PublishStatus } from "@/lib/db/types";

const CONTENT_ROOT = join(process.cwd(), "content");
const LEARN_DIR = join(CONTENT_ROOT, "learn");
const AUTHORS_DIR = join(CONTENT_ROOT, "authors");

const EPOCH = "1970-01-01T00:00:00.000Z";

interface ArticleFile {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  authorId: string;
  authorName?: string;
  coverImage?: string;
  keyTakeaways?: string[];
  faq?: FaqEntry[];
  tags?: string[];
  relatedCityKey?: string;
  status?: PublishStatus;
  publishedAt?: string;
  updatedAt?: string;
}

interface AuthorFile {
  authorId: string;
  slug: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  credentials?: string;
  socials?: { twitter?: string; instagram?: string; website?: string };
}

/** Category dir names under content/learn (each is a CONTENT_CATEGORIES value). */
function categoryDirs(): string[] {
  if (!existsSync(LEARN_DIR)) return [];
  return readdirSync(LEARN_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/** Article slugs (file stems) in one category dir. */
function slugsIn(category: string): string[] {
  const dir = join(LEARN_DIR, category);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml"))
    .map((f) => f.slice(0, -4));
}

function toContentItem(raw: ArticleFile, category: string): ContentItem {
  const publishedAt = raw.publishedAt ?? EPOCH;
  return {
    // BaseItem identity — synthetic; the file path never touches DynamoDB.
    pk: `CONTENT#${raw.id}`,
    sk: "META",
    entity: "CONTENT",
    id: raw.id,
    slug: raw.slug,
    category,
    title: raw.title,
    excerpt: raw.excerpt,
    body: raw.body,
    authorId: raw.authorId,
    readMinutes: readMinutes(raw.body),
    status: raw.status ?? "published",
    publishedAt,
    updatedAt: raw.updatedAt ?? publishedAt,
    createdAt: publishedAt,
    ...(raw.authorName ? { authorName: raw.authorName } : {}),
    ...(raw.coverImage ? { coverImage: raw.coverImage } : {}),
    ...(raw.keyTakeaways ? { keyTakeaways: raw.keyTakeaways } : {}),
    ...(raw.faq ? { faq: raw.faq } : {}),
    ...(raw.tags ? { tags: raw.tags } : {}),
    ...(raw.relatedCityKey ? { relatedCityKey: raw.relatedCityKey } : {}),
  };
}

function readArticle(category: string, slug: string): ContentItem | undefined {
  const file = join(LEARN_DIR, category, `${slug}.yml`);
  if (!existsSync(file)) return undefined;
  const raw = loadYaml(readFileSync(file, "utf8")) as ArticleFile | undefined;
  if (!raw || typeof raw !== "object") return undefined;
  return toContentItem(raw, category);
}

/** Resolve a published article by slug (optionally within a known category). */
export function fileGetContentBySlug(slug: string, category?: string): ContentItem | undefined {
  const cats = category !== undefined ? [category] : categoryDirs();
  for (const c of cats) {
    const item = readArticle(c, slug);
    if (item && item.status === "published") return item;
  }
  return undefined;
}

/** An article by id (any category, any status). */
export function fileGetContent(id: string): ContentItem | undefined {
  for (const c of categoryDirs()) {
    for (const slug of slugsIn(c)) {
      const item = readArticle(c, slug);
      if (item && item.id === id) return item;
    }
  }
  return undefined;
}

/** Published articles in a category, newest first. */
export function fileGetContentByCategory(category: string, limit?: number): ContentItem[] {
  const items = slugsIn(category)
    .map((s) => readArticle(category, s))
    .filter((x): x is ContentItem => !!x && x.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return limit !== undefined ? items.slice(0, limit) : items;
}

/** An author's published articles across all categories, newest first. */
export function fileGetContentByAuthor(authorId: string): ContentItem[] {
  const out: ContentItem[] = [];
  for (const c of categoryDirs()) {
    for (const s of slugsIn(c)) {
      const item = readArticle(c, s);
      if (item && item.status === "published" && item.authorId === authorId) out.push(item);
    }
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function toAuthorItem(raw: AuthorFile): AuthorItem {
  return {
    pk: `AUTHOR#${raw.authorId}`,
    sk: "META",
    entity: "AUTHOR",
    authorId: raw.authorId,
    slug: raw.slug,
    name: raw.name,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...(raw.bio ? { bio: raw.bio } : {}),
    ...(raw.avatarUrl ? { avatarUrl: raw.avatarUrl } : {}),
    ...(raw.credentials ? { credentials: raw.credentials } : {}),
    ...(raw.socials ? { socials: raw.socials } : {}),
  };
}

function readAuthorBySlug(slug: string): AuthorItem | undefined {
  const file = join(AUTHORS_DIR, `${slug}.yml`);
  if (!existsSync(file)) return undefined;
  const raw = loadYaml(readFileSync(file, "utf8")) as AuthorFile | undefined;
  if (!raw || typeof raw !== "object") return undefined;
  return toAuthorItem(raw);
}

/** An author by URL slug. */
export function fileGetAuthorBySlug(slug: string): AuthorItem | undefined {
  return readAuthorBySlug(slug);
}

/** An author by id (small scan over author files). */
export function fileGetAuthor(authorId: string): AuthorItem | undefined {
  if (!existsSync(AUTHORS_DIR)) return undefined;
  for (const f of readdirSync(AUTHORS_DIR).filter((x) => x.endsWith(".yml"))) {
    const a = readAuthorBySlug(f.slice(0, -4));
    if (a && a.authorId === authorId) return a;
  }
  return undefined;
}
