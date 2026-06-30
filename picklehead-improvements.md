# Pickleheads — Improvement Ideas

**Date:** 2026-06-29
**Context:** Product/feature brainstorm informed by reverse-engineering Pickleheads' court data model (see `pickleheads-scrape-report.md`). Relevant to building **picklerpal** — i.e. where Pickleheads is weak = the opportunity.

> ⚠️ **Caveat:** these observations come from the **data/API layer** and public pages only, not the full mobile app. Treat "they don't have X" as "X isn't in the court data model I saw," not as certain. Notably, the 40-field court record had **no rating/review field** and **no check-in/presence field**.

## The core insight

Pickleheads is **excellent at the static directory layer** — ~18k US facilities with address, coordinates, court counts, amenities, surface, access type, hours, and photos. It is **thin on the live, social, and trust layers.** That gap is the opportunity. The static directory is table stakes (we now have 16k courts of it in `./data/`); the **live + social layers are the moat.**

---

## The two prompted ideas

### Reviewed courts — strong
Court *quality* varies wildly (surface cracks, net quality, wind, lighting, crowding, whether the posted fee is accurate) and none of that lives in Pickleheads' static attributes. Do it better than generic 5-stars:

- **Structured sub-ratings** — surface condition, lighting, crowdedness, net/lines quality, noise. Far more decision-useful than a single star average.
- **Recency-weighted, with photo timestamps.** A court resurfaced last spring shouldn't be judged on a 2022 review. This also quietly fixes the **staleness problem** (the scrape found ~2,100 court pages that exist but aren't surfaced in search, plus geocoding errors like courts filed under "united-states").
- **Watch out for:** cold-start review volume, spam/moderation.

### Check-ins — highest-leverage
Answers the actual #1 player question a directory structurally can't: *"is anyone there to play right now, and how busy is it?"* Pickleheads has *scheduled* games; check-ins add the **spontaneous / real-time** layer.

- **Network effects:** check-ins create presence ("4 players here now") → pulls more people → drives more check-ins. Strong engagement/retention flywheel.
- **Anonymous check-ins (privacy):** many players won't broadcast their identity/location, so support **anonymous check-ins** — they still increment the "N players here now" count and feed busyness/popular-times without exposing who. Make it the default/easy option, with opt-in named check-ins for those who *want* to be seen (e.g. to attract a game at their level). The count is the network-effect driver; identity is optional on top.
- **Watch out for:** needs local density to feel alive (launch city-by-city), privacy/opt-in location, and auto-expiring/decaying presence so it never goes stale. Anonymous check-ins reduce the privacy barrier to participation but make abuse/inflation easier — rate-limit per device/location and decay aggressively.

---

## Other high-value gaps (ranked)

1. **Structured, crowd-verified open-play schedules.** Pickleheads stores schedule as free text (e.g. `schedule_details: "Only available for open play."`) and `facility_hours` is often flat or empty. Structured "open play by day / time / skill level," kept current by the crowd, is a big concrete win.
2. **Real-time busyness / "popular times"** (Google-style) — derived from check-ins + any reservation data. Direct extension of check-ins.
3. **Freshness & verification** — "last verified" badges, one-tap "courts closed / nets down / resurfacing," flag-stale prompts. Crowd-sourced directories rot; making freshness visible builds trust.
4. **Skill-based matchmaking** — DUPR integration + "players at my level near me now." Ratings are central to pickleball and absent from the court layer.
5. **Booking depth** — Pickleheads only stores a `reservation_url` (a link). Real in-app reservation / court-status beats a deep link.
6. **Court status & weather** — outdoor courts are weather-dependent; a "playable now?" signal (wind/rain) is high-value.

---

## Where to place the bet

**Check-ins → presence → busyness** is the flywheel: it's the one player problem a directory can't solve, and it compounds via network effects. **Reviews** are the trust layer that makes the directory worth returning to. Everything else builds on those two.

## Suggested first slice for picklerpal

Build **check-ins / presence on top of the court dataset** already in `./data/` — the most natural first feature:
- Data model: `check_in (id, court_id, user_id NULLABLE, is_anonymous, created_at, expires_at, note, skill_level)`; `user_id` is null for anonymous check-ins. Derive `presence_count` (counts anonymous + named) and `popular_times` from it.
- Court reference: key off the Pickleheads `id` / `path` already captured per court.
- Minimal UI: court detail page shows "N players here now" + a "check in" button defaulting to **anonymous**, with an optional "show my name / skill level" toggle for those who want to attract a game.
- Anti-abuse: rate-limit anonymous check-ins per device/location and expire them aggressively so the count stays honest.
