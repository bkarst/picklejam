import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/directory";
import { groupsHub } from "@/lib/urls";
import { AcceptInviteClient } from "./AcceptInviteClient";

// An invite-acceptance surface — never indexed (tokens must not be crawled, §3.7).
export const metadata: Metadata = {
  title: "Group invite",
  robots: { index: false, follow: false },
};

type Params = Promise<{ handle: string }>;

export default async function AcceptInvitePage({ params }: { params: Params }) {
  const { handle } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Groups", href: groupsHub() }, { name: "Invite" }]} />
      <div className="mt-6">
        <AcceptInviteClient handle={handle} />
      </div>
    </main>
  );
}
