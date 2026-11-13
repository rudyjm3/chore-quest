# Next steps and not-yet-done items

Single list of what was deliberately left out of merged work, so it is not missed. Updated after PR #5 (Phase 3 follow-ups and Phase 4 start).
Status key: ⬜ not started · 🟡 partial · ⛔ blocked on a decision or an external account.

## Left out of PR #5 (do these first)

| #   | Item                                                                                                          | Status | Notes                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home Port **quest board** (read-only list of active quests/objectives from engine state)                      | ⬜     | Design in `docs/gameplay/PIRATE_ADVENTURE.md` ("Home Port scene: design note"). No new tables.                                                                                                                                          |
| 2   | Home Port **crew camp** (equip/unequip cosmetics in `child_adventure_progress.state`)                         | ⬜     | Needs a Zod schema for the state and an `equipCosmetic` service action; never authoritative for rewards.                                                                                                                                |
| 3   | **Lighthouse**, **hidden cove**, **Pip dialogue**                                                             | ⬜     | Hidden cove adds a reward source, so it needs an ADR first.                                                                                                                                                                             |
| 4   | **Fresh-clone check**: clone into a scratch directory with its own databases and follow the README end to end | ⬜     | Required by the brief's "Finish" step; not done in the session.                                                                                                                                                                         |
| 5   | **E2E re-run on the final merged code**                                                                       | ⬜     | The last full e2e run (51 passed, 10 skipped by design) predates the review fixes (reopened-run reconcile, materialization lock, `ItemArt` styling). CI runs lint/types/schema/unit/integration/build, not e2e.                         |
| 6   | **Real email provider** (Phase 2 carry-over)                                                                  | ⛔     | Needs a provider account and API key; deliberately out of scope. Steps in `docs/development/EMAIL.md`.                                                                                                                                  |
| 7   | **`NOTIFICATION_RETENTION_DAYS` override**                                                                    | ⬜     | Windows are constants (read 90 d, unread 180 d). Adding the override needs the full env-var checklist (`.env.example`, `src/lib/env.ts`, ENVIRONMENT.md, README table, CI).                                                             |
| 8   | **Photos on submissions**                                                                                     | ⛔     | Review document approved by the owner (2026-11-13) but the go/no-go checklist in `docs/development/PHOTO_REVIEW.md` is open (legal review, vendor/region, DPA, retention, consent copy). Nothing is built. Needs an ADR for the vendor. |

## Known behaviours to revisit

- Removing a step from a run the child has not touched leaves it open; a step added after a run was submitted applies only from the next unfinished run (ADR 0011).
- A retried purchase with the same idempotency key but a different item returns the original purchase (cannot happen from the UI; keys are per render and per button).
- Notifications are pull-only (no email/push).
- A goal's type, recurrence and filters cannot be edited after creation.
- "Sign out everywhere" writes no audit entry.
- Per-child due times beyond the per-assignment time (Phase 2 carry-over).

## What comes next (roadmap order)

1. **Finish Phase 4 (Pirate Adventure, functional with placeholder art)** — items 1–3 above, then: Parrot Island Pip dialogue and feather grove, richer compass-puzzle UI, interactive quests/side missions dialog layer, Zustand scene state with CSS/SVG animations and a sound toggle, lazy-loaded chapter bundles and an image-optimization pass. Production artwork is still not available; everything keeps going through the asset manifests.
2. **Phase 5 — Complete Pirate Campaign:** Shipwreck Cove, Skull Reef, Whispering Jungle, Treasure Island, and more puzzle types in `src/game/puzzles`.
3. **Phase 6 — MVP testing and launch preparation:** full parent/child e2e journeys and an approval-pipeline load test; security review (CSP, edge rate limiting, dependency audit); WCAG 2.2 AA audit; mobile performance budget and PWA; privacy/COPPA legal review with retention/deletion flows and parental-consent copy (the photo decision belongs here); pilot with a few families; Vercel + Supabase production setup. The real email provider must be in place before the pilot.

Suggested immediate order: items 5 and 4 (cheap verification), then 1 (quest board, read-only), then 2, then the Parrot Island work.
