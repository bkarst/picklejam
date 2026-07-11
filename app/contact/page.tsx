import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbListJsonLd, type JsonLd as JsonLdData } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { contactPath } from "@/lib/urls";
import { brand } from "@/brand.config";
import { ContactForm } from "./ContactForm";

/** Slow-changing marketing surface — rebuild at most once/day (§3, ISR). */
export const revalidate = 86400;

const NAME = brand.identity.name;
const SUPPORT = brand.identity.supportEmail;

/** Public social profiles for display (derived from the brand handles). */
const SOCIALS: { label: string; href: string; handle: string }[] = (() => {
  const { socials } = brand.identity;
  const strip = (h: string) => h.replace(/^@/, "");
  const out: { label: string; href: string; handle: string }[] = [];
  if (socials.twitter) out.push({ label: "X", href: `https://x.com/${strip(socials.twitter)}`, handle: socials.twitter });
  if (socials.instagram) out.push({ label: "Instagram", href: `https://www.instagram.com/${strip(socials.instagram)}`, handle: socials.instagram });
  if (socials.facebook) {
    const href = socials.facebook.startsWith("http") ? socials.facebook : `https://www.facebook.com/${strip(socials.facebook)}`;
    out.push({ label: "Facebook", href, handle: NAME });
  }
  return out;
})();

/** The ContactPage schema.org node (built inline; JsonLd accepts any JSON-LD object). */
function contactPageJsonLd(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${NAME}`,
    url: `${brand.siteUrl}${contactPath()}`,
    mainEntity: {
      "@type": "Organization",
      name: NAME,
      email: SUPPORT,
      url: brand.siteUrl,
    },
  };
}

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: `Contact ${NAME}`,
    description: `Get in touch with the ${NAME} team. Send us a message, email ${SUPPORT}, or find us on social.`,
    path: contactPath(),
    keywords: [`contact ${NAME.toLowerCase()}`, "pickleball app support"],
  });
}

export default function ContactPage(): JSX.Element {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Contact", url: `${base}${contactPath()}` },
          ]),
          organizationJsonLd(),
          contactPageJsonLd(),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />

      {/* Hero */}
      <section className="mt-6 flex flex-col items-start gap-4">
        <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Get in touch
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Questions, feedback, a court that needs fixing, or help running an event? We&apos;d love to
          hear from you. Send a message below and we&apos;ll reply by email.
        </p>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_18rem]">
        {/* Form */}
        <section aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" className="font-display text-xl font-bold text-foreground">
            Send us a message
          </h2>
          <div className="mt-5">
            <ContactForm />
          </div>
        </section>

        {/* Other ways to reach us */}
        <aside className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Email us</h2>
            <p className="mt-2 text-sm text-muted">Prefer email? Reach the team directly at:</p>
            <a
              href={`mailto:${SUPPORT}`}
              className="mt-2 inline-flex items-center font-medium text-foreground underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {SUPPORT}
            </a>
          </div>

          {SOCIALS.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-lg font-bold text-foreground">Follow along</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {SOCIALS.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <span className="font-medium text-foreground">{s.label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{s.handle}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Help &amp; policies</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <Link href="/pricing" className="text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  Pricing &amp; how it works
                </Link>
              </li>
              <li>
                <Link href="/legal/refund" className="text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  Refunds &amp; cancellations
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
