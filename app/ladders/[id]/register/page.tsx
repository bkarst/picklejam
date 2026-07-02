import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLadder } from "@/lib/data/ladders";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/directory";
import { LadderRegisterPanel } from "@/components/ladders";
import { ladderPath, ladderRegisterPath, laddersHub } from "@/lib/urls";
import type { FeeConfig, Money } from "@/lib/money";

// A payment surface — render dynamically per request (no ISR) and NO ads (§2.2).
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const data = await getLadder(id);
  const path = ladderRegisterPath(id);
  if (!data) return buildMetadata({ title: "Join ladder", path, noindex: true });
  return buildMetadata({
    title: `Join — ${data.ladder.title}`,
    description: `Join ${data.ladder.title}.`,
    path,
    noindex: true,
  });
}

export default async function LadderRegisterPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getLadder(id);
  if (!data) notFound();
  const { ladder } = data;

  let cityLabel: string | undefined;
  if (ladder.cityKey) {
    const { country, state, city } = parseCityKey(ladder.cityKey);
    const cityItem = await getCity(country, state, city);
    const name = cityItem?.name ?? city.replace(/-/g, " ");
    cityLabel = `${name}, ${stateAbbr(state)}`;
  }

  const feeConfig: FeeConfig = {
    mode: ladder.feeMode,
    percentBps: ladder.feePercentBps,
    fixed: ladder.feeFixed,
  };

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Ladders", href: laddersHub() },
          { name: ladder.title, href: ladderPath(id) },
          { name: "Join" },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">Join the ladder</h1>
      <p className="mt-1 text-muted">{ladder.title}</p>

      <div className="mt-8">
        <LadderRegisterPanel
          lid={id}
          title={ladder.title}
          startDate={ladder.startDate}
          cityLabel={cityLabel}
          playMode={ladder.playMode}
          price={ladder.price as Money}
          feeConfig={feeConfig}
          challengeRange={ladder.challengeRange}
          responseWindowDays={ladder.responseWindowDays}
        />
      </div>
    </main>
  );
}
