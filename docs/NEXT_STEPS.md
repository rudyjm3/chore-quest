# Next steps and not-yet-done items

Single list of what was deliberately left out of merged work, so it is not missed. Updated after Phase 5 slice 4 (Treasure Island). Phase 5 content is complete.
Status key: ⬜ not started · 🟡 partial · ⛔ blocked on a decision or an external account.

## Done in Phase 5 slice 4 (Treasure Island)

Treasure Island is playable (placeholder art, ADR 0022), so every chapter of the pirate campaign now exists. It needs the jungle completed, five map pieces and the legendary ship
(tier 5, now 1,000 coins). To make the ship reachable, the reef and the jungle pay 400 coins more (measured: 520 after the reef, 1,100 after the jungle with only the explorer and voyager bought).
The finale is a dig (6 chores, the dig site needs the map pieces held) and three chained guards (sequence, clue-order, 8 x 8 route), paying 1,000 coins, 2,000 XP, the sixth map fragment,
Blackbeard's Treasure and a wearable flag (new crew-camp slot). Finishing the last chapter shows an "Adventure complete!" card on the map and notifies the parents once (new
`ADVENTURE_COMPLETED` notification kind, one small migration).

## Done in Phase 5 slice 3 (Whispering Jungle)

Whispering Jungle is playable (placeholder art, ADR 0021). Artifacts are plain held items (`jade-idol`, `stone-mask`, `sun-key`) found by three chained chore objectives; the new
`requiresItems` location key makes the Ancient Ruins need all three at once; the new `clue-order` puzzle (clues with exactly one solution, rule-checked, nothing stored)
sets them in order; the temple is two chained puzzle stages (pair-match, route-plan) behind that quest. There is **no ship gate**: a child who buys only the explorer and the
voyager holds 330 coins after the reef, so the 800-coin captain ship is about 470 coins out of reach and stays a shop purchase. Treasure Island opens (after the claim gives the
fifth map fragment) as an empty placeholder.

## Done in Phase 5 slice 2 (Skull Reef)

Skull Reef is playable (placeholder art, ADR 0020): it needs the cove completed **and** one `ship-voyager` (400 coins; the cove now pays a little more so it is
affordable: 415 coins after claiming its reward with the minimum 7 chores). New `route-plan` puzzle (visible reefs, any safe route accepted, no stored route), chart pieces
from approved chores gate the chart table, and the Kraken is three chained puzzle stages (sequence, pair, route) behind the chart quest with **no cost**: no debit path was
built. A new server rule stops a stage of a not-yet-started quest from being solved early. The rope fix shipped separately in PR #12. Whispering Jungle opens after the reef
as the same empty placeholder.

## Done in Phase 5 slice 1 (Shipwreck Cove)

Shipwreck Cove is playable (placeholder art): it needs Parrot Island **and** the explorer ship (a purchase re-evaluates chapter unlocks), salvage planks and rope come
from approved chores, The Wreck opens while the child holds four planks (held, never consumed), and the repair puzzle is the new `pair-match` type (ADR 0019).
Children who had the placeholder chapter unlocked are grandfathered and get their quest rows through an idempotent ensure step. The first location
reward in the chapter (`location.reward`) was cut, as planned, to keep the slice small.

## Done in the Home Port polish slice

Quest detail dialog on the quest board and a dressed-up crew-camp ship scene (ADR 0018); the bundle/image pass was measured and only the dialog was
code-split (quest board first-load JS 182.8 → 164.5 KB; chapter pages and SVG art had nothing worth changing). Phase 4 is functionally complete with
placeholder art.

## Done in the Parrot Island slice

Feather grove and compass shrine location pages (`/child/adventure/[chapterKey]/[locationKey]`, ADR 0015), the richer sequence-match puzzle screen
(undo/clear, vague server feedback, `aria-live`, a client-safe puzzle view so the answer never leaves the server), Zustand scene state with a CSS/SVG
feedback dial and an opt-in sound toggle (ADR 0016, client-only, reduced-motion aware) and the lighthouse once-per-day limit (ADR 0017).
The Home Port slice before it: quest board, crew camp, lighthouse hints, Pip dialogue and hidden cove (ADRs 0013, 0014).

## Still open

| #   | Item                                              | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3   | **Puzzle attempt limits**                         | ⬜     | Deferred again in Phase 5 slice 1: they belong with Phase 6 edge rate limiting (failed attempts are one row each, unbounded, and the repair puzzle has 120 answers behind a salvage gate, still a game reward). Judged not worthwhile in the Home Port polish slice and deliberately deferred: failed attempts are stored one row each with no lockout or backoff (ADR 0015). The only puzzle is a four-symbol game puzzle guarding a cosmetic-grade reward, and a lockout would punish young children for guessing. Revisit with Phase 5 puzzles with larger answer spaces, or together with edge rate limiting (Phase 6) since unbounded attempt rows are also a growth concern; write an ADR first, enforce in `submitPuzzleAnswer` under the child lock. |
| 4   | **Real email provider** (Phase 2 carry-over)      | ⛔     | Needs a provider account and API key; deliberately out of scope. Steps in `docs/development/EMAIL.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5   | **`NOTIFICATION_RETENTION_DAYS` override**        | ⬜     | Windows are constants (read 90 d, unread 180 d). Adding the override needs the full env-var checklist (`.env.example`, `src/lib/env.ts`, ENVIRONMENT.md, README table, CI).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | **Photos on submissions**                         | ⛔     | Review document approved by the owner (2026-11-13) but the go/no-go checklist in `docs/development/PHOTO_REVIEW.md` is open (legal review, vendor/region, DPA, retention, consent copy). Nothing is built. Needs an ADR for the vendor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 7   | Real audio assets                                 | ⬜     | The sound toggle plays a synthesised chime only. Audio files must go through the asset manifest (an additive `audio` type) with placeholders first (ADR 0016).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 8   | ~~Rope needs hygiene, school or pet-care chores~~ | ✅     | Fixed in Phase 5 slice 2: `gather-rope` now accepts any category (no engine change). Planks still fill first because a completion feeds the first matching objective, so the old category filter never added variety; it only caused the dead end. Covered by an integration test with a chores-only household.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 9   | Salvage Yard one-time reward                      | ⬜     | The optional `location.reward` for the cove was left out. Adding it is data plus a visit button on the page (ADR 0014).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 10  | Pair-match tap UI is tap-to-assign only           | ⬜     | No drag and drop; fine on touch and keyboard, revisit with real art. The gated "needs N" scene link does not show a lock on the scene itself, only on the page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

## Known behaviours to revisit

- Removing a step from a run the child has not touched leaves it open; a step added after a run was submitted applies only from the next unfinished run (ADR 0011).
- A retried purchase with the same idempotency key but a different item returns the original purchase (cannot happen from the UI; keys are per render and per button).
- Notifications are pull-only (no email/push).
- A goal's type, recurrence and filters cannot be edited after creation.
- "Sign out everywhere" writes no audit entry.
- Per-child due times beyond the per-assignment time (Phase 2 carry-over).

## What comes next (roadmap order)

1. **Phase 4 remainder:** only the interactive side-mission dialog layer and real artwork/audio are left (everything keeps going through the asset manifests). Re-measure bundles when real artwork lands: placeholder SVGs are ~1 KB, so image optimization has not been needed yet.
2. **Phase 5 — Complete Pirate Campaign:** Shipwreck Cove ✅, Skull Reef ✅. Remaining: Treasure Island (final treasure and campaign completion), and any further puzzle types in `src/game/puzzles`.
3. **Phase 6 — MVP testing and launch preparation:** full parent/child e2e journeys and an approval-pipeline load test; security review (CSP, edge rate limiting, dependency audit); WCAG 2.2 AA audit; mobile performance budget and PWA; privacy/COPPA legal review with retention/deletion flows and parental-consent copy (the photo decision belongs here); pilot with a few families; Vercel + Supabase production setup. The real email provider must be in place before the pilot.

Suggested immediate order: **Phase 6 (MVP testing and launch preparation)**, starting with the items that gate a pilot: the real email provider, the Phase 6 security review (CSP, edge rate limiting
including puzzle attempt limits), the WCAG 2.2 AA audit of both shells and the privacy/COPPA review with the photo decision. Optional content follow-ups before or alongside: real artwork and audio through the
manifests, a shown-once campaign-complete screen (needs a stored "seen" flag), a ship-scene image for the higher ship tiers, and post-game content. If a real cost is ever wanted (spending items to win a challenge) it
needs its own ADR for an inventory debit path first.

Known limitations from slice 4: the campaign-complete card stays on the map while the campaign is complete (not shown once, no stored flag); only the starter ship has scene art; the route board still speaks of a ship
and a sea chart on Treasure Island; legendary-ship coins were tuned on the minimum chore path, so a household that buys cosmetics along the way will take extra chores; failed attempts remain unbounded rows (Phase 6).

Known limitations from slice 3: an artifact appears on the first chore of its search (the engine grants per unit of progress and clamps at the item cap); clue sentences are checked by hand
against their rules (only the rule is enforced); the clue and route UIs are tap/button based; the route board still speaks of a ship and a sea chart inside the jungle; failed attempts remain unbounded rows (Phase 6).

Known limitations from slice 2: the route board is arrow-button only (no drag or swipe); the Kraken has no fail state or cost by design; failed attempts are still unbounded rows
(Phase 6 rate limiting); the achievement "Master Shipwright" only reaches children who solve the repair puzzle after this change; art is placeholder.
