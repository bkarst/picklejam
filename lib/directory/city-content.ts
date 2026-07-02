/**
 * city-content.ts — data-driven city copy (subtitle + FAQ) for the city directory.
 *
 * FAQ answers are derived from the actual court set (never fabricated) so the
 * FAQPage JSON-LD (§3.4) reflects real facts — Google penalizes fake FAQ markup.
 */

import type { CourtItem } from "@/lib/db/types";

export function citySubtitle(cityName: string, locations: number, courts: number): string {
  return (
    `Find ${locations} place${locations === 1 ? "" : "s"} to play pickleball in ${cityName}, ` +
    `with ${courts} court${courts === 1 ? "" : "s"}. Explore public parks, rec centers, and ` +
    `private facilities — perfect for casual games, leagues, and tournaments.`
  );
}

export function cityFaq(
  cityName: string,
  courts: CourtItem[],
): { question: string; answer: string }[] {
  const total = courts.length;
  const totalCourts = courts.reduce((s, c) => s + (c.totalCourts ?? 0), 0);
  const free = courts.filter((c) => c.access === "free").length;
  const indoor = courts.filter((c) => (c.indoorCourts ?? 0) > 0).length;
  const lighted = courts.filter((c) => c.lighted).length;
  const dedicated = courts.filter((c) => c.dedicated).length;

  const faq: { question: string; answer: string }[] = [
    {
      question: `Are there pickleball courts in ${cityName}?`,
      answer: `Yes — there ${total === 1 ? "is" : "are"} ${total} place${total === 1 ? "" : "s"} to play pickleball in ${cityName}, with ${totalCourts} court${totalCourts === 1 ? "" : "s"} total.`,
    },
    {
      question: `Are the pickleball courts in ${cityName} free to use?`,
      answer:
        free > 0
          ? `${free} of ${total} location${total === 1 ? "" : "s"} in ${cityName} offer free public play; the rest may require a membership, reservation, or one-time fee.`
          : `Most courts in ${cityName} require a membership, reservation, or one-time fee — check each listing for access details.`,
    },
    {
      question: `Are there indoor pickleball courts in ${cityName}?`,
      answer:
        indoor > 0
          ? `Yes — ${indoor} location${indoor === 1 ? "" : "s"} in ${cityName} ${indoor === 1 ? "has" : "have"} indoor courts for year-round play.`
          : `Most pickleball courts in ${cityName} are outdoor. Check individual listings for the latest details.`,
    },
  ];

  if (lighted > 0) {
    faq.push({
      question: `Which ${cityName} pickleball courts have lights?`,
      answer: `${lighted} location${lighted === 1 ? "" : "s"} in ${cityName} ${lighted === 1 ? "has" : "have"} lighted courts for evening play.`,
    });
  }
  if (dedicated > 0) {
    faq.push({
      question: `Are there dedicated pickleball courts in ${cityName}?`,
      answer: `Yes — ${dedicated} location${dedicated === 1 ? "" : "s"} in ${cityName} ${dedicated === 1 ? "has" : "have"} dedicated courts with permanent nets and lines.`,
    });
  }
  return faq;
}
