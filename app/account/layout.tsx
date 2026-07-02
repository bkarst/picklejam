import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";

/**
 * Account layout — noindex for the entire /account/* subtree (§3.7: these are
 * also disallowed in robots.txt). The interactive shell (sidebar + auth guard)
 * is a client component; this server layout owns the metadata that client pages
 * cannot export, so every child inherits the noindex robots directive.
 */
export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
