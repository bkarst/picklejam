@AGENTS.md

## Design principles — Apple Human Interface Guidelines (HIG)

This app's user interface should follow Apple's **Human Interface Guidelines (HIG)**, expressed through the project's brand identity and HeroUI v3 theme (HIG guides the *principles*; the brand config and theme own the *values*).

At the foundation are three **core design principles**:
- **Clarity** — interfaces are easy to read and focused; avoid unnecessary content or decoration that serves no clear purpose.
- **Deference** — UI stays subtle and unobtrusive so the content takes center stage; motion, depth, and transitions support rather than distract from the user's primary focus.
- **Depth** — visual hierarchy through layered visuals and meaningful transitions helps users understand their current context and navigate effectively.

**Layout & structure.** Adaptive designs that work across screen sizes; proper safe areas and margins so UI elements display correctly regardless of dimensions or orientation; respect established conventions (navigation bars, tab bars, gestures); support adaptive layouts and larger text sizes.

**Navigation.** Prioritize simplicity and predictability — familiar patterns for top-level navigation and hierarchical drill-down; users always know where they are and have an obvious path back.

**Aesthetic & style.** Prefer system / design-system-provided elements; fully support both **Light and Dark Mode**, plus enhanced-contrast and larger-text accessibility. Animations and motion are purposeful and meaningful, reinforcing the interface's logic rather than serving as decoration.

**Controls & components.** Use known, native-feeling controls; every interactive element meets the minimum tappable size (**44×44pt**); provide appropriate visual/haptic/audio feedback so users understand when an action has registered.

**Accessibility** is a fundamental requirement, not an afterthought: support screen readers, text scaling, and high-contrast settings; **never rely on color alone** to convey important information; every interactive element is properly labeled and accessible.

## UI rules

- **Every action gets an immediate UI response** — even if something is loading for a second.
- **Loading states:** use [HeroUI Skeletons](https://heroui.com/docs/react/components/skeleton) wherever possible.
- **Selectable things have a hover state.**
- **Optimistic UI updates:** on edit/delete (etc.), give immediate feedback instead of waiting for the call to complete; if the call fails, provide a way to revert the UI.
- ***Very important — use HeroUI v3 components whenever possible*** (https://heroui.com). Prefer the proper v3 component over hand-rolled equivalents: `ToggleButtonGroup` for segmented pills/tab switchers, `ComboBox` (with `useAsyncList` for remote data) for search-and-pick inputs, `Select` for dropdowns, `DatePicker` for dates, `Chip`/`Skeleton`/`Modal`/`Table`/toast for their respective jobs. HeroUI v3 components are **compound** (e.g. `Select.Trigger`/`Select.Popover`, `DateField.Group fullWidth` containing `DateField.Input` + `DateField.Suffix`) — when unsure of a composition, check the docs at `heroui.com/docs/react/components/<name>` rather than guessing; a wrong composition can render but silently break (e.g. a zero-width date input). Tables need `isRowHeader` on one `Table.Column`. **Do NOT use HeroUI `Card` components — use plain `div`s with Tailwind classes** to avoid excessive container nesting and keep the DOM flat and clean.
- **HeroUI v3 Tooltip** (`Tooltip` / `Tooltip.Trigger` / `Tooltip.Content` / `Tooltip.Arrow`): **do NOT nest a `<button>` or HeroUI `<Button>` inside `Tooltip.Trigger`** — it already renders its own focusable pressable, and a nested second pressable swallows the hover events so the tooltip never appears. Put the icon/content directly inside `Tooltip.Trigger`, apply sizing/`cursor-pointer`/color to the trigger, and pass it `aria-label`. **Always set `delay={0} closeDelay={0}`** (the 1500ms default reads as broken). Encode both in a reusable tooltip component.
- ***Very important — every new UI component must work on both mobile and desktop.***
- ***Very important — after building or changing any UI, verify it in Chrome*** (Claude-in-Chrome). Don't consider UI work done until you've actually looked at it. At minimum: load the view, check the console for errors/warnings (`read_console_messages`), and toggle the device toolbar / resize to phone width (~390px) to confirm it's mobile-friendly — no horizontal overflow, tap targets ≥44×44pt, nothing clipped or overlapping — as well as desktop width (`resize_window` / device emulation). This is also where you confirm **UI design fidelity** (below).
- **Saving a court is a "Favorite" in the UI — "follow" only under the hood.** Surface the save action with **favorite iconography (the heart) and "Favorite" / "Favorited" language**, never "Follow" / "Following". It still persists a court *follow* (`useFollowCourt` → `/api/courts/{courtId}/follow`, analytics `court_followed`); only the icon and copy are "favorite". Reference: the court detail page's `FollowButton` renders a heart + "Favorite"/"Favorited", matching the card `SaveHeartButton`. Match this anywhere the save action appears.

## UI design fidelity

When building, tweaking, or testing any UI, compare the rendered view against its design image in `design/views/` (per-view mockups, named by view — e.g. `4.5-court-detail.png`, `10.2-outing-detail.png`). Where a design file exists for that view, the UI **must** match it — if it doesn't, edit and tweak the implementation until it does. The design images are the visual source of truth.

## Feature flags

No generic flag module — flags live in three places: build-time env vars, one Firebase Remote Config value, and per-user gamification prefs. `NEXT_PUBLIC_*` flags are **inlined into the client bundle at build**, so flipping one needs a rebuild/deploy, not a runtime change.

- **Paid events** — `NEXT_PUBLIC_PAID_EVENTS_ENABLED` → `publicEnv.paidEventsEnabled` (`lib/env.ts`). Default **off**. Master switch for paid tournaments/leagues/ladders: while off, the create/register routes 404 and every paid entry point (nav, hub/discover/city-finder CTAs) is hidden; the free app is unaffected. Gate any new paid surface behind `publicEnv.paidEventsEnabled`.
- **Ads** — remote **`ads_enabled`** via **Firebase Remote Config**, read server-side by `getAdsEnabled()` (`lib/ads/ads-enabled.server.ts`), cached ~5 min, handed to client `<AdSlot>`s through `<AdsFlagProvider>` (SSR-gated, no CLS). Default **false** and fully fail-safe (any error/timeout ⇒ off). Also gated by `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` and the static `ads.enabled` master switch in `brand.config.ts`. The Remote Config parameter lives in the **Firebase project** (`pickle-jam`) — recreate `ads_enabled` there or it stays off.
- **Gamification holdout** — `GAMIFY_HOLDOUT_ENABLED=1` → `resolveHoldout()` (`lib/gamify/prefs.ts`). Default **off**. The G18 retention experiment: buckets ~10% of users (by uid hash) into a holdout that sees no gamification surfaces (RP still accrues silently). Effective visibility is `prefs.enabled && !holdout`; the per-user `prefs.enabled` is a user preference, not a global flag.
- **Dev auth** — `ALLOW_DEV_AUTH=1` (`lib/auth/verify.ts`). Accepts deterministic dev tokens for local/CI. **Never** honored when `APP_ENV=Production`, regardless of the var.

Not feature flags despite the name: Stripe Connect `chargesEnabled`/`payoutsEnabled` (account status, `lib/stripe/gateway.ts`); per-outing `waitlistEnabled` (`Boolean(outing.waitlist)`); the `gamification_enabled` analytics event property.

## DynamoDB migrations

- New migrations use **on-demand** capacity, never provisioned throughput.
- For simple GSI creation, use the AWS CLI directly instead of writing a migration script.
