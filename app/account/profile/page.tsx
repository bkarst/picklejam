import type { Metadata } from "next";
import { ProfileEditor } from "@/components/account/ProfileEditor";

export const metadata: Metadata = {
  title: "Profile & Ratings",
  robots: { index: false, follow: false },
};

export default function AccountProfilePage() {
  return <ProfileEditor />;
}
