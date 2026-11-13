# Roadmap

Status key: ✅ done · 🟡 partial · ⬜ not started. Dependencies are listed per phase.

## Phase 1 — Foundation (this milestone) ✅

| Item                                                                                                      | Status | Notes                                                 |
| --------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| Project scaffolding (Next 16, TS strict, Tailwind 4, shadcn)                                              | ✅     | pnpm, Prettier, ESLint 9                              |
| Database schema + 7 migrations                                                                            | ✅     | Validated on PostgreSQL 16; drift check in CI         |
| Idempotent seed (presets, routines, pirate adventure)                                                     | ✅     | Dev-only demo seed separate                           |
| Authentication integration (Better Auth)                                                                  | ✅     | Email + password; verification/reset added in Phase 2 |
| Child sessions (family code + PIN)                                                                        | ✅     | Lockout after 5 failures                              |
| Authorization policies + family isolation                                                                 | ✅     | Unit + integration tested                             |
| Domain services (family, child, task, routine, approval, progression, goal, reward, adventure, inventory) | ✅     | Representative operations implemented                 |
| Approval pipeline with idempotent rewards/goals/quests                                                    | ✅     | Concurrency-tested                                    |
| UI shells (parent + child), design tokens, shared components                                              | ✅     | Functional, not final art                             |
| Testing foundation (unit, integration, e2e smoke)                                                         | ✅     |                                                       |
| CI workflow                                                                                               | ✅     | `.github/workflows/ci.yml`                            |
| Documentation                                                                                             | ✅     | README, ARCHITECTURE, AGENTS, docs/*                  |

## Phase 2 — Family Management ✅

Depends on: Phase 1. Delivered in the Phase 2 branch; see `docs/BUILD_HEALTH_REPORT.md` for counts.

- ✅ Guardian invitations by email (hashed single-use tokens, 7-day expiry, audit; link shown to the owner as a fallback) and membership management UI
- ✅ Email verification + password reset (Better Auth) behind the `EmailSender` interface; development driver only (ADR 0008)
- ⬜ **Plug in a real email provider** (deliberately not chosen: no paid service was signed up for). Steps in `docs/development/EMAIL.md`
- ✅ Child profiles: fixed avatar set, archive/restore UI, PIN reset UX (confirm + sign-out everywhere), family code rotation
- ✅ Task library UI: edit/archive/restore tasks, preset browser grouped by category
- ✅ Assignments: edit schedule, points, due time, end date; pause/resume/archive (edits never rewrite generated occurrences)
- ✅ Scheduled occurrence/run materialization (Vercel Cron, ADR 0007) replacing lazy generation
- ✅ Routines: reorder steps, optional steps, edit/archive/restore, completion windows enforced server-side
- ✅ Activity history pages with cursor pagination for parents (per child, date range) and children
- 🟡 Not done in Phase 2: adding/removing steps of an existing routine (the run/step-progress rows are created per run, so this needs a
  reconciliation design); per-child due times beyond the per-assignment time; "sign out everywhere" for parents

## Phase 3 — Goals and Rewards 🟡

Depends on: Phase 2 (history pages and scheduled job are done). Delivered on the Phase 3 branch; see `docs/BUILD_HEALTH_REPORT.md`.

- ✅ Goal management: edit goal and per-child assignment (dates, target override), archive/restore, explicit reset rules and expiry-job interaction (`docs/gameplay/GOALS.md`), idempotent progress repair from `goal_contribution`
- ✅ Approvals: bulk approve (one transaction per item, per-item results), parent note visible to the child, in-app notifications for parents and children with cursor pagination (ADR 0009)
- ⬜ Photos on submissions: **deliberately deferred** until `docs/development/PRIVACY.md` records a privacy review for storing children's images (draft: [`PHOTO_REVIEW.md`](docs/development/PHOTO_REVIEW.md), review approved by the owner, go/no-go checklist still open; nothing built)
- ✅ Reward catalogue (create, edit, archive, price, optional stock), child reward shop, parent resolve flow; points and stock reserved at request, refunded on denial (ADR 0010)
- ✅ Achievements gallery for children (locked = hint only)
- ✅ Parent audit log view (OWNER/GUARDIAN, cursor, action-prefix and date-range filters, readable summaries)
- ✅ Parent "sign out everywhere" (Phase 2 carry-over); server session reads now bypass the cookie cache so revocation is immediate
- ⬜ Real email provider (Phase 2 carry-over): needs an account and API key from a provider; nothing was signed up for. Steps in `docs/development/EMAIL.md`
- ✅ Adding/removing steps of an existing routine (Phase 2 carry-over): steps are retired, never deleted; unfinished runs from today on are reconciled (ADR 0011)
- ✅ Child can cancel their own open reward request (refund, stock restored); audit and notification times shown in household-local time; notification retention job (read 90 d / unread 180 d)
- ⬜ Not in scope, noted for later: notification email/push

## Phase 4 — Pirate Adventure 🟡

Depends on: Phase 3 pipeline stability, production artwork.

- 🟡 World map (functional with placeholder art) → production illustrations via manifest
- 🟡 Home Port scene: supply shop ✅ (child UI, server-enforced rules, ADR 0012); quest board, crew camp, lighthouse, hidden cove ⬜ (design note in `docs/gameplay/PIRATE_ADVENTURE.md`)
- 🟡 Parrot Island: Pip dialogue, feather grove, compass puzzle (sequence-match done; richer puzzle UI pending)
- 🟡 Interactive quests + side missions (engine done; dialog/animation layer pending)
- 🟡 Collectibles & inventory screen ✅ (read-only treasure chest); ship upgrades/cosmetics shop ✅ (supply shop); equipping cosmetics ⬜
- ⬜ Zustand-backed scene state, CSS/SVG animations, sound toggle
- ⬜ Lazy-loaded chapter bundles and image optimization pass

## Phase 5 — Complete Pirate Campaign ⬜

Depends on: Phase 4.

- ⬜ Shipwreck Cove (salvage + repair mini-game)
- ⬜ Skull Reef (navigation + Kraken challenge)
- ⬜ Whispering Jungle (clues + artifacts)
- ⬜ Treasure Island (final treasure, campaign completion rewards)
- ⬜ Additional puzzle types in `src/game/puzzles`

## Phase 6 — MVP Testing and Launch Preparation ⬜

Depends on: Phases 2–5.

- ⬜ Full parent/child e2e journeys; load test of the approval pipeline
- ⬜ Security review (CSP, rate limiting on child sign-in at the edge, dependency audit)
- ⬜ Accessibility audit (WCAG 2.2 AA) for both shells
- ⬜ Mobile performance budget; PWA manifest + offline shell
- ⬜ Privacy/COPPA legal review, data retention + deletion flows, parental consent copy
- ⬜ Pilot with a small group of families; bug fixes; Vercel + Supabase production setup
