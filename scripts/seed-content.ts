#!/usr/bin/env tsx
/**
 * seed-content.ts — deterministic Content Hub + News seed (Stage 9, PRD §6.5/§6.6).
 *
 * Seeds one author + three PUBLISHED evergreen articles across two categories
 * (guides / gear / rules) with real markdown bodies (h2/h3 headings for the TOC,
 * key-takeaways, an FAQ on one, and a related-local CTA at `us#kansas#lawrence`),
 * plus two PUBLISHED news items with topics + source attribution. Deterministic ids
 * + slugs and idempotent (putItem = last-write-wins), so it drives dev AND the E2E
 * gate and can be re-run safely.
 *
 * The related-city CTA is validated by `createContent` against a live city — if the
 * geo directory hasn't been ingested yet, the orphan key is dropped (+ warned) and
 * the article still seeds.
 *
 * Usage:
 *   DYNAMODB_ENDPOINT=http://localhost:8000 APP_ENV=Development \
 *     AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local npx tsx scripts/seed-content.ts
 */

import { createContent, createNews, upsertAuthor } from "@/lib/data/content";
import { cityKeyOf } from "@/lib/db/keys";

const AUTHOR_ID = "a-jamie-reyes";
const LAWRENCE = cityKeyOf("us", "kansas", "lawrence");

const DINKING_BODY = `Dinking is the soft, controlled game that separates beginners from players who win. Instead of smashing every ball, you drop it gently into the non-volley zone and wait for your opponent to make the first mistake.

## What is a dink?

A dink is a soft shot, hit on a bounce, that arcs just over the net and lands in the kitchen. Because it lands short and low, your opponent can't attack it — they have to dink it back.

### Why dinking wins games

- It removes your opponent's power. A ball below net height can't be smashed.
- It forces errors. Most unforced errors happen in long dink rallies.
- It buys time to reset a fast exchange back to neutral.

## How to hit a consistent dink

Keep a continental grip, bend your knees, and push through the ball with your shoulder — not your wrist. Aim for a target a foot past the net, not the lines.

### Common mistakes

1. Swinging too hard and popping the ball up.
2. Standing upright instead of getting low.
3. Watching your paddle instead of the ball.

## Drills to practice

Cross-court dink rallies with a partner build touch fast. Count how many you can string together without an error, then try to beat it.
`;

const PADDLE_BODY = `Your first paddle matters more than most beginners expect. The right weight and grip make the soft game easier to learn; the wrong one builds bad habits.

## Weight

Paddle weight is the single biggest factor.

- **Lightweight (7.3 oz or less):** more control and quicker hands, less power.
- **Midweight (7.3–8.4 oz):** the all-around sweet spot most players choose.
- **Heavy (8.5 oz+):** more power, but slower reactions and more arm fatigue.

## Grip size

Hold the paddle and slide your other index finger between your fingertips and palm. If it fits snugly, the grip is right. When in doubt, size down — you can always build a grip up with an overgrip.

## Core and surface

Most modern paddles use a polymer honeycomb core for a soft, quiet feel. Fiberglass faces add pop; carbon-fiber faces add control and spin.

### What to skip at first

You don't need a $250 paddle to start. A solid midweight composite paddle in the $60–$100 range will take you well into intermediate play.
`;

const RULES_BODY = `Pickleball's rules look strange for about ten minutes, then they click. Here's everything a new player needs before their first game.

## Scoring

Games are played to 11, win by 2. **Only the serving side can score.** In doubles the score is called as three numbers: your score, their score, and the server number (1 or 2).

## Serving

- The serve is underhand, made below the waist.
- It's hit diagonally, cross-court, and must clear the non-volley zone.
- The receiving side must let the serve bounce, and the serving side must let the return bounce — the **two-bounce rule**.

## The kitchen (non-volley zone)

You cannot volley — hit the ball out of the air — while standing in the seven-foot non-volley zone. Stepping in to play a bounced ball is fine; just get out before you volley again.

### Faults

A fault ends the rally. Common faults are hitting out of bounds, into the net, volleying in the kitchen, or missing the two-bounce rule.
`;

const MLP_BODY = `Major League Pickleball confirmed an expanded 2026 season, adding two new host cities and a mid-season showcase event.

## What's new

The league grows to sixteen teams and moves several stops to larger arenas. Organizers cited record 2025 attendance as the driver.

## Why it matters

A bigger pro calendar means more nationally televised pickleball and more qualifying pathways for amateur players hoping to break through.
`;

const RULEBOOK_BODY = `USA Pickleball published its 2026 rulebook update, clarifying the spin serve and refreshing equipment standards.

## The headline changes

- Continued prohibition of the pre-spin ("chainsaw") serve.
- Updated paddle testing for surface roughness and deflection.
- Clearer language on the two-bounce rule for officials.

## What players should do

Recreational players won't notice most of this, but tournament competitors should re-check that their paddle appears on the approved equipment list before registering.
`;

async function main(): Promise<void> {
  await upsertAuthor({
    authorId: AUTHOR_ID,
    name: "Jamie Reyes",
    slug: "jamie-reyes",
    credentials: "USAP-certified coach · 4.5 DUPR",
    bio: "Jamie is a certified pickleball coach who has taught hundreds of beginners the soft game in Lawrence, KS.",
    socials: { instagram: "@coachjamiepickle" },
  });

  await createContent({
    id: "c-dinking-basics",
    slug: "dinking-basics",
    category: "guides",
    title: "Dinking Basics: The Soft Game That Wins Points",
    excerpt:
      "The soft game separates beginners from winners. Learn what a dink is, why it wins rallies, and how to hit one consistently.",
    body: DINKING_BODY,
    authorId: AUTHOR_ID,
    authorName: "Jamie Reyes",
    keyTakeaways: [
      "A dink is a soft shot that lands in the kitchen so it can't be attacked.",
      "Dinking removes your opponent's power and forces unforced errors.",
      "Get low, use your shoulder (not your wrist), and aim past the net.",
    ],
    faq: [
      {
        question: "What is a dink in pickleball?",
        answer:
          "A dink is a soft shot hit on the bounce that arcs just over the net and lands in the non-volley zone, so your opponent can't attack it.",
      },
      {
        question: "Why is dinking so important?",
        answer:
          "Dinking neutralizes power and forces your opponent into errors — most rally-ending mistakes happen during long dink exchanges.",
      },
    ],
    relatedCityKey: LAWRENCE,
    tags: ["strategy", "beginner", "technique"],
    publishedAt: "2026-05-01T15:00:00.000Z",
  });

  await createContent({
    id: "c-choosing-paddle",
    slug: "how-to-choose-your-first-paddle",
    category: "gear",
    title: "How to Choose Your First Pickleball Paddle",
    excerpt:
      "Weight, grip size, and core material make or break your first paddle. Here's how to pick one without overspending.",
    body: PADDLE_BODY,
    authorId: AUTHOR_ID,
    authorName: "Jamie Reyes",
    keyTakeaways: [
      "Weight is the biggest factor — midweight (7.3–8.4 oz) suits most beginners.",
      "Pick a grip you can hold snugly; when unsure, size down and add an overgrip.",
      "A $60–$100 midweight composite paddle is plenty to start.",
    ],
    tags: ["gear", "beginner", "paddles"],
    publishedAt: "2026-05-08T15:00:00.000Z",
  });

  await createContent({
    id: "c-rules-explained",
    slug: "pickleball-rules-explained",
    category: "rules",
    title: "Pickleball Rules Explained: Scoring, Serving, and the Kitchen",
    excerpt:
      "Everything a new player needs before their first game — scoring, the underhand serve, the two-bounce rule, and the kitchen.",
    body: RULES_BODY,
    authorId: AUTHOR_ID,
    authorName: "Jamie Reyes",
    keyTakeaways: [
      "Games go to 11, win by 2, and only the serving side can score.",
      "The two-bounce rule: the serve and the return must both bounce.",
      "You can't volley while standing in the kitchen (non-volley zone).",
    ],
    tags: ["rules", "beginner"],
    publishedAt: "2026-05-15T15:00:00.000Z",
  });

  await createNews({
    id: "n-mlp-2026-season",
    slug: "mlp-announces-expanded-2026-season",
    title: "MLP Announces Expanded 2026 Season",
    excerpt:
      "Major League Pickleball grows to sixteen teams, adds two host cities, and introduces a mid-season showcase.",
    body: MLP_BODY,
    topics: ["pro-tour", "events"],
    source: { name: "Major League Pickleball", url: "https://www.majorleaguepickleball.net" },
    // News is time-relative; stamp recent so it lands in the 48h Google-News window.
    publishedAt: new Date(Date.now() - 4 * 3600e3).toISOString(),
  });

  await createNews({
    id: "n-usap-2026-rulebook",
    slug: "usa-pickleball-updates-2026-rulebook",
    title: "USA Pickleball Updates the 2026 Rulebook",
    excerpt:
      "The 2026 rulebook clarifies the spin serve and refreshes paddle equipment standards ahead of the tournament season.",
    body: RULEBOOK_BODY,
    topics: ["rules", "equipment"],
    source: { name: "USA Pickleball", url: "https://usapickleball.org" },
    relatedContentIds: ["c-rules-explained"],
    publishedAt: new Date(Date.now() - 28 * 3600e3).toISOString(),
  });

  console.log(
    "Seeded content: 1 author (jamie-reyes), 3 published articles (guides/gear/rules), 2 published news items (pro-tour/events, rules/equipment).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
