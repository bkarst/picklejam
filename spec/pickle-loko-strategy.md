# PickleLoko — Product Strategy

> **Document type:** Strategy (the *why* — North Star, metric tree, measurement priorities)
> **Author:** Product, drafted 2026-06-30
> **Companion docs:** [`pickle-loko-prd.md`](./pickle-loko-prd.md) (build requirements; the analytics **stack + event taxonomy** are specced there in **§2.1**) · [`pickle-loko-ui-spec.md`](./pickle-loko-ui-spec.md) · [`../research/seo-keyword-research.md`](../research/seo-keyword-research.md) (**KW**) · [`pickleheads-features.md`](./pickleheads-features.md) (**PH**)

> **Boundary with the PRD.** The PRD is what's required to *build*. This doc is what we're *optimizing for* — it specifies no views, schema, or instrumentation wiring. The analytics **stack and event taxonomy** are build requirements and live in **PRD §2.1**; the **North Star and metric tree** are strategy and live here.

---

## 1. North Star — Weekly Active Players (WAP)

**Definition.** Distinct players who took ≥1 **play action** in the week — a confirmed signal that a real game happened or was committed to:
- a **check-in** at a court,
- an **outing attendance** (RSVP = *going* on an outing that has occurred),
- a **match played** in a round robin, league, ladder, or tournament.

**Why this metric:**
- **Measures delivered value, not vanity.** The product's real-world job is to help people *play more pickleball*; a check-in and a league match both count, uniting the free and paid surfaces under one number.
- **Retention-weighted.** Being *weekly* and *per-player*, churn surfaces immediately — unlike cumulative signups or total traffic.
- **Leads revenue without being revenue.** More active players → more organizer demand → more paid events. GMV / take-rate is the lagging output; WAP is the leading input product can actually move.

**What it is _not_: organic sessions / indexed pages.** The obvious pick (SEO is goal 1) is a trap — making traffic the North Star incentivizes publishing *more thin pages*, the doorway-content risk (review S2 / SEO1). Organic reach is the **#1 input metric**, not the goal.

**Guardrail.** WAP is only as trustworthy as its inputs. Anonymous check-ins are currently spoofable (review T2); harden them — or weight the play-action definition toward authenticated actions — before check-ins feed the North Star, or it becomes gameable.

*Depth lives in the tree as an input, not a second headline — see "plays per active player" under Goal 2 (§2).*

## 2. Metric tree (mapped to PRD §1 goals)

```
NORTH STAR ── Weekly Active Players (WAP)
│
├─ Goal 1: Win court-finder SEO   (ACQUISITION — the #1 input, not the NSM)
│    • Organic clicks & impressions (Search Console, by page template)
│    • % of pages indexed  ← thin-content early warning (review S2 / SEO1)
│    • Rank for target clusters: "court near me", "tournaments near me", "round robin generator"
│    • New-visitor → signup rate
│
├─ Goal 2: Build the community graph   (ACTIVATION + RETENTION)
│    • Activation: signup → first play action within 7 days
│    • Rating connected (DUPR) / profile completion  ← gates paid eligibility
│    • W1 / W4 retention of activated players
│    • Plays per active player (frequency: check-ins, RSVPs, matches)
│
├─ Goal 3: Acquire organizers for free   (THE WEDGE)
│    • Round robins created / week
│    • RR → "upgrade" click-through (by source)
│    • Outing host → league-create rate
│
└─ Goal 4: Monetize organizers   (REVENUE — lagging output)
     • Stripe Connect onboardings completed
     • Paid events published / week
     • GMV → net revenue (service fee + platform take)
     • Registrations / week; registrant → repeat-registrant
     • Revenue per organizer  ← the high-LTV "league software" buyer (KW $12.50 CPC)
```

## 3. Measurement sequencing

1. **Phase 0 (pre-launch):** Search Console + GA4 + real-user CWV/error monitoring + the consent gate, all live. You can't improve SEO you can't see.
2. **Phase 1 (launch):** server-side emission of the monetization/play events (PRD §2.1) into PostHog; one dashboard showing **WAP** and the goal-1 reach metrics. WAP derives from the play-events; revenue cuts join Stripe data.
3. **Phase 2 (post-PMF signal):** funnel + retention analysis, feature flags, and on-ramp experiments (PostHog) against the §8 conversion moments.

## 4. Targets

Per-goal targets / OKRs are **TBD**: establish baselines during Phase 0–1, then commit numeric targets. The instrumentation that feeds them is specced in **PRD §2.1**.
