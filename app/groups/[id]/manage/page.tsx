import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/directory";
import { groupsHub, groupPath } from "@/lib/urls";
import { ManageGroupClient } from "./ManageGroupClient";

// An owner/admin console — never indexed, NO ads.
export const metadata: Metadata = {
  title: "Manage group",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function ManageGroupPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Groups", href: groupsHub() },
          { name: "Group", href: groupPath(id) },
          { name: "Manage" },
        ]}
      />
      <div className="mt-6">
        <ManageGroupClient groupId={id} />
      </div>
    </main>
  );
}
