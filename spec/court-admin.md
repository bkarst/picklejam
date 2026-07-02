# PickleLoko — Court Administration PRD (deferred / post-launch)

> **Status:** ⏳ **Not in the initial build.** This document carves the crowdsourced **court contribution** and **facility management** functionality out of the core PRD so the initial build ships against a *seeded* court directory. Implement after launch.
> **Companion docs:** [`pickle-loko-prd.md`](./pickle-loko-prd.md) (core architecture, data schema §9, SEO) · [`pickle-loko-ui-spec.md`](./pickle-loko-ui-spec.md) (build-exact UI for the launched product) · [`pickleheads-features.md`](./pickleheads-features.md) (precedent — PH §6, §16).
> **Conventions:** same as the UI spec — **structure & behavior only**, no visual styling (the designer chooses color/type/iconography). Wireframe legend: `▓`=media · `●`=avatar · `[ Label ]`=control · `( Option ▾ )`=select · `☐`=checkbox.

---

## 1. Why this is deferred (and how courts exist at launch)

The court directory is the SEO flywheel, so it must be **populated on day one** — but it does **not** need user-generated contribution to be populated. At launch the directory is **seeded by bulk import** from **`data/<state>.yml`** (~16,311 courts; scraping/licensing + cleanup — the schema mapping + ingestion pipeline are in core PRD **§9.8**) and curated internally. That gives complete, indexable city/court pages without any member-facing add/edit/claim UI.

**Crowdsourced contribution and facility self-service are a Phase-2 layer** that improves data freshness and opens a facility/organizer on-ramp once there's an audience to contribute. They're deferred because they add a **moderation/anti-abuse burden** and a **verification workflow** that aren't worth standing up before launch.

**Consequence for the initial build:** the core UI spec ships *without* the "Add a court", "Suggest an edit", "Claim this court", and "Add a photo" affordances and their empty-state CTAs. §6 below lists exactly where those entry points re-attach when this ships.

---

## 2. Scope

Four surfaces:
1. **Add a Court** — crowdsourced submission of a missing court → moderation → publish.
2. **Suggest an Edit** — propose corrections to an existing court → moderation → patch.
3. **Claim a Court** — a facility manager/owner verifies and takes over a listing (facility on-ramp).
4. **Admin Moderation Queue** — internal tool to review submissions, edits, and claims.

Out of scope here (live elsewhere): review moderation (core PRD), payments/Stripe (core), the public court detail page itself (UI spec §4.5).

---

## 3. Member-facing views

### 3.1 Add a Court — `/courts/new` · CSR wizard · auth · noindex
**Wireframe:**
```
Add a Court                                          (H1) · step 1 of 4
── 1 Where is it? ──
  [ Search address or drop a pin ]      ‹ map with draggable pin ›
  Detected: 123 Main St, Lenexa, KS 66215
  ⚠ A court may already exist here → [ Lenexa Community Center ]   (dup check)
                                              [ Back ] [ Next ]
2 Basics:   name · # courts (stepper) · access (Public/Private/Pay) · indoor/outdoor
3 Details:  surface · nets (perm/portable/BYO) · lines · lighting · amenities (checklist) · hours
4 Photos & confirm:  [ + upload photos ] · note (optional) · [ Submit for review ]
```
**Contents/behavior:** (1) **Location** — address search + draggable map pin; reverse-geocode to address + city hierarchy; **duplicate detection** surfaces nearby candidates → links to the existing court instead of creating a dupe. (2) **Basics**, (3) **Details** as listed. (4) **Photos & confirm** — upload + submitter note + submit. Submission enters the **moderation queue** (status *pending review*); success → "Thanks — we'll review and publish, usually within a day" + "Add another."
**States:** per-step validation; duplicate found → suggest existing; submit loading; auth gate resumes the wizard on sign-in.
**Data:** writes a **pending COURT** (status=pending) + moderation-queue projection (§4). **SEO:** noindex (the published court page carries SEO).

### 3.2 Suggest an Edit — `/courts/[…]/[court]/edit` (also a modal from Court Detail) · CSR · auth · noindex
**Wireframe:**
```
┌ Suggest an edit · Lenexa Community Center ──────────── ✕ ┐
│ What needs fixing?   ( Field ▾ ) e.g. Court count / Surface / Hours │
│ Current: 3 courts          Suggested: [ 4 ]                │
│ Add a note (optional)  [                              ]    │
│ Add a photo (optional) [ + ]                               │
│                              [ Cancel ]  [ Submit edit ]   │
└─────────────────────────────────────────────────────────────┘
```
**Contents/behavior:** field selector (which attribute), current value (read-only) vs suggested value, optional note + photo evidence; multiple fields can be queued. Submits a **suggested-edit** item to moderation; on approval, patches the court (Stream-reconciled aggregates). Success toast.
**States:** validation; auth-gated; rate-limited. **Data:** edit-suggestion item linked to COURT (§4).

### 3.3 Claim this Court — `/courts/[…]/[court]/claim` · CSR wizard · auth · noindex
**Wireframe:**
```
Claim Lenexa Community Center                        (H1) · step 1 of 3
1 Your connection:  ( I manage / own this facility ▾ ) · role · organization
2 Verify ownership:  ☐ Business-email match  ☐ Phone callback  ☐ Upload proof
3 What you get:  manage listing · post schedules · promote · run events
                                              [ Submit claim ]
```
**Contents/behavior:** relationship/role + org; **verification method** (email-domain match, phone callback, document upload); benefits explainer + link to Pricing (facility tier). Submits a claim → on approval grants **manage rights** over the court (edit listing, post official schedules, a "claimed/verified" badge on the court page). Success → "Claim submitted — we'll verify and follow up."
**States:** pending / verified / denied; auth-gated. **Data:** claim item + (on approval) a court-manager grant (§4). **On-ramp:** → Pricing (facility tier) + Organize.

---

## 4. Admin Moderation Queue — `/admin/moderation` · SSR · **admin-only** · noindex

Internal tool (not member-facing). Backs all three contribution flows.
**Wireframe:**
```
Moderation                                           (H1)
( Pending courts · 12 | Suggested edits · 5 | Claims · 3 )      (tabs w/ counts)
┌ queue list ──────────────────┬─ detail / review ───────────────────────────┐
│ ● New court: "Maple Park"     │  Submitted by ● user · 2h ago               │
│   Lenexa, KS · 2h             │  ‹ map preview › 123 Maple St…              │
│ ● Edit: court count 3→4       │  Fields: name, 4 courts, outdoor, lighted…  │
│ ● Claim: Lenexa CC (KC Club)  │  ⚠ possible dup: [ Lenexa Community Center ]│
│ …                             │  [ Approve & publish ] [ Request info ] [ Reject ▾ ] │
└───────────────────────────────┴───────────────────────────────────────────────┘
```
**Contents/behavior:**
- **Tabs** with backlog counts: Pending courts · Suggested edits · Claims.
- **Queue list** (oldest-first) → **detail pane** per type:
  - *New court:* full submission preview + map + **duplicate candidates**; Approve (publishes the COURT, flips status, triggers sitemap/ISR revalidate), Request more info, Reject (reason).
  - *Suggested edit:* **field diff** (current → suggested) + evidence; Approve applies the patch (Stream re-aggregates), or Reject.
  - *Claim:* claimant + org + verification evidence; Approve grants court-manager role + verified badge, or Deny.
- Bulk actions; audit log (who approved what, when); reject reasons (templated).
**States:** empty queue → "All caught up"; loading skeletons. **Access:** role-gated (admin/moderator); all actions audited.

---

## 5. Data schema additions (DynamoDB, single-table — extends core PRD §9)

```
Pending court   PK COURT#<courtId>      SK META   (status=pending)        ← Add-a-Court
                GSI1 MODQUEUE#COURT / <submittedAt>                        (moderation queue)
                attrs: …court attrs…, submittedBy, status(pending|approved|rejected), reviewedBy
Edit suggestion PK COURT#<courtId>      SK SUGGEST#<ts>#<id>               ← Suggest-an-Edit
                GSI1 MODQUEUE#EDIT / <submittedAt>                         (moderation queue)
                attrs: field, currentVal, suggestedVal, note, photoKey, submittedBy, status
Court claim     PK COURT#<courtId>      SK CLAIM#<uid>                     ← Claim-a-Court
                GSI1 MODQUEUE#CLAIM / <submittedAt>   (+ USER#<uid> / CLAIM#<courtId> for "my claims")
                attrs: role, org, verifyMethod, evidenceKey, status(pending|verified|denied), reviewedBy
Court manager   PK COURT#<courtId>      SK MANAGER#<uid>   attrs: role, grantedAt   (on claim approval)
```
- The **`MODQUEUE#…` GSIs** let the admin tool list each backlog with a single `Query` (oldest-first by `submittedAt`).
- **Approval semantics:** approving a pending court flips `status` to published and the existing COURT/META access patterns (core §9.5 #1, #2) pick it up; approving an edit patches COURT/META and lets Streams re-aggregate; approving a claim writes a `MANAGER#` grant that the court detail page reads to show the verified badge + unlock the manage UI.
- **Anti-abuse:** rate limits per user; duplicate detection on submit (geohash proximity, core §9.7); profanity/spam checks; all writes carry `submittedBy` for audit.

---

## 6. Integration points (what re-attaches to the core build when this ships)

When implemented, re-enable these entry points (currently **omitted** from the launched UI spec):
| Surface (UI spec) | Re-add |
|---|---|
| Court Detail §4.5 sidebar | "Claim this court →" + "Suggest an edit →" links |
| Court Detail §4.5 hero | "Add a photo" affordance on photoless courts |
| Map Finder §4.2 empty state | "…or add a court" CTA |
| City Directory §4.3 empty state | "Be the first to add a court in {City}" CTA |
| Footer §3.3 (Company column) | "Add a Court" link |
| Create Outing §10.3 step 1 | "Can't find it? Add a court" link |
| Global nav "Organize"/Facilities | facility self-service entry (claim → manage) |
Also add to the PRD **sitemap (§5)** and **master view index (§11)**: `/courts/new`, `/courts/[…]/edit`, `/courts/[…]/claim`, `/admin/moderation`.

---

## 7. Open questions
- Trust tiers: should high-reputation users' edits **auto-approve** (PH-style), bypassing the queue?
- Claim verification depth (email-domain match vs. manual doc review) and what manage-rights a verified claim unlocks.
- Whether facility management (post official schedules, promote) is its own paid tier — ties into Pricing (facility) and the core monetization model.
- Anonymous suggestions (no account) — allow for edits, or require auth for all contribution?

---

*Deferred PRD. Build the core product (`pickle-loko-prd.md` + `pickle-loko-ui-spec.md`) against a seeded directory first; layer this in post-launch.*
