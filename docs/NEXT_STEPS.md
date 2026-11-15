# Next steps and not-yet-done items

Single list of what was deliberately left out of merged work, so it is not missed. Updated after the Home Port polish slice (quest detail dialog, crew-camp ship scene, bundle measurements).
Status key: ⬜ not started · 🟡 partial · ⛔ blocked on a decision or an external account.

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

| #   | Item                                         | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | **Puzzle attempt limits**                    | ⬜     | Judged not worthwhile in the Home Port polish slice and deliberately deferred: failed attempts are stored one row each with no lockout or backoff (ADR 0015). The only puzzle is a four-symbol game puzzle guarding a cosmetic-grade reward, and a lockout would punish young children for guessing. Revisit with Phase 5 puzzles with larger answer spaces, or together with edge rate limiting (Phase 6) since unbounded attempt rows are also a growth concern; write an ADR first, enforce in `submitPuzzleAnswer` under the child lock. |
| 4   | **Real email provider** (Phase 2 carry-over) | ⛔     | Needs a provider account and API key; deliberately out of scope. Steps in `docs/development/EMAIL.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5   | **`NOTIFICATION_RETENTION_DAYS` override**   | ⬜     | Windows are constants (read 90 d, unread 180 d). Adding the override needs the full env-var checklist (`.env.example`, `src/lib/env.ts`, ENVIRONMENT.md, README table, CI).                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | **Photos on submissions**                    | ⛔     | Review document approved by the owner (2026-11-13) but the go/no-go checklist in `docs/development/PHOTO_REVIEW.md` is open (legal review, vendor/region, DPA, retention, consent copy). Nothing is built. Needs an ADR for the vendor.                                                                                                                                                                                                                                                                                                      |
| 7   | Real audio assets                            | ⬜     | The sound toggle plays a synthesised chime only. Audio files must go through the asset manifest (an additive `audio` type) with placeholders first (ADR 0016).                                                                                                                                                                                                                                                                                                                                                                               |

## Known behaviours to revisit

- Removing a step from a run the child has not touched leaves it open; a step added after a run was submitted applies only from the next unfinished run (ADR 0011).
- A retried purchase with the same idempotency key but a different item returns the original purchase (cannot happen from the UI; keys are per render and per button).
- Notifications are pull-only (no email/push).
- A goal's type, recurrence and filters cannot be edited after creation.
- "Sign out everywhere" writes no audit entry.
- Per-child due times beyond the per-assignment time (Phase 2 carry-over).

## What comes next (roadmap order)

1. **Phase 4 remainder:** only the interactive side-mission dialog layer and real artwork/audio are left (everything keeps going through the asset manifests). Re-measure bundles when real artwork lands: placeholder SVGs are ~1 KB, so image optimization has not been needed yet.
2. **Phase 5 — Complete Pirate Campaign:** Shipwreck Cove, Skull Reef, Whispering Jungle, Treasure Island, and more puzzle types in `src/game/puzzles`.
3. **Phase 6 — MVP testing and launch preparation:** full parent/child e2e journeys and an approval-pipeline load test; security review (CSP, edge rate limiting, dependency audit); WCAG 2.2 AA audit; mobile performance budget and PWA; privacy/COPPA legal review with retention/deletion flows and parental-consent copy (the photo decision belongs here); pilot with a few families; Vercel + Supabase production setup. The real email provider must be in place before the pilot.

Suggested immediate order: a scoping discussion for Phase 5 (Shipwreck Cove first; new puzzle types, which is also when attempt limits become worthwhile).
