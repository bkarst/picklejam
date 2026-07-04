// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";
import { makeLeague, makeLeagueDivision } from "./_fixtures";
import type { LeagueFull } from "@/lib/api/leagues";

/**
 * <LeagueOrganizerDashboard> messaging — regression for M22: the "Send announcement"
 * textarea + button had NO onClick and no coming-soon labelling, so an organizer's
 * weather-cancellation notice was silently lost (there is no announcement backend). Until
 * a real send exists, the control must present honestly as disabled + coming-soon.
 */
let leagueData: LeagueFull;
vi.mock("@/lib/api/leagues", () => ({ useLeague: () => ({ data: leagueData, isLoading: false }) }));

const { LeagueOrganizerDashboard } = await import("@/components/leagues/LeagueOrganizerDashboard");

describe("<LeagueOrganizerDashboard> messaging (M22)", () => {
  it("presents the announcement control as coming-soon + disabled (not a silent no-op)", () => {
    leagueData = {
      league: makeLeague(),
      divisions: [makeLeagueDivision({ did: "d1" })],
      teams: [],
      registrations: [],
      schedule: [],
      standings: [],
      availability: [],
    };
    render(<LeagueOrganizerDashboard lid="l1" />);
    fireEvent.click(screen.getByRole("tab", { name: "Messaging" }));

    // Pre-fix: the button was enabled and clicking it silently did nothing.
    expect(screen.getByRole("button", { name: "Send announcement" })).toBeDisabled();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByLabelText("Announcement message")).toBeDisabled();
  });
});
