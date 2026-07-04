// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";
import type { UserProfileItem } from "@/lib/db/types";

/**
 * <ProfileEditor> username — regression for M17: the availability query is
 * `enabled: isSlug(username)`, so for a NON-slug username (space, underscore, uppercase,
 * trailing hyphen, cleared) it never ran → `availability` stayed undefined → the field
 * was stuck at "Checking availability…" with no error and Save permanently disabled. The
 * fix validates the slug locally so a non-slug reads as invalid immediately.
 */
const profile: UserProfileItem = {
  pk: "USER#u1",
  sk: "PROFILE",
  entity: "USER",
  uid: "u1",
  username: "existinguser",
  displayName: "Existing User",
  visibility: "public",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

vi.mock("@/lib/api/profile", () => ({
  useMyProfile: () => ({ data: profile, isLoading: false }),
  useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  // The real hook is `enabled: isSlug(username)` → a non-slug never resolves (undefined).
  useUsernameAvailable: () => ({ data: undefined }),
  useMyRatings: () => ({ data: [], isLoading: false }),
  useUpsertRating: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteRating: () => ({ mutate: vi.fn(), isPending: false }),
  useConnectDupr: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/account/CityPicker", () => ({
  CityPicker: () => <div data-testid="city-picker" />,
}));

const { ProfileEditor } = await import("@/components/account/ProfileEditor");

describe("<ProfileEditor> username availability (M17)", () => {
  it("a non-slug username shows an actionable error, not a stuck 'Checking availability…'", async () => {
    render(<ProfileEditor />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bad_name" } });

    // Post-fix: an immediate, actionable error (pre-fix: none — availability stayed undefined,
    // so `valid === false` never triggered and no error rendered).
    expect(await screen.findByText("Use lowercase letters, numbers, and hyphens.")).toBeInTheDocument();
    // And it is NOT stuck pretending to check a query that can never run.
    expect(screen.queryByText("Checking availability…")).toBeNull();
  });
});
