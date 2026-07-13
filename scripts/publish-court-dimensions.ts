#!/usr/bin/env tsx
/**
 * publish-court-dimensions.ts — publish the Content Studio evergreen pillar
 * "Pickleball Court Dimensions, Demystified" (authored in the zeitgeist studio,
 * org pickle-jam, author jamie-green) into the PickleJam Content Hub.
 *
 * Mirrors scripts/seed-content.ts: upsert the author, then createContent a
 * PUBLISHED evergreen article. The trusted markdown body is read from the studio
 * tree and mechanically transformed (hero + inline TOC + FAQ lifted out into the
 * structured coverImage / faq fields the article page renders separately).
 *
 * Figures + hero already copied to public/studio/pickle-jam/ so the body's
 * /studio/pickle-jam/*.svg image paths and the coverImage resolve as local files.
 *
 * Idempotent by id (c-pickleball-court-dimensions); safe to re-run.
 *
 * Usage (writes to PickleLokoApp<APP_ENV>; no DYNAMODB_ENDPOINT → real AWS):
 *   APP_ENV=Development AWS_REGION=us-east-1 \
 *     AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... npx tsx scripts/publish-court-dimensions.ts
 */

import { readFileSync } from "node:fs";
import { createContent, upsertAuthor, getContentBySlug } from "@/lib/data/content";

const STUDIO_BODY =
  "/Users/ben/zeitgeist/studio/organizations/pickle-jam/content/pickleball-court-dimensions-demystified/versions/2/content.md";

const AUTHOR_ID = "a-jamie-green";
const CATEGORY = "rules";
const SLUG = "pickleball-court-dimensions-demystified";
const ID = "c-pickleball-court-dimensions";

/** Lift the hero + inline "What this guide covers" TOC + FAQ out of the studio body.
 *  The article page renders coverImage, its own TOC (extractToc), and the FAQ
 *  accordion (from the structured `faq` field) separately, so they must not be
 *  duplicated inside the markdown body. Prose is otherwise untouched. */
function transformBody(raw: string): string {
  return raw
    // "## What this guide covers" list + the hero image + its caption, up to the first real section.
    .replace(/## What this guide covers[\s\S]*?(?=## Every line, from the outside in)/, "")
    // "## Frequently asked questions" section (moved to structured faq), up to the conclusion.
    .replace(/## Frequently asked questions[\s\S]*?(?=## The bottom line)/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

async function main(): Promise<void> {
  const body = transformBody(readFileSync(STUDIO_BODY, "utf8"));

  if (/What this guide covers|Frequently asked questions|court-dimensions-hero/.test(body)) {
    throw new Error("Body transform failed: a lifted section is still present.");
  }

  await upsertAuthor({
    authorId: AUTHOR_ID,
    name: "Jamie Green",
    slug: "jamie-green",
    avatarUrl: "/jamie-profile.png",
    credentials: "Courtside Columnist, PickleJam",
    bio: "Jamie Green writes about the people, the courts, and the small joys of local pickleball.",
  });

  await createContent({
    id: ID,
    slug: SLUG,
    category: CATEGORY,
    title: "Pickleball Court Dimensions, Demystified: Every Line, Zone & Inch",
    excerpt:
      "A pickleball court is 20 by 44 feet, small on purpose. Here is every line, zone, and inch: the 7-foot kitchen, the 36 and 34-inch net, the service courts, and the room you need to build one.",
    body,
    authorId: AUTHOR_ID,
    authorName: "Jamie Green",
    coverImage: "/studio/pickle-jam/court-dimensions-hero.jpg",
    keyTakeaways: [
      "A regulation pickleball court is 20 by 44 feet, the same for singles and doubles: 880 square feet.",
      "The kitchen (non-volley zone) runs 7 feet from the net on each side, and the net is 36 inches at the posts, 34 at the center.",
      "Plan the whole footprint: 30 by 60 feet minimum, 34 by 64 recommended, with every line 2 inches wide.",
    ],
    faq: [
      {
        question: "What are the exact dimensions of a pickleball court?",
        answer:
          "Twenty feet wide by 44 feet long, for both singles and doubles. That works out to 880 square feet of playing surface.",
      },
      {
        question: "How big is the kitchen?",
        answer:
          "The non-volley zone extends 7 feet from the net on each side and spans the full 20-foot width. You can stand in it, you simply cannot volley while you are there.",
      },
      {
        question: "How high is a pickleball net?",
        answer:
          "It is 36 inches at the posts and 34 inches at the center. That 2-inch dip in the middle is intentional, not a droopy net.",
      },
      {
        question: "Can you fit a pickleball court on a tennis court?",
        answer:
          "Yes, easily. A tennis court has roughly three times the surface area, and many clubs stripe up to four pickleball courts inside one tennis court's fenced space.",
      },
      {
        question: "How much total space do I need for one court?",
        answer:
          "Plan for at least 30 by 60 feet, and 34 by 64 if you can spare it, so players have room to chase a ball safely past the lines.",
      },
      {
        question: "Is a pickleball court really the same size as a badminton court?",
        answer:
          "Yes. A doubles badminton court is also 20 by 44 feet, which is exactly where pickleball's dimensions came from.",
      },
      {
        question: "How wide are the court lines?",
        answer:
          "Every line is 2 inches wide, and the court is always measured to the outside edge of the lines.",
      },
      {
        question: "Do singles and doubles use different court sizes?",
        answer:
          "No. Both are played on the same 20-by-44-foot court, which is exactly what makes singles such a workout.",
      },
    ],
    tags: ["rules", "court dimensions", "court", "reference", "beginner"],
    publishedAt: "2026-07-13T15:00:00.000Z",
  });

  const check = await getContentBySlug(SLUG, CATEGORY);
  if (!check) throw new Error("Read-back failed: article did not publish.");
  console.log(
    `Published: /learn/${CATEGORY}/${check.slug} | "${check.title}" | author=${check.authorId} | status=${check.status} | ${check.readMinutes} min | ${check.faq?.length ?? 0} FAQ | cover=${check.coverImage}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
