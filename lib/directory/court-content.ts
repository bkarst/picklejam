/**
 * court-content.ts — data-driven court copy (features checklist + FAQ) for the
 * court detail page. Everything derives from the court item so the FaqAccordion
 * text matches the FAQPage JSON-LD (§3.4) and reflects only real facts.
 */

import type { CourtItem } from "@/lib/db/types";

const AMENITY_LABEL: Record<string, string> = {
  lighted: "LED lighting",
  restrooms: "Restrooms",
  water: "Water fountain",
  "wheelchair accessible": "Wheelchair accessible",
  food: "Food available",
  "pro-shop": "Pro shop",
  "locker-rooms": "Locker rooms",
  training: "Training available",
  youth: "Youth programs",
  adaptive: "Adaptive programs",
};

/** The "Surface & Features" checklist (§6.1 court detail). */
export function surfaceFeatures(court: CourtItem): string[] {
  const out: string[] = [];
  if (court.surface?.length) out.push(`${court.surface.join(", ")} surface`);
  if (court.lines) out.push(`${cap(court.lines)} lines`);
  if (court.nets) out.push(`${cap(court.nets)} nets`);
  if ((court.indoorCourts ?? 0) > 0) out.push(`${court.indoorCourts} indoor court${court.indoorCourts === 1 ? "" : "s"}`);
  if ((court.outdoorCourts ?? 0) > 0) out.push(`${court.outdoorCourts} outdoor court${court.outdoorCourts === 1 ? "" : "s"}`);
  for (const a of court.amenities ?? []) out.push(AMENITY_LABEL[a.toLowerCase()] ?? cap(a));
  if (court.facilityType) out.push(`Facility type: ${cap(court.facilityType)}`);
  return out;
}

/** Data-driven court FAQ (§3.4 FAQPage). */
export function courtFaq(court: CourtItem): { question: string; answer: string }[] {
  const faq: { question: string; answer: string }[] = [];
  const name = court.name;

  faq.push({
    question: "How much does it cost to play here?",
    answer:
      court.access === "free"
        ? `${name} offers free public pickleball play.`
        : court.access === "membership"
          ? `${name} requires a membership to play.${court.accessDetails ? ` ${court.accessDetails}` : ""}`
          : court.access === "reservation"
            ? `${name} is reservation-based.${court.accessDetails ? ` ${court.accessDetails}` : ""}`
            : court.access === "one-time"
              ? `${name} charges a one-time or drop-in fee.${court.accessDetails ? ` ${court.accessDetails}` : ""}`
              : `Contact ${name} for current pricing and access details.`,
  });

  faq.push({
    question: "Are the courts indoor or outdoor?",
    answer:
      (court.indoorCourts ?? 0) > 0 && (court.outdoorCourts ?? 0) > 0
        ? `${name} has both — ${court.indoorCourts} indoor and ${court.outdoorCourts} outdoor court(s).`
        : (court.indoorCourts ?? 0) > 0
          ? `${name} has ${court.indoorCourts} indoor court(s) for year-round play.`
          : `${name} has ${court.outdoorCourts ?? court.totalCourts} outdoor court(s).`,
  });

  if (court.lighted) {
    faq.push({
      question: "Are the courts lighted for evening play?",
      answer: `Yes — ${name} has lighted courts for evening play.`,
    });
  }
  if (court.hasReservations && court.reservationUrl) {
    faq.push({
      question: "Can I reserve a court?",
      answer: `Yes — ${name} accepts reservations. Use the reserve link on this page to book.`,
    });
  }
  return faq;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
