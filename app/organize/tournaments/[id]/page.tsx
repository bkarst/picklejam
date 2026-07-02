import type { Metadata } from "next";
import { OrganizerDashboard } from "@/components/tournaments";

// Organizer dashboard: never indexed, and NO ads (a payment surface, §2.2).
export const metadata: Metadata = {
  title: "Manage tournament",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function OrganizeTournamentPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <OrganizerDashboard tid={id} />
    </main>
  );
}
