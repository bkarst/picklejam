import type { Metadata } from "next";
import { Dashboard } from "@/components/account/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function AccountDashboardPage() {
  return <Dashboard />;
}
