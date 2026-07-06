/**
 * lib/legal/docs.ts — the structured copy for the six site legal documents
 * (PRD §16). Rendered by `app/legal/[doc]/page.tsx` as crawlable, indexable HTML.
 *
 * ⚠ GENERIC BOILERPLATE — NOT LEGAL ADVICE. Every document below is reasonable,
 * brand-appropriate placeholder text written to be complete and internally
 * consistent, NOT a substitute for counsel. Before launch, HAVE A QUALIFIED
 * ATTORNEY review and adapt all six documents to the entity, jurisdiction(s),
 * data-processing reality, and regulatory regime PickleLoko actually operates in
 * (e.g. GDPR/CCPA specifics, arbitration/venue clauses, refund law).
 *
 * All brand-identity values (name, legal entity, support email, site URL) come
 * from `brand.config` — never hardcode them here (PRD §2.3).
 */

import { brand } from "@/brand.config";

/** The six legal documents, in canonical order (drives `generateStaticParams`). */
export const LEGAL_DOC_SLUGS = [
  "terms",
  "privacy",
  "cookies",
  "accessibility",
  "refund",
  "community-guidelines",
] as const;

export type LegalDocSlug = (typeof LEGAL_DOC_SLUGS)[number];

/** One section of a legal document: a heading + body paragraphs (+ optional list). */
export interface LegalSection {
  heading: string;
  /** Body paragraphs, rendered as `<p>` in order. */
  body: string[];
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: string[];
}

export interface LegalDoc {
  slug: LegalDocSlug;
  /** Page `<h1>` + `<title>` (the brand suffix is added by the title template). */
  title: string;
  /** Short label for cross-links / breadcrumbs (e.g. "Privacy"). */
  navLabel: string;
  /** Meta description (also the lede paragraph under the title). */
  description: string;
  /** Machine-readable effective date (ISO 8601) for `<time dateTime>`. */
  effectiveIso: string;
  /** Human-readable effective date (kept in sync with `effectiveIso`). */
  effectiveLabel: string;
  sections: LegalSection[];
}

const NAME = brand.identity.name;
const LEGAL_NAME = brand.identity.legalName;
const SUPPORT = brand.identity.supportEmail;
const SITE = brand.siteUrl;

/**
 * Single effective date for the boilerplate set. When counsel revises a document,
 * bump its own `effectiveIso`/`effectiveLabel` (they are per-doc for that reason).
 */
const EFFECTIVE_ISO = "2026-07-01";
const EFFECTIVE_LABEL = "July 1, 2026";

/** A trailing "questions?" section reused across documents. */
function contactSection(topic: string): LegalSection {
  return {
    heading: "Contact us",
    body: [
      `Questions about ${topic}? Email ${SUPPORT} or write to ${LEGAL_NAME} at the mailing address published on our contact page. We aim to respond within a reasonable time.`,
    ],
  };
}

export const legalDocs: Record<LegalDocSlug, LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    navLabel: "Terms",
    description: `The agreement between you and ${NAME} when you use our website, apps, and services.`,
    effectiveIso: EFFECTIVE_ISO,
    effectiveLabel: EFFECTIVE_LABEL,
    sections: [
      {
        heading: "1. Agreement to these terms",
        body: [
          `These Terms of Service ("Terms") are a binding agreement between you and ${LEGAL_NAME} ("${NAME}", "we", "us"). They govern your access to and use of ${SITE}, our mobile and web applications, and the features, tools, and content we make available (together, the "Services").`,
          `By creating an account, checking in at a court, organizing or joining an event, or otherwise using the Services, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Services.`,
        ],
      },
      {
        heading: "2. Who may use the Services",
        body: [
          `You must be at least 13 years old (or the minimum age of digital consent in your country) to use the Services, and old enough to form a binding contract to make purchases or organize paid events. If you use the Services on behalf of an organization, you represent that you are authorized to bind that organization to these Terms.`,
        ],
      },
      {
        heading: "3. Your account",
        body: [
          `You are responsible for the accuracy of the information on your account and for keeping your login credentials secure. You are responsible for activity that happens under your account. Notify us promptly at ${SUPPORT} if you believe your account has been compromised.`,
        ],
      },
      {
        heading: "4. Free tools and paid services",
        body: [
          `Many features are free to use, including the court directory, court check-ins, player discovery, and the round-robin generator. Some features are paid — for example, registering for or organizing tournaments, leagues, and ladders. When a feature is paid, the price, any applicable platform fee, and the payment terms are shown before you complete a purchase.`,
          `Payments are processed by our third-party payment provider. By making or accepting a payment through the Services you also agree to that provider's terms. Additional details are in our Refund & Cancellation Policy.`,
        ],
      },
      {
        heading: "5. Community conduct and content",
        body: [
          `You retain ownership of the content you post — reviews, photos, event details, messages, and profile information. You grant ${NAME} a non-exclusive, worldwide, royalty-free license to host, display, and distribute that content as needed to operate and promote the Services.`,
          `You agree to follow our Community Guidelines. You are solely responsible for your content and conduct, and you must not post anything unlawful, harassing, deceptive, or infringing. We may remove content or suspend accounts that violate these Terms or the Community Guidelines.`,
        ],
      },
      {
        heading: "6. Events, courts, and other players",
        body: [
          `${NAME} is a platform that helps people find courts, games, and events and organize their own. We do not own or operate the courts and venues listed, and we are not a party to the games, outings, tournaments, leagues, or ladders that users organize. Court information is provided on a best-effort basis and may be incomplete or out of date — confirm details with the venue before you go.`,
          `Pickleball is a physical activity with inherent risks. You participate in play and events at your own risk and are responsible for your own health, safety, and equipment.`,
        ],
      },
      {
        heading: "7. Acceptable use",
        body: [`When using the Services, you agree not to:`],
        bullets: [
          "Break the law, infringe others' rights, or violate these Terms or the Community Guidelines.",
          "Scrape, crawl, or harvest data except as expressly permitted, or bypass any access or rate controls.",
          "Interfere with, disrupt, or attempt to gain unauthorized access to the Services or related systems.",
          "Upload malware, or post spam, fraudulent listings, or fake reviews.",
          "Impersonate any person or misrepresent your affiliation with any person or organization.",
        ],
      },
      {
        heading: "8. Intellectual property",
        body: [
          `The Services, including the ${NAME} name, logo, design, and software, are owned by ${LEGAL_NAME} and protected by intellectual-property laws. Except for the rights we grant you to use the Services, no rights are transferred to you.`,
        ],
      },
      {
        heading: "9. Disclaimers",
        body: [
          `The Services are provided "as is" and "as available" without warranties of any kind, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Services will be uninterrupted, error-free, or accurate.`,
        ],
      },
      {
        heading: "10. Limitation of liability",
        body: [
          `To the fullest extent permitted by law, ${LEGAL_NAME} and its officers, employees, and partners will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising out of your use of the Services. Nothing in these Terms limits liability that cannot be limited under applicable law.`,
        ],
      },
      {
        heading: "11. Changes and termination",
        body: [
          `We may update these Terms from time to time. When we make material changes we will update the effective date above and, where appropriate, notify you. Your continued use of the Services after changes take effect means you accept the revised Terms. We may suspend or terminate your access if you violate these Terms.`,
        ],
      },
      {
        heading: "12. Governing law",
        body: [
          `These Terms are governed by the laws of the jurisdiction in which ${LEGAL_NAME} is established, without regard to conflict-of-law rules. The specific venue, arbitration, and dispute-resolution terms will be finalized with counsel before launch.`,
        ],
      },
      contactSection("these Terms"),
    ],
  },

  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    navLabel: "Privacy",
    description: `How ${NAME} collects, uses, shares, and protects your personal information — and the choices you have.`,
    effectiveIso: EFFECTIVE_ISO,
    effectiveLabel: EFFECTIVE_LABEL,
    sections: [
      {
        heading: "Overview",
        body: [
          `This Privacy Policy explains how ${LEGAL_NAME} ("${NAME}", "we", "us") handles personal information when you use ${SITE} and our related apps and services. We aim to collect only what we need to run the Services and to be transparent about how it is used.`,
        ],
      },
      {
        heading: "Information we collect",
        body: [`We collect information in three ways:`],
        bullets: [
          "Information you provide — your name, email, profile details, skill rating, reviews, photos, event details, and messages.",
          "Information created as you use the Services — court check-ins, saved courts, RSVPs, registrations, and preferences.",
          "Information collected automatically — device and browser data, IP address, approximate location, and usage analytics collected through cookies and similar technologies (see our Cookie Policy).",
        ],
      },
      {
        heading: "How we use information",
        body: [`We use personal information to:`],
        bullets: [
          "Provide, maintain, and improve the Services and personalize your experience.",
          "Process payments and registrations for paid events through our payment provider.",
          "Send transactional messages (confirmations, reminders, receipts) and, where permitted, product and marketing updates you can opt out of.",
          "Keep the community safe — detecting fraud, abuse, and violations of our Terms and Community Guidelines.",
          "Meet legal, tax, and regulatory obligations.",
        ],
      },
      {
        heading: "How we share information",
        body: [
          `We do not sell your personal information. We share it only as needed to operate the Services: with service providers who process data on our behalf (for example, hosting, email delivery, analytics, and payments); with other users where you choose to make information public (such as a public profile, a review, or an event you organize); and where required by law or to protect rights and safety. If we are involved in a merger or acquisition, information may be transferred as part of that transaction.`,
        ],
      },
      {
        heading: "Your choices and rights",
        body: [
          `Depending on where you live, you may have rights to access, correct, delete, or port your personal information, and to object to or restrict certain processing. You can manage much of your information directly in your account settings, and you can unsubscribe from marketing email at any time.`,
          `To exercise a privacy right — including a "do not sell or share my personal information" request — email ${SUPPORT}. We will verify and respond to your request as required by applicable law.`,
        ],
      },
      {
        heading: "Data retention and security",
        body: [
          `We keep personal information for as long as your account is active or as needed to provide the Services, and thereafter as required to meet legal obligations, resolve disputes, and enforce our agreements. We use reasonable technical and organizational measures to protect information, though no method of transmission or storage is completely secure.`,
        ],
      },
      {
        heading: "Children",
        body: [
          `The Services are not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child has provided us information, contact ${SUPPORT} and we will delete it.`,
        ],
      },
      {
        heading: "International transfers",
        body: [
          `We may process and store information in countries other than the one you live in. Where required, we use appropriate safeguards for cross-border transfers.`,
        ],
      },
      {
        heading: "Changes to this policy",
        body: [
          `We may update this Privacy Policy from time to time. Material changes will be reflected in the effective date above and, where appropriate, communicated to you.`,
        ],
      },
      contactSection("your privacy or this policy"),
    ],
  },

  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    navLabel: "Cookies",
    description: `What cookies and similar technologies ${NAME} uses, why we use them, and how to control them.`,
    effectiveIso: EFFECTIVE_ISO,
    effectiveLabel: EFFECTIVE_LABEL,
    sections: [
      {
        heading: "What are cookies?",
        body: [
          `Cookies are small text files stored on your device when you visit a website. We also use similar technologies such as local storage and pixels. Together we call these "cookies" in this policy. They help the Services work and help us understand how they are used.`,
        ],
      },
      {
        heading: "How we use cookies",
        body: [`We use cookies for the following purposes:`],
        bullets: [
          "Strictly necessary — sign-in, security, and core functionality. The Services cannot work properly without these.",
          "Preferences — remembering settings such as your theme (light or dark) and recent locations.",
          "Analytics — understanding which pages and features are used so we can improve them.",
          "Advertising — where enabled, supporting relevant, measurable advertising on ad-supported pages.",
        ],
      },
      {
        heading: "Third-party cookies",
        body: [
          `Some cookies are set by the third-party services we use — for example analytics, payments, maps, and (where applicable) advertising partners. Those providers process data under their own privacy policies.`,
        ],
      },
      {
        heading: "Managing cookies",
        body: [
          `You can control cookies through your browser settings, including deleting existing cookies and blocking new ones. Blocking strictly-necessary cookies may prevent parts of the Services from working. Where required by law, we present a consent choice for non-essential cookies, which you can change at any time.`,
        ],
      },
      contactSection("our use of cookies"),
    ],
  },

  accessibility: {
    slug: "accessibility",
    title: "Accessibility Statement",
    navLabel: "Accessibility",
    description: `${NAME}'s commitment to building a product that works for everyone, and how to reach us with accessibility feedback.`,
    effectiveIso: EFFECTIVE_ISO,
    effectiveLabel: EFFECTIVE_LABEL,
    sections: [
      {
        heading: "Our commitment",
        body: [
          `${NAME} is committed to making pickleball more accessible — both on the court and in our product. We want everyone, including people with disabilities, to be able to find courts, connect with players, and organize games.`,
        ],
      },
      {
        heading: "Standards we aim for",
        body: [
          `We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. In practice, that means we work to ensure the Services support keyboard navigation, sufficient color contrast, resizable text, screen-reader labeling, and clear focus indicators, and that we never rely on color alone to convey meaning.`,
        ],
      },
      {
        heading: "Ongoing work",
        body: [
          `Accessibility is an ongoing effort. We test with assistive technologies and refine as the product evolves, and some areas may not yet fully meet our goals. We welcome your feedback to help us prioritize improvements.`,
        ],
      },
      {
        heading: "Giving feedback or requesting help",
        body: [
          `If you encounter an accessibility barrier, or you need information in a different format, email ${SUPPORT} with a description of the issue and the page or feature involved. We will do our best to help and to fix the problem.`,
        ],
      },
    ],
  },

  refund: {
    slug: "refund",
    title: "Refund & Cancellation Policy",
    navLabel: "Refunds",
    description: `How refunds and cancellations work for paid tournaments, leagues, and ladders on ${NAME}.`,
    effectiveIso: EFFECTIVE_ISO,
    effectiveLabel: EFFECTIVE_LABEL,
    sections: [
      {
        heading: "Free vs. paid features",
        body: [
          `Most of ${NAME} is free to use, including the court directory, check-ins, player discovery, and the round-robin generator. This policy applies only to paid registrations — for example, entering a tournament, league, or ladder, or organizing a paid event.`,
        ],
      },
      {
        heading: "Organizer-set policies",
        body: [
          `Each paid event is run by its organizer, who sets the registration price and may set an event-specific refund policy (for example, a cutoff date after which registrations are non-refundable). The organizer's policy is shown at the time of registration and applies to that event. Where an organizer's policy conflicts with this general policy, the organizer's stated policy governs the event, to the extent permitted by law.`,
        ],
      },
      {
        heading: "Platform fees",
        body: [
          `When a refund is issued, any third-party payment-processing charges and the ${NAME} platform fee may be non-refundable, depending on the reason for the refund. As a general rule, if an organizer cancels an event, the platform fee is refunded along with the registration; if a registrant cancels, the registration may be refunded per the organizer's policy while the platform fee may be retained.`,
        ],
      },
      {
        heading: "How to request a refund",
        body: [
          `To request a refund, first contact the event organizer through the event page. If you cannot reach the organizer or believe a charge is incorrect, email ${SUPPORT} with your registration details and we will help mediate. Approved refunds are returned to your original payment method; the time to appear on your statement depends on your bank or card issuer.`,
        ],
      },
      {
        heading: "Cancelled or changed events",
        body: [
          `If an event is cancelled, you are generally entitled to a refund of your registration. If an event's date, location, or format changes materially, the organizer will communicate options, which may include a refund. Nothing in this policy limits any refund rights you have under applicable consumer-protection law.`,
        ],
      },
      contactSection("a payment, refund, or cancellation"),
    ],
  },

  "community-guidelines": {
    slug: "community-guidelines",
    title: "Community Guidelines",
    navLabel: "Community Guidelines",
    description: `The house rules that keep ${NAME} welcoming, safe, and fun — on the court and online.`,
    effectiveIso: EFFECTIVE_ISO,
    effectiveLabel: EFFECTIVE_LABEL,
    sections: [
      {
        heading: "Play it forward",
        body: [
          `${NAME} exists to help people play more pickleball with more people. These guidelines apply everywhere you interact on the platform — profiles, reviews, photos, messages, and the events you organize or join. They work alongside our Terms of Service.`,
        ],
      },
      {
        heading: "Be respectful",
        body: [
          `Treat other players, organizers, and venues the way you would want to be treated. Good sportsmanship, welcoming newcomers, and honest communication keep the community strong.`,
        ],
      },
      {
        heading: "What's not allowed",
        body: [`To keep everyone safe, don't:`],
        bullets: [
          "Harass, bully, threaten, or discriminate against anyone, including on the basis of race, gender, religion, disability, age, or sexual orientation.",
          "Post hateful, violent, sexually explicit, or otherwise inappropriate content.",
          "Impersonate others, or post fake reviews, spam, or misleading event or court listings.",
          "Share other people's private information without their consent.",
          "Use the platform for anything illegal or dangerous.",
        ],
      },
      {
        heading: "Reviews and photos",
        body: [
          `Reviews should reflect genuine, first-hand experience. Photos should be yours to share and appropriate for a general audience. Don't post content designed to promote or attack a business unfairly.`,
        ],
      },
      {
        heading: "Organizing events",
        body: [
          `If you organize a game, tournament, league, or ladder, describe it accurately, honor what you advertise, and follow the rules of the venue you use. Be clear about costs, formats, and any refund policy.`,
        ],
      },
      {
        heading: "Fair play and Rally Points",
        body: [
          `${NAME} rewards real play with Rally Points, levels, and badges. Keep it honest: fabricated check-ins, farming or trading points, fake or coordinated reviews, and other attempts to game these features are not allowed. We may reverse Rally Points, remove badges or standings, and — for serious or repeated abuse — issue a moderation strike that can void your points and any Elite eligibility.`,
        ],
      },
      {
        heading: "Reporting and enforcement",
        body: [
          `If you see something that breaks these guidelines, report it or email ${SUPPORT}. We review reports and may remove content, issue warnings, or suspend or remove accounts that violate these guidelines or our Terms. We try to be fair and proportionate, and serious or repeated violations may result in a permanent ban.`,
        ],
      },
    ],
  },
};

/** Look up a legal document by slug (returns `undefined` for an unknown slug). */
export function getLegalDoc(slug: string): LegalDoc | undefined {
  return (LEGAL_DOC_SLUGS as readonly string[]).includes(slug)
    ? legalDocs[slug as LegalDocSlug]
    : undefined;
}
