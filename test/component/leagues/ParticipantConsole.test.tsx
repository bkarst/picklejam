// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";
import { makeLeague, makeLeagueDivision, makeScheduleMatch, usd } from "./_fixtures";
import type { LeagueFull } from "@/lib/api/leagues";
import type { ScheduleMatchItem, LeagueRegistrationItem } from "@/lib/db/types";

/**
 * <ParticipantConsole> — regression for M16: the "This week's matchup" row
 * (<MatchConfirmRow>) seeds its handshake state from props at MOUNT only, and the parent
 * rendered it WITHOUT a key. So when a confirmed result advances `thisWeek` to the next
 * fixture, React reused the same instance → the panel showed the new week's header with
 * the PRIOR week's status/scores and no score-entry inputs. The fix keys the row on the
 * fixture id so it remounts (re-seeds) when the matchup changes.
 */
const ME = "u-me";

vi.mock("@/components/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { uid: ME, email: "me@example.com", displayName: "Me" }, requireAuth: vi.fn() }),
}));

const noopMut = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
let leagueData: LeagueFull;
vi.mock("@/lib/api/leagues", () => ({
  useLeague: () => ({ data: leagueData, isLoading: false }),
  useReportScore: () => noopMut,
  useConfirmScore: () => noopMut,
  useSetAvailability: () => noopMut,
}));

// Import AFTER the mocks so the component picks them up.
const { ParticipantConsole } = await import("@/components/leagues/ParticipantConsole");

const reg: LeagueRegistrationItem = {
  pk: "LEAGUE#l1",
  sk: `REG#${ME}`,
  entity: "LEAGUEREG",
  lid: "l1",
  uid: ME,
  did: "d1",
  startDate: "2026-07-08",
  paymentStatus: "paid",
  amount: usd(8000),
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function data(schedule: ScheduleMatchItem[]): LeagueFull {
  return {
    league: makeLeague({ playMode: "singles" }),
    divisions: [makeLeagueDivision({ did: "d1", playMode: "singles" })],
    teams: [], // singles → entrant id is the uid
    registrations: [reg],
    schedule,
    standings: [],
    availability: [],
  };
}

describe("<ParticipantConsole> keyed matchup remount (M16)", () => {
  it("advancing to the next fixture resets the row — new week's score entry, no stale state", () => {
    const w1 = makeScheduleMatch({
      mid: "m1",
      week: 1,
      confirmStatus: "reported",
      reportedBy: "opp", // opponent reported → I get confirm/dispute (not score entry)
      sideA: [ME],
      sideB: ["opp"],
      scoreA: 11,
      scoreB: 8,
    });
    const w2 = makeScheduleMatch({ mid: "m2", week: 2, confirmStatus: "scheduled", sideA: [ME], sideB: ["opp"] });

    leagueData = data([w1, w2]);
    const { rerender } = render(<ParticipantConsole lid="l1" />);

    // thisWeek = W1 (first non-confirmed, "reported") → confirm/dispute, NOT score entry.
    expect(screen.getByRole("button", { name: "Confirm score" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit score" })).toBeNull();

    // W1 gets confirmed → thisWeek advances to W2 (scheduled). WITH the key the row
    // REMOUNTS and shows W2's score entry; WITHOUT it the row keeps W1's "reported" state
    // (confirm/dispute) under a "Week 2" header, and score entry never appears.
    leagueData = data([{ ...w1, confirmStatus: "confirmed" }, w2]);
    rerender(<ParticipantConsole lid="l1" />);

    expect(screen.getByRole("button", { name: "Submit score" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm score" })).toBeNull();
  });
});
