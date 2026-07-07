// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { CourtCard } from "@/components/directory/CourtCard";
import { courtUrl } from "@/lib/urls";
import type { CourtItem } from "@/lib/db/types";

// next/image → plain <img> so the card renders deterministically under jsdom
// (mirrors AdSlot.test.tsx mocking next/navigation).
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

const court: CourtItem = {
  pk: "COURT#court-lcc",
  sk: "META",
  entity: "COURT",
  courtId: "court-lcc",
  name: "Lenexa Community Center",
  slug: "lenexa-community-center",
  cityKey: "us#kansas#lenexa",
  lat: 38.97,
  lng: -94.73,
  geohash: "9yuvb8p2",
  indoorCourts: 3,
  outdoorCourts: 1,
  totalCourts: 4,
  hasPickleball: true,
  lighted: true,
  dedicated: true,
  access: "membership",
  facilityType: "club",
  ratingAvg: 4.6,
  reviewCount: 286,
  photos: [
    {
      url: "https://cdn.filestackcontent.com/example.jpg",
      source: "user",
      visible: true,
      attribution: { name: "Sarah J." },
    },
  ],
};

describe("<CourtCard>", () => {
  it("links the court name to its canonical URL", () => {
    render(<CourtCard court={court} index={0} distanceMi={2.3} />);
    const link = screen.getByRole("link", { name: court.name });
    expect(link).toHaveAttribute("href", courtUrl(court));
    expect(courtUrl(court)).toBe("/courts/us/kansas/lenexa/lenexa-community-center");
  });

  it("renders derived amenity tags and the rating", () => {
    render(<CourtCard court={court} index={0} distanceMi={2.3} />);
    expect(screen.getByText("Indoor")).toBeInTheDocument();
    expect(screen.getByText("Outdoor")).toBeInTheDocument();
    expect(screen.getByText("Membership")).toBeInTheDocument();
    expect(screen.getByText("Club")).toBeInTheDocument();
    // stat line + rating text present
    expect(screen.getByText(/4 Courts/)).toBeInTheDocument();
    expect(screen.getByText("4.6")).toBeInTheDocument();
  });

  it("exposes an accessible favorite control", () => {
    render(<CourtCard court={court} />);
    expect(
      screen.getByRole("button", { name: `Favorite ${court.name}` }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<CourtCard court={court} index={0} distanceMi={2.3} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
