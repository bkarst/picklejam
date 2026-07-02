import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/directory";
import { groupsHub } from "@/lib/urls";
import { NewGroupClient } from "./NewGroupClient";

// An authoring surface — never indexed (§3.7).
export const metadata: Metadata = {
  title: "Start a group",
  robots: { index: false, follow: false },
};

export default function NewGroupPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Groups", href: groupsHub() },
          { name: "Start a group" },
        ]}
      />
      <div className="mt-6">
        <NewGroupClient />
      </div>
    </main>
  );
}
