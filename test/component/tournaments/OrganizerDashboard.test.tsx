// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";
import { makeDivision, usd } from "./_fixtures";
import type { TournamentFull } from "@/lib/api/tournaments";
import type { TourneyItem, RegistrationItem } from "@/lib/db/types";

/**
 * <OrganizerDashboard> — regression for M19: a per-row refund used
 * `mutateAsync(...).catch(() => {})`, swallowing failures entirely. The button flashed
 * "Refunding…" and reverted with the row still "paid" and ZERO feedback, so the organizer
 * believed it worked (or double-clicked, compounding the double-refund risk). The fix
 * surfaces the failure as an inline alert.
 */
const refundMut = { mutateAsync: vi.fn(), isPending: false };
let tournamentData: TournamentFull;
vi.mock("@/lib/api/tournaments", () => ({
  useTournament: () => ({ data: tournamentData, isLoading: false }),
  useRefundRegistration: () => refundMut,
}));

const { OrganizerDashboard } = await import("@/components/tournaments/OrganizerDashboard");

const tourney: TourneyItem = {
  pk: "TOURNEY#t1",
  sk: "META",
  entity: "TOURNEY",
  tid: "t1",
  title: "Lawrence Summer Slam",
  slug: "lawrence-summer-slam",
  cityKey: "us#ks#lawrence",
  organizerId: "org1",
  status: "published",
  startDate: "2026-07-08",
  currency: "usd",
  feeMode: "absorb",
  feePercentBps: 0,
  feeFixed: 0,
  connectedAccountId: "acct_1",
  elim: "single",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const reg: RegistrationItem = {
  pk: "TOURNEY#t1",
  sk: "REG#d1#u1",
  entity: "REGISTRATION",
  tid: "t1",
  did: "d1",
  uid: "u1",
  startDate: "2026-07-08",
  paymentStatus: "paid",
  amount: usd(2500),
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("<OrganizerDashboard> refund error feedback (M19)", () => {
  beforeEach(() => {
    refundMut.mutateAsync.mockReset();
    tournamentData = {
      tourney,
      divisions: [makeDivision({ did: "d1", name: "3.5 Singles", capacity: 8, registeredCount: 1 })],
      registrations: [reg],
    };
  });

  it("surfaces a failed refund inline instead of swallowing it, and unlocks the button", async () => {
    refundMut.mutateAsync.mockRejectedValue(new Error("Gateway declined the refund"));
    render(<OrganizerDashboard tid="t1" />);

    const btn = screen.getByRole("button", { name: "Refund" });
    fireEvent.click(btn);

    // Pre-fix: the rejection was swallowed (.catch(() => {})) → no alert ever appeared.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Gateway declined the refund");

    // The button is unlocked again (not stuck on "Refunding…").
    await waitFor(() => expect(screen.getByRole("button", { name: "Refund" })).toBeEnabled());
  });
});
