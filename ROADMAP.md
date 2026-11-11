# Roadmap

Status key: ✅ done · 🟡 partial · ⬜ not started. Dependencies are listed per phase.

## Phase 1 — Foundation (this milestone) ✅

| Item                                                                                                      | Status | Notes                                               |
| --------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------- |
| Project scaffolding (Next 16, TS strict, Tailwind 4, shadcn)                                              | ✅     | pnpm, Prettier, ESLint 9                            |
| Database schema + 7 migrations                                                                            | ✅     | Validated on PostgreSQL 16; drift check in CI       |
| Idempotent seed (presets, routines, pirate adventure)                                                     | ✅     | Dev-only demo seed separate                         |
| Authentication integration (Better Auth)                                                                  | ✅     | Email + password; email verification/reset deferred |
| Child sessions (family code + PIN)                                                                        | ✅     | Lockout after 5 failures                            |
| Authorization policies + family isolation                                                                 | ✅     | Unit + integration tested                           |
| Domain services (family, child, task, routine, approval, progression, goal, reward, adventure, inventory) | ✅     | Representative operations implemented               |
| Approval pipeline with idempotent rewards/goals/quests                                                    | ✅     | Concurrency-tested                                  |
| UI shells (parent + child), design tokens, shared components                                              | ✅     | Functional, not final art                           |
| Testing foundation (unit, integration, e2e smoke)                                                         | ✅     |                                                     |
| CI workflow                                                                                               | ✅     | `.github/workflows/ci.yml`                          |
| Documentation                                                                                             | ✅     | README, ARCHITECTURE, AGENTS, docs/*                |

## Phase 2 — Family Management 🟡

Depends on: Phase 1.

- ⬜ Guardian invitations by email (needs an email provider) and membership management UI
- ⬜ Email verification + password reset flows (Better Auth, same provider)
- 🟡 Child profiles: avatars, archive/restore UI (service exists), PIN reset UX
- 🟡 Task library UI: edit/archive tasks, preset browser with categories (create/assign done)
- 🟡 Assignments: edit schedule, pause/resume (done), end dates UI, per-child due times
- ⬜ Scheduled occurrence/run materialization job (Vercel Cron) replacing lazy generation
- 🟡 Routines: reorder steps, optional steps UI, completion windows enforcement
- ⬜ Activity history pages with pagination for parents and children

## Phase 3 — Goals and Rewards 🟡

Depends on: Phase 2 (history pages), scheduled job.

- 🟡 Goal management UI (create/assign done; edit, archive, reset rules pending)
- ⬜ Goal expiry job (mark `EXPIRED` after `endDate`) and streak recomputation from contributions
- 🟡 Approvals: bulk approve, notes/photos on submissions, notifications
- 🟡 Reward catalogue + redemption UI (services exist: `createRewardDefinition`, `requestRedemption`, `resolveRedemption`)
- ⬜ Achievements gallery for children
- ⬜ Parent-facing audit log view

## Phase 4 — Pirate Adventure 🟡

Depends on: Phase 3 pipeline stability, production artwork.

- 🟡 World map (functional with placeholder art) → production illustrations via manifest
- 🟡 Home Port scene: quest board, supply shop (purchase service exists, UI pending), crew camp, lighthouse, hidden cove interactions
- 🟡 Parrot Island: Pip dialogue, feather grove, compass puzzle (sequence-match done; richer puzzle UI pending)
- 🟡 Interactive quests + side missions (engine done; dialog/animation layer pending)
- 🟡 Collectibles & inventory screen; ship upgrades/cosmetics shop
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
