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

const NETS_LABEL: Record<string, string> = {
  permanent: "Permanent",
  portable: "Portable",
  byo: "Bring your own",
  tennis: "Tennis",
};

export interface CourtSpec {
  label: string;
  value: string;
}

export interface CourtAmenity {
  /** Normalized lowercase key — the `SurfaceFeatures` icon map is keyed off this. */
  key: string;
  label: string;
}

/** "Surface & Features" court-setup specs — key→value facts (§6.1 court detail). */
export function courtSpecs(court: CourtItem): CourtSpec[] {
  const out: CourtSpec[] = [];
  const counts = [
    (court.indoorCourts ?? 0) > 0 ? `${court.indoorCourts} indoor` : null,
    (court.outdoorCourts ?? 0) > 0 ? `${court.outdoorCourts} outdoor` : null,
  ].filter(Boolean);
  if (counts.length) out.push({ label: "Courts", value: counts.join(" · ") });
  else if ((court.totalCourts ?? 0) > 0) out.push({ label: "Courts", value: String(court.totalCourts) });
  if (court.surface?.length) out.push({ label: "Surface", value: cap(court.surface.join(", ")) });
  if (court.lines) out.push({ label: "Lines", value: cap(court.lines) });
  if (court.nets) out.push({ label: "Nets", value: NETS_LABEL[court.nets] ?? cap(court.nets) });
  if (court.facilityType) out.push({ label: "Facility", value: cap(court.facilityType) });
  return out;
}

/** "Surface & Features" amenities — the has/has-not facility offerings (§6.1). */
export function courtAmenities(court: CourtItem): CourtAmenity[] {
  const out: CourtAmenity[] = [];
  for (const a of court.amenities ?? []) {
    const key = a.toLowerCase();
    out.push({ key, label: AMENITY_LABEL[key] ?? cap(a) });
  }
  // `lighted` is a top-level fact; surface it as an amenity when the list omits it.
  if (court.lighted && !out.some((a) => a.key === "lighted")) {
    out.unshift({ key: "lighted", label: AMENITY_LABEL.lighted });
  }
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
