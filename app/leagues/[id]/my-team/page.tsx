import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/directory";
import { ParticipantConsole } from "@/components/leagues";
import { leaguesHub } from "@/lib/urls";

// A participant / payment surface: never indexed, NO ads (§2.2).
export const metadata: Metadata = {
  title: "My team",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function MyTeamPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Leagues", href: leaguesHub() },
          { name: "My team" },
        ]}
      />
      <div className="mt-6">
        <ParticipantConsole lid={id} />
      </div>
    </main>
  );
}
