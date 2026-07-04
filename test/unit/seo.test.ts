import { describe, it, expect } from "vitest";
import {
  organizationJsonLd,
  webSiteJsonLd,
  breadcrumbListJsonLd,
  faqPageJsonLd,
} from "@/lib/seo/jsonld";
import { buildMetadata, cityTitle, courtTitle } from "@/lib/seo/metadata";
import { brand } from "@/brand.config";

describe("JSON-LD builders (§3.4)", () => {
  it("Organization is brand-sourced and well-formed", () => {
    const o = organizationJsonLd();
    expect(o["@context"]).toBe("https://schema.org");
    expect(o["@type"]).toBe("Organization");
    expect(o.name).toBe(brand.identity.name);
    expect(o.url).toBe(brand.siteUrl);
  });

  it("WebSite carries a Sitelinks-Searchbox SearchAction", () => {
    const w = webSiteJsonLd() as Record<string, { "@type"?: string }>;
    expect(w["@type"]).toBe("WebSite");
    expect(w.potentialAction?.["@type"]).toBe("SearchAction");
  });

  it("BreadcrumbList numbers positions 1..n in order", () => {
    const b = breadcrumbListJsonLd([
      { name: "Home", url: "https://x/" },
      { name: "Kansas", url: "https://x/kansas" },
    ]) as { itemListElement: { position: number; name: string }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].name).toBe("Kansas");
  });

  it("FAQPage maps Q/A to Question/Answer", () => {
    const f = faqPageJsonLd([{ question: "Q?", answer: "A." }]) as {
      mainEntity: { "@type": string; acceptedAnswer: { text: string } }[];
    };
    expect(f.mainEntity[0]["@type"]).toBe("Question");
    expect(f.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });
});

describe("metadata factory (§3.3)", () => {
  it("sets a relative canonical + noindex robots when requested", () => {
    const m = buildMetadata({
      title: "Test",
      path: "/courts/us/kansas/lawrence",
      noindex: true,
    });
    expect(m.alternates?.canonical).toBe("/courts/us/kansas/lawrence");
    expect(m.robots).toMatchObject({ index: false });
  });

  it("title patterns match §3.3", () => {
    expect(cityTitle(12, "Lawrence", "KS")).toBe("12 Best Pickleball Courts in Lawrence, KS");
    expect(courtTitle("Riverside")).toContain("Play Pickleball at Riverside");
  });
});

describe("segmented sitemap route (§3.7)", () => {
  it("M15: opts into ISR revalidation so segments aren't frozen at build", async () => {
    // `sitemap.js` is a Route Handler cached at BUILD by default; without a dynamic
    // config option every /sitemap/<id>.xml is generated once at deploy and never again
    // (outings advertises only the build day's window; news/tournaments/etc. never list
    // anything published after the build). A finite positive `revalidate` opts into ISR.
    const mod = await import("@/app/sitemap");
    expect(typeof mod.revalidate).toBe("number");
    expect(Number.isFinite(mod.revalidate as number)).toBe(true);
    expect(mod.revalidate as number).toBeGreaterThan(0);
  });
});
