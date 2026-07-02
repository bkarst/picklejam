// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { KeyTakeaways } from "@/components/content/KeyTakeaways";

const items = ["Get a paddle you like", "Learn the two-bounce rule", "Play with better players"];

describe("<KeyTakeaways>", () => {
  it("renders every takeaway as a list item", () => {
    render(<KeyTakeaways items={items} />);
    for (const t of items) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("labels the callout region and heading", () => {
    render(<KeyTakeaways items={items} />);
    expect(screen.getByRole("complementary", { name: "Key takeaways" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key takeaways" })).toBeInTheDocument();
  });

  it("self-hides when empty", () => {
    const { container } = render(<KeyTakeaways items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = render(<KeyTakeaways items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
