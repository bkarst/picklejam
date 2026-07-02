// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import LegalDocPage, { generateMetadata, generateStaticParams } from "@/app/legal/[doc]/page";
import { LEGAL_DOC_SLUGS, legalDocs } from "@/lib/legal/docs";

async function renderDoc(doc: string) {
  const ui = await LegalDocPage({ params: Promise.resolve({ doc }) });
  return render(ui);
}

describe("legal/[doc] page", () => {
  it("pre-renders exactly the six documents", () => {
    const params = generateStaticParams();
    expect(params.map((p) => p.doc).sort()).toEqual([...LEGAL_DOC_SLUGS].sort());
    expect(params).toHaveLength(6);
  });

  it("renders each legal doc with its title, effective date, and sections", async () => {
    for (const slug of LEGAL_DOC_SLUGS) {
      const { unmount } = await renderDoc(slug);
      const doc = legalDocs[slug];
      expect(screen.getByRole("heading", { level: 1, name: doc.title })).toBeInTheDocument();
      // Every section heading is a crawlable h2.
      for (const section of doc.sections) {
        expect(
          screen.getByRole("heading", { level: 2, name: section.heading }),
        ).toBeInTheDocument();
      }
      // Machine-readable effective date.
      const time = document.querySelector("time");
      expect(time).toHaveAttribute("dateTime", doc.effectiveIso);
      unmount();
    }
  });

  it("is indexable (no noindex robots) and canonical to /legal/<doc>", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ doc: "privacy" }) });
    expect(meta.alternates?.canonical).toBe("/legal/privacy");
    expect(meta.robots).toBeUndefined();
  });

  it("calls notFound() for an unknown doc", async () => {
    await expect(
      LegalDocPage({ params: Promise.resolve({ doc: "does-not-exist" }) }),
    ).rejects.toThrow();
  });

  it("emits BreadcrumbList JSON-LD", async () => {
    const { container } = await renderDoc("terms");
    const script = container.querySelector('script[type="application/ld+json"]');
    const parsed = JSON.parse(script?.textContent ?? "{}");
    expect(parsed["@type"]).toBe("BreadcrumbList");
  });

  it("has no axe violations", async () => {
    const { container } = await renderDoc("privacy");
    expect(await axe(container)).toHaveNoViolations();
  });
});
