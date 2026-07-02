// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { ReviewsModule } from "@/components/community/ReviewsModule";
import type { ReviewItem } from "@/lib/db/types";

/**
 * ReviewsModule — the court "Reviews" block (§6.4). We assert the SSR-crawlable
 * bits: the review text from `initialReviews` renders straight away (render moat,
 * §14.4), the average + histogram are present, and the block is axe-clean.
 */
function review(over: Partial<ReviewItem> & Pick<ReviewItem, "uid" | "rating1to5">): ReviewItem {
  return {
    pk: `COURT#c1`,
    sk: `REVIEW#${over.uid}`,
    entity: "REVIEW",
    courtId: "c1",
    createdAt: "2026-05-18T12:00:00.000Z",
    ...over,
  };
}

const reviews: ReviewItem[] = [
  review({
    uid: "u1",
    rating1to5: 5,
    title: "Great facility",
    body: "Lighting is excellent and staff are friendly.",
    tags: ["lighting", "crowd"],
    helpfulCount: 3,
    checkinVerified: true,
    createdAt: "2026-05-18T12:00:00.000Z",
  }),
  review({
    uid: "u2",
    rating1to5: 4,
    title: "Solid indoor courts",
    body: "Gets busy in the evenings but worth the wait.",
    helpfulCount: 1,
    createdAt: "2026-05-17T12:00:00.000Z",
  }),
];

describe("<ReviewsModule>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("renders the initial reviews in the crawlable HTML", () => {
    render(
      <ReviewsModule courtId="c1" initialReviews={reviews} ratingAvg={4.6} reviewCount={2} />,
    );
    expect(screen.getByText("Great facility")).toBeInTheDocument();
    expect(screen.getByText(/Lighting is excellent/)).toBeInTheDocument();
    expect(screen.getByText("Solid indoor courts")).toBeInTheDocument();
    expect(screen.getByText("4.6")).toBeInTheDocument();
  });

  it("renders the rating histogram", () => {
    render(
      <ReviewsModule courtId="c1" initialReviews={reviews} ratingAvg={4.6} reviewCount={2} />,
    );
    expect(screen.getByRole("list", { name: "Rating breakdown" })).toBeInTheDocument();
  });

  it("offers a gated write-a-review action", () => {
    render(
      <ReviewsModule courtId="c1" initialReviews={reviews} ratingAvg={4.6} reviewCount={2} />,
    );
    expect(screen.getByRole("button", { name: "Write a review" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ReviewsModule courtId="c1" initialReviews={reviews} ratingAvg={4.6} reviewCount={2} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
