// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { screen, fireEvent, within } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";
import type { GroupItem } from "@/lib/db/types";

/**
 * L18 — a group with no home court was dead-ended: the meet-up scheduler told the owner to
 * "set a home court in Settings", but the Settings form had NO home-court field. The fix adds
 * a court picker to Settings that persists `homeCourtId`. These tests assert the field exists
 * and that saving it sends `homeCourtId` through the update mutation.
 */
const ME = "owner-1";

vi.mock("@/components/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { uid: ME, email: "o@example.com", displayName: "Owner" }, requireAuth: vi.fn() }),
}));

const mutateAsync = vi.fn().mockResolvedValue(undefined);
let groupData: {
  group: GroupItem;
  membership: { role: string; status: string } | null;
  members: unknown[];
  memberCount: number;
  meetups: unknown[];
  courts: Record<string, { name: string; url: string }>;
};

vi.mock("@/lib/api/groups", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/groups")>()),
  useGroup: () => ({ data: groupData, isLoading: false }),
  useUpdateGroup: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/lib/api/outings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/outings")>()),
  useCreateOuting: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The court typeahead: return a fixed court regardless of the query text.
vi.mock("@/lib/api/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/queries")>()),
  useSearchSuggest: () => ({
    data: {
      courts: [
        { courtId: "c-central", label: "Central Park Courts", url: "/courts/us/tx/austin/central", sublabel: "Austin, TX" },
      ],
    },
  }),
}));

// Keep the heavy roster/invite children out of the way (they fire their own queries).
vi.mock("@/components/groups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/groups")>();
  return { ...actual, InvitePanel: () => null, RosterManager: () => null };
});

const { ManageGroupClient } = await import("@/app/groups/[id]/manage/ManageGroupClient");

function makeGroup(overrides: Partial<GroupItem> = {}): GroupItem {
  return {
    pk: "GROUP#g1",
    sk: "META",
    entity: "GROUP",
    groupId: "g1",
    name: "East Austin Dinkers",
    description: "",
    visibility: "public",
    joinPolicy: "open",
    cityKey: "us#tx#austin",
    ownerId: ME,
    memberCount: 3,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as GroupItem;
}

beforeEach(() => {
  mutateAsync.mockClear();
  groupData = {
    group: makeGroup(), // NO homeCourtId → this is the dead-end case
    membership: { role: "owner", status: "active" },
    members: [],
    memberCount: 3,
    meetups: [],
    courts: {},
  };
});

describe("<ManageGroupClient> Settings home court (L18)", () => {
  it("renders a home-court picker in Settings (pre-fix: no such field → dead-end)", () => {
    render(<ManageGroupClient groupId="g1" />);
    expect(screen.getByRole("combobox", { name: "Search for a home court" })).toBeInTheDocument();
  });

  it("saving after picking a court sends homeCourtId to the update mutation", () => {
    render(<ManageGroupClient groupId="g1" />);

    const combo = screen.getByRole("combobox", { name: "Search for a home court" });
    fireEvent.change(combo, { target: { value: "central" } }); // ≥2 chars → opens the results list

    const option = screen.getByRole("option", { name: /Central Park Courts/ });
    fireEvent.mouseDown(option); // pick it

    // The picker now shows the selected court with a "Change" affordance.
    expect(screen.getByText("Central Park Courts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ homeCourtId: "c-central" }));
  });

  it("un-gates the meet-up scheduler once a home court is set", () => {
    // With a home court already set, the scheduler shows its inputs, not the 'set a court' notice.
    groupData.group = makeGroup({ homeCourtId: "c-central" });
    groupData.courts = { "c-central": { name: "Central Park Courts", url: "/courts/us/tx/austin/central" } };
    render(<ManageGroupClient groupId="g1" />);

    const scheduler = screen.getByRole("heading", { name: "Schedule a meet-up" }).closest("section")!;
    expect(within(scheduler).queryByText(/Set a home court in Settings/)).toBeNull();
    expect(within(scheduler).getByRole("textbox")).toBeInTheDocument(); // the title input is present
  });
});
