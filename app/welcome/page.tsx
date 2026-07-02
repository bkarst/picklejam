import type { Metadata } from "next";
import { WelcomeFlow } from "@/components/account/WelcomeFlow";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return <WelcomeFlow />;
}
