# Next steps and not-yet-done items

Single list of what was deliberately left out of merged work, so it is not missed. Updated after the Home Port slice (quest board, crew camp, lighthouse, Pip dialogue, hidden cove).
Status key: ⬜ not started · 🟡 partial · ⛔ blocked on a decision or an external account.

## Done in the Home Port slice

Quest board (read-only), crew camp (equip/unequip), lighthouse hints, Pip dialogue and the hidden cove are built (`/child/port/*`, ADRs 0013 and 0014). The full e2e suite was re-run on `main` before the work (51 passed, 10 skipped by design) and a fresh clone was verified end to end against the README.

## Still open

| #   | Item                                                                                        | Status | Notes                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home Port polish: lighthouse "once per day" limit, quest detail on tap, a visual camp scene | ⬜     | The lighthouse is repeatable (the design note said no state); a daily limit would need a small state key. Camp shows a list, not a dressed-up ship. E2E does not exercise the cove "available" path (covered by integration).           |
| 2   | **Real email provider** (Phase 2 carry-over)                                                | ⛔     | Needs a provider account and API key; deliberately out of scope. Steps in `docs/development/EMAIL.md`.                                                                                                                                  |
| 3   | **`NOTIFICATION_RETENTION_DAYS` override**                                                  | ⬜     | Windows are constants (read 90 d, unread 180 d). Adding the override needs the full env-var checklist (`.env.example`, `src/lib/env.ts`, ENVIRONMENT.md, README table, CI).                                                             |
| 4   | **Photos on submissions**                                                                   | ⛔     | Review document approved by the owner (2026-11-13) but the go/no-go checklist in `docs/development/PHOTO_REVIEW.md` is open (legal review, vendor/region, DPA, retention, consent copy). Nothing is built. Needs an ADR for the vendor. |

## Known behaviours to revisit

- Removing a step from a run the child has not touched leaves it open; a step added after a run was submitted applies only from the next unfinished run (ADR 0011).
- A retried purchase with the same idempotency key but a different item returns the original purchase (cannot happen from the UI; keys are per render and per button).
- Notifications are pull-only (no email/push).
- A goal's type, recurrence and filters cannot be edited after creation.
- "Sign out everywhere" writes no audit entry.
- Per-child due times beyond the per-assignment time (Phase 2 carry-over).

## What comes next (roadmap order)

1. **Finish Phase 4 (Pirate Adventure, functional with placeholder art)** — Parrot Island feather grove, richer compass-puzzle UI, interactive quests/side missions dialog layer, Zustand scene state with CSS/SVG animations and a sound toggle, lazy-loaded chapter bundles and an image-optimization pass. Production artwork is still not available; everything keeps going through the asset manifests.
2. **Phase 5 — Complete Pirate Campaign:** Shipwreck Cove, Skull Reef, Whispering Jungle, Treasure Island, and more puzzle types in `src/game/puzzles`.
3. **Phase 6 — MVP testing and launch preparation:** full parent/child e2e journeys and an approval-pipeline load test; security review (CSP, edge rate limiting, dependency audit); WCAG 2.2 AA audit; mobile performance budget and PWA; privacy/COPPA legal review with retention/deletion flows and parental-consent copy (the photo decision belongs here); pilot with a few families; Vercel + Supabase production setup. The real email provider must be in place before the pilot.

Suggested immediate order: the Parrot Island work (feather grove, richer puzzle UI), then the Zustand scene state and animations, then the Home Port polish above.
