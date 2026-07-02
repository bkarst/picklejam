import type { Metadata } from "next";
import { AlertsManager } from "@/components/community/AlertsManager";

/**
 * /account/alerts — notification preferences + recent notifications (PRD §6.3,
 * §9.3). noindex (per-user utility page); the interactive manager is a client
 * component, so this server wrapper owns the metadata it cannot export.
 */
export const metadata: Metadata = {
  title: "Alerts",
  robots: { index: false, follow: false },
};

export default function AccountAlertsPage() {
  return <AlertsManager />;
}
