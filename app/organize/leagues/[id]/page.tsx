import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { LeagueOrganizerDashboard } from "@/components/leagues";

// Organizer dashboard: never indexed, and NO ads (a payment surface, §2.2).
export const metadata: Metadata = {
  title: "Manage league",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function OrganizeLeaguePage({ params }: { params: Params }) {
  if (!publicEnv.paidEventsEnabled) return <ComingSoon />;
  const { id } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <LeagueOrganizerDashboard lid={id} />
    </main>
  );
}
