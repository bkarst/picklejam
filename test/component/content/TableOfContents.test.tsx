// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { TableOfContents, type TocItem } from "@/components/content/TableOfContents";

const items: TocItem[] = [
  { id: "gear", text: "Gear", level: 2 },
  { id: "the-serve", text: "The serve", level: 3 },
  { id: "rules", text: "Rules", level: 2 },
];

describe("<TableOfContents>", () => {
  it("renders in-page anchor links that work without JS (progressive enhancement)", () => {
    render(<TableOfContents items={items} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#gear", "#the-serve", "#rules"]);
    // Preserves heading order + text.
    expect(links.map((l) => l.textContent)).toEqual(["Gear", "The serve", "Rules"]);
  });

  it("is an accessible navigation landmark", () => {
    render(<TableOfContents items={items} title="On this page" />);
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
  });

  it("renders nothing when there are no headings", () => {
    const { container } = render(<TableOfContents items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = render(<TableOfContents items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
