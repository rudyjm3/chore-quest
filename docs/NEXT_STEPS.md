# Next steps and not-yet-done items

Single list of what was deliberately left out of merged work, so it is not missed. Updated after the Parrot Island slice (feather grove, compass shrine, richer puzzle UI, client-only scene state, lighthouse once per day).
Status key: ⬜ not started · 🟡 partial · ⛔ blocked on a decision or an external account.

## Done in the Parrot Island slice

Feather grove and compass shrine location pages (`/child/adventure/[chapterKey]/[locationKey]`, ADR 0015), the richer sequence-match puzzle screen
(undo/clear, vague server feedback, `aria-live`, a client-safe puzzle view so the answer never leaves the server), Zustand scene state with a CSS/SVG
feedback dial and an opt-in sound toggle (ADR 0016, client-only, reduced-motion aware) and the lighthouse once-per-day limit (ADR 0017).
The Home Port slice before it: quest board, crew camp, lighthouse hints, Pip dialogue and hidden cove (ADRs 0013, 0014).

## Still open

| #   | Item                                                                    | Status | Notes                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home Port polish: **quest detail on tap**, a **visual crew-camp scene** | ⬜     | Quest descriptions are always visible; the camp is a list, not a dressed-up ship. (The lighthouse once-per-day limit is done.) E2E still does not exercise the cove "available" path (covered by integration).                          |
| 2   | **Lazy-loaded chapter bundles / image optimization**                    | ⬜     | Not started and not measured; needs before/after numbers (bundle size, LCP on the chapter page) when it is done.                                                                                                                        |
| 3   | **Puzzle attempt limits**                                               | ⬜     | Failed attempts are stored one row each with no lockout or backoff (ADR 0015). Fine for a four-symbol game puzzle; needed before a puzzle guards anything of value.                                                                     |
| 4   | **Real email provider** (Phase 2 carry-over)                            | ⛔     | Needs a provider account and API key; deliberately out of scope. Steps in `docs/development/EMAIL.md`.                                                                                                                                  |
| 5   | **`NOTIFICATION_RETENTION_DAYS` override**                              | ⬜     | Windows are constants (read 90 d, unread 180 d). Adding the override needs the full env-var checklist (`.env.example`, `src/lib/env.ts`, ENVIRONMENT.md, README table, CI).                                                             |
| 6   | **Photos on submissions**                                               | ⛔     | Review document approved by the owner (2026-11-13) but the go/no-go checklist in `docs/development/PHOTO_REVIEW.md` is open (legal review, vendor/region, DPA, retention, consent copy). Nothing is built. Needs an ADR for the vendor. |
| 7   | Real audio assets                                                       | ⬜     | The sound toggle plays a synthesised chime only. Audio files must go through the asset manifest (an additive `audio` type) with placeholders first (ADR 0016).                                                                          |

## Known behaviours to revisit

- Removing a step from a run the child has not touched leaves it open; a step added after a run was submitted applies only from the next unfinished run (ADR 0011).
- A retried purchase with the same idempotency key but a different item returns the original purchase (cannot happen from the UI; keys are per render and per button).
- Notifications are pull-only (no email/push).
- A goal's type, recurrence and filters cannot be edited after creation.
- "Sign out everywhere" writes no audit entry.
- Per-child due times beyond the per-assignment time (Phase 2 carry-over).

## What comes next (roadmap order)

1. **Finish Phase 4 (Pirate Adventure, functional with placeholder art)** — quest detail on tap, a visual crew-camp scene, interactive side-mission dialog layer, lazy-loaded chapter bundles and an image-optimization pass. Production artwork is still not available; everything keeps going through the asset manifests.
2. **Phase 5 — Complete Pirate Campaign:** Shipwreck Cove, Skull Reef, Whispering Jungle, Treasure Island, and more puzzle types in `src/game/puzzles`.
3. **Phase 6 — MVP testing and launch preparation:** full parent/child e2e journeys and an approval-pipeline load test; security review (CSP, edge rate limiting, dependency audit); WCAG 2.2 AA audit; mobile performance budget and PWA; privacy/COPPA legal review with retention/deletion flows and parental-consent copy (the photo decision belongs here); pilot with a few families; Vercel + Supabase production setup. The real email provider must be in place before the pilot.

Suggested immediate order: Home Port polish (quest detail, camp scene), then the bundle/image pass with measurements, then Phase 5 chapters.
