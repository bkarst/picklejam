import type { Metadata } from "next";
import type { JSX } from "react";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { roundRobinLanding, roundRobinQuizPath } from "@/lib/urls";
import { brand } from "@/brand.config";
import { QuizClient } from "./QuizClient";

export const revalidate = 86400;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Which round robin format is right for you?",
    description:
      "Answer four quick questions and we'll recommend the best pickleball round-robin format — round robin, mixer, Swiss, up & down the river, or pools to a bracket.",
    path: roundRobinQuizPath(),
  });
}

export default function RoundRobinQuizPage(): JSX.Element {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <JsonLd
        data={breadcrumbListJsonLd([
          { name: "Home", url: base },
          { name: "Round Robin", url: `${base}${roundRobinLanding()}` },
          { name: "Format quiz", url: `${base}${roundRobinQuizPath()}` },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Round Robin", href: roundRobinLanding() },
          { name: "Format quiz" },
        ]}
      />
      <div className="mt-6">
        <QuizClient />
      </div>
    </main>
  );
}
