import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { brand } from "@/brand.config";
import { Providers } from "./providers";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { AnalyticsBootstrap } from "@/components/analytics/AnalyticsBootstrap";
import { AdSenseLoader } from "@/components/ads/AdSlot";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PromoBanner } from "@/components/layout/PromoBanner";
import { HelpButton } from "@/components/layout/HelpButton";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.identity.name} — ${brand.identity.tagline}`,
    template: `%s | ${brand.identity.name}`,
  },
  description: brand.identity.description,
  applicationName: brand.identity.name,
  openGraph: {
    siteName: brand.identity.name,
    type: "website",
    locale: brand.og.locale,
  },
  twitter: {
    card: brand.og.twitterCard,
    site: brand.identity.socials.twitter,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.palette.cream },
    { media: "(prefers-color-scheme: dark)", color: "#141310" },
  ],
  colorScheme: "light dark",
};

/**
 * No-flash theme script. Mirrors HeroUI `useTheme`: reads localStorage
 * "heroui-theme" (default "system"), resolves via prefers-color-scheme, and
 * applies both the class and `data-theme` to <html> before first paint.
 */
const themeScript = `
(function(){try{
  var t=localStorage.getItem("heroui-theme")||"system";
  var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  var r=d?"dark":"light";
  var e=document.documentElement;
  e.classList.remove("light","dark");e.classList.add(r);
  e.setAttribute("data-theme",r);
}catch(_){}})();
`;

/**
 * Google Consent Mode v2 default — runs BEFORE any ad/analytics tag (PRD §2.2).
 * Everything defaults to DENIED; `ConsentProvider.syncConsentMode` flips the
 * relevant signals to 'granted' via `gtag('consent','update',…)` once the user
 * consents (that is the consent-update bridge). Defining `window.gtag` here is
 * what makes those updates land (otherwise they no-op).
 */
const consentModeDefaultScript = `
(function(){
  window.dataLayer=window.dataLayer||[];
  function gtag(){window.dataLayer.push(arguments);}
  if(!window.gtag){window.gtag=gtag;}
  window.gtag('consent','default',{
    ad_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied',
    analytics_storage:'denied',
    wait_for_update:500
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fredoka.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Consent Mode v2 default (DENIED) — must run before any ad/analytics tag. */}
        <script dangerouslySetInnerHTML={{ __html: consentModeDefaultScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {/* Sitewide structured data (§3.4 — Organization + WebSite+Searchbox). */}
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
        >
          Skip to main content
        </a>
        <Providers>
          <ConsentProvider>
            <AnalyticsBootstrap />
            {/* AdSense library — consent-gated + only when a publisher id is set. */}
            <AdSenseLoader />
            <PromoBanner />
            <Header />
            {children}
            <Footer />
            <HelpButton />
            <ConsentBanner />
          </ConsentProvider>
        </Providers>
      </body>
    </html>
  );
}
