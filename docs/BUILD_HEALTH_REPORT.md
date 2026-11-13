# Build health report — Phase 1 foundation

Date: 2026-11-11 · Branch: `ccr-8753e764-e4q7i6` · Environment: Linux sandbox, Node 22.23, pnpm 10.28,
PostgreSQL 16 (local cluster), Chromium 1243 (pre-installed Playwright browser).

## What was implemented

- **Project**: Next.js 16.4.6 App Router scaffold (TypeScript strict, Tailwind 4, shadcn/ui radix-nova,
  ESLint 9, Prettier), pnpm workspace config with approved build scripts, security headers, `proxy.ts`.
- **Database**: 45 application tables + 4 Better Auth tables across 7 migrations; UUIDv7 keys; CHECK
  constraints and partial unique indexes for cross-table invariants; Prisma 7 config with driver adapter.
- **Seed**: idempotent reference seed (9 task presets, 3 routine templates, pirate adventure with 6
  chapters / 3 quests / 4 objectives / 1 puzzle / 14 items / 5 achievements); separate dev-only demo
  household seed.
- **Auth**: Better Auth (email+password) for parents with rate limits; family-managed child sessions
  (family code + scrypt PIN, lockout, HMAC token, separate cookie); parent device hand-over.
- **Authorization**: `ParentContext` / `ChildContext`, OWNER/GUARDIAN permissions, family-scope and
  child-ownership assertions, layout gates for both areas.
- **Services** (`src/server/services`): family, child, task, routine, approval, progression pipeline,
  goal, reward ledger, adventure, inventory, audit — with transactions, row locks and idempotency keys.
- **Game engine**: Zod schemas for adventure/chapter/quest/objective/puzzle/asset config; pure engine
  (eligibility, counters, unlock/completion, levels); pirate theme as data; `sequence-match` puzzle
  verifier; asset manifest with placeholder artwork.
- **UI**: parent shell (sidebar + bottom nav) with dashboard, approvals, children, tasks, routines,
  goals, rewards, settings, onboarding; child shell (pirate theme tokens) with today, goals, adventure
  map and chapter scenes (quests, reward claim, puzzle); landing, sign-in/up, child sign-in; shared
  components (status badge, progress bar, resource counter, quest/goal cards, map marker, dialog
  panel, empty/loading states, action form).
- **Tests**: 48 unit, 31 integration, 11 e2e scenarios × 2 projects (desktop + mobile).
- **Docs**: README, ARCHITECTURE, ROADMAP, AGENTS, 6 ADRs, DATABASE, TIMEZONES, CHILD_AUTHENTICATION,
  GAME_ENGINE, PIRATE_ADVENTURE, SECURITY, PRIVACY, API_CONVENTIONS, ENVIRONMENT, TESTING.
- **CI**: GitHub Actions workflow (PostgreSQL service; lint, format, schema validate, migrate deploy,
  drift check, seed ×2, typecheck, unit, integration, build, dev seed, Playwright).

## Files and modules created (summary)

| Area     | Key files                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config   | `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc`, `components.json`, `prisma.config.ts`, `vitest*.config.ts`, `playwright.config.ts`, `.env.example`, `.github/workflows/ci.yml` |
| Database | `prisma/schema.prisma` (1,300+ lines), `prisma/migrations/0001…0007`, `prisma/seed.ts`, `prisma/seed-dev.ts`, `prisma/seed-data/task-presets.ts`                                                                                             |
| Lib      | `src/lib/{env,errors,logging}.ts`, `src/lib/db/prisma.ts`, `src/lib/auth/{auth,auth-client,session,pin,child-session,child-session-cookie}.ts`, `src/lib/validation/*`, `src/lib/utils/{dates,source-keys,index}.ts`                         |
| Server   | `src/server/policies/{context,family-access}.ts`, `src/server/services/*.service.ts` (11)                                                                                                                                                    |
| Features | `src/features/{families,tasks,routines,goals,approvals,rewards,adventures}/actions.ts` + pure logic + components                                                                                                                             |
| Game     | `src/game/schemas/*`, `src/game/engine/*`, `src/game/puzzles/*`, `src/game/chapters/loader.ts`, `src/game/themes/pirate/*`                                                                                                                   |
| App      | `src/app/{page,layout}.tsx`, `(auth)`, `(parent)/parent/*` (8 pages), `(onboarding)`, `(child)/child/*` (4 pages), `(child-public)`, `api/auth`, `api/health`, `src/proxy.ts`                                                                |
| UI       | `src/components/ui/*` (shadcn), `src/components/layout/*`, `src/components/shared/*`                                                                                                                                                         |
| Tests    | `tests/unit/*` (7 files), `tests/integration/*` (5 files), `tests/e2e/smoke.spec.ts`, `tests/helpers/*`                                                                                                                                      |

## Database tables and migrations

See `docs/database/DATABASE.md` for the full list. Migrations were created with `prisma migrate dev`
against the local `chore_quests_dev` database, re-applied from scratch with `prisma migrate deploy` on
`chore_quests_test` by the integration suite, and verified drift-free with
`prisma migrate diff --from-config-datasource --to-schema` (output: "No difference detected").

## Dependency versions (installed)

next 16.4.6 · react / react-dom 19.3.0 · typescript 5.9.3 · tailwindcss 4.3.3 · shadcn 4.23.0 ·
radix-ui 1.8.1 · prisma / @prisma/client / @prisma/adapter-pg 7.10.1 (pinned) · pg 8.23.1 ·
better-auth 1.7.19 · zod 4.6.7 · zustand 5.1.0 · vitest 5.1.0 · vite 8.3.7 · @playwright/test 1.65.0 ·
eslint 9.39.5 · eslint-config-next 16.4.6 · prettier 3.9.10 · tsx 4.23.15 · dotenv 18.0.10.

Deliberate pins and reasons: ADR 0002 (Prisma 7 vs 8 RC / Better Auth), README version notes
(TypeScript 5.9 vs 7, ESLint 9 vs 10).

## Commands executed (all succeeded unless noted)

```
pnpm dlx create-next-app@16.4.6 … --use-pnpm
pnpm add / pnpm add -D …            (see package.json)
pnpm dlx shadcn@latest init -d --base radix … button card badge dialog progress input label separator skeleton sonner sheet
pnpm dlx auth@latest generate --config src/lib/auth/auth.ts --output prisma/schema.prisma
pnpm prisma validate / format / generate
pnpm prisma migrate dev --name auth_families | tasks_routines | approvals_activity_completions | goals | rewards_achievements | adventures_inventory
pnpm prisma migrate dev --create-only --name integrity_constraints   (hand-written SQL) → migrate dev
pnpm prisma migrate status            → 7 migrations, up to date
pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code → no difference
pnpm db:seed (×2)                      → counts unchanged on second run (idempotent)
pnpm db:seed:dev                       → demo family created
pnpm lint · pnpm format · pnpm typecheck
pnpm test · pnpm test:integration
pnpm build                             → 20 routes compiled
pnpm test:e2e (PW_CHROMIUM_PATH=/opt/pw-browsers/chromium)
```

## Test results

| Suite                                                                                                        | Result                                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Unit (`pnpm test`)                                                                                           | 48 passed / 48 (7 files)                                     |
| Integration (`pnpm test:integration`)                                                                        | 31 passed / 31 (5 files) on PostgreSQL 16                    |
| End-to-end (`pnpm test:e2e`)                                                                                 | 22 passed / 22 (11 scenarios × chromium + Pixel 7 emulation) |
| Lint / format / typecheck / schema validate / production build                                               | pass                                                         |
| Fresh clone following the README (install, migrate deploy, seed ×2, dev seed, `pnpm check`)                  | pass                                                         |
| Development server: landing, health and sign-in pages return 200; `/parent` and `/child` redirect to sign-in | pass                                                         |

A first fresh-clone run exposed a setup bug: the git-ignored Prisma client was never generated, so
`pnpm db:seed` failed on a clean checkout. A `postinstall` that runs `prisma generate` fixed it, and a
second fresh clone passed every step above.

Edge cases verified by integration tests: approve same chore twice; four concurrent approvals; child
submits an already-approved occurrence; reject → resubmit → approve; one chore qualifying for multiple
goals; two same-day chores during a streak; weekly goal across a timezone boundary with recurrence
roll-over; chapter reward claimed multiple times (in parallel); cross-family access attempts; recurring
task edited after earlier occurrences were completed; transaction rollback; constraint violations.

## Security considerations

Implemented controls and deferred items are listed in `docs/development/SECURITY.md`; child-data
handling and the legal review still required are in `docs/development/PRIVACY.md`. Highlights: separate
parent/child session systems, server-side authorization on every action, DB-enforced idempotency,
audit log, no secrets in the repo (`.env` ignored, `.env.example` only), security headers. Not yet
done: CSP, edge rate limiting for child sign-in, email verification/reset, dependency scanning.

## Known limitations

- Occurrences/runs are materialized lazily on page load for a 7-day window (no scheduled job yet).
- Goal expiry and streak recomputation jobs do not exist; streaks are computed in processing order.
- Reward redemption, guardian invitations, task editing/archiving and routine step editing exist as
  services but have no UI yet.
- Email verification and password reset are disabled until an email provider is chosen.
- All artwork is flat-colour placeholder SVG; scenes are hotspot labels, not illustrated interactions.
- Chapters 3–6 are placeholders with unlock rules only.
- Zustand is installed but unused (reserved for Phase 4 scene state).
- Better Auth's built-in rate limiter is in-memory; multi-instance deployments need a shared store.
- Cache Components / PPR intentionally disabled (ADR 0003).

## Deferred work

See `ROADMAP.md` phases 2–6. Nearest items: scheduled jobs (materialization, pipeline retry, goal
expiry), guardian invitations + email provider, reward catalogue UI, activity history pages,
production artwork via the asset manifest, CSP and edge rate limiting.

## Recommended next milestone

**Phase 2 — Family Management**, starting with the scheduled job for occurrence/run materialization and
pipeline retries (removes the lazy generation from page loads), then guardian invitations with an email
provider (unblocks verification/reset), then task/assignment editing and activity history pages.

---

# Phase 2 — Family management

Date: 2026-11-12 · Branch: `ccr-f392bd97-a14y3m` · Same environment as Phase 1 (Node 22, pnpm 10.28, PostgreSQL 16).

## What changed

1. **Scheduled jobs**: `GET /api/cron/maintenance` (Vercel Cron, hourly, `vercel.json`) behind `CRON_SECRET` (constant-time Bearer check,
   503 when unset). `maintenance.service` materializes 7 household-local days of occurrences and runs per family, expires past-due goal
   assignments, retries `PENDING`/`FAILED` completions and prunes dev mail. Everything is idempotent and family-scoped; one failing family does
   not stop the rest. Pages now only create _today's_ rows. ADR 0007.
2. **Task library and assignments**: edit/archive/restore tasks, preset browser grouped by category, edit assignment schedule, points, due time,
   end date, approval; pause/resume/archive. Generated occurrences are never rewritten (tested). Audit entries added.
3. **Child profiles**: fixed 12-avatar set (no uploads), archive/restore UI, PIN reset with confirmation that also revokes the child's sessions
   and unlocks them, OWNER-only family code rotation. No new child data. **Bug fixed**: the generators ignored child status, so archived
   children kept receiving occurrences/runs (regression test fails on the old code).
4. **Routines**: reorder steps (two-phase update under the unique index), optional steps (at least one required), edit/archive/restore, assignment
   editing, completion windows (`windowStart`/`windowEnd`, household time, overnight and DST aware) enforced in `completeRoutineStep`.
5. **Activity history**: keyset-paginated parent page (child + date-range filter) and child "my history"; page size clamped at 50; tampered cursors
   fall back to the first page; child id always comes from the session.
6. **Guardian invitations and auth emails**: `EmailSender` interface with a development driver (stores in `email_outbox`, logs only the kind),
   Better Auth email verification (required by default) and password reset, invitations with hashed single-use tokens, 7-day expiry, email
   binding, row-locked accept, OWNER-only invite/list/revoke/remove, audit entries. ADR 0008, `docs/development/EMAIL.md`.
7. Housekeeping: CI action bumps (`checkout`, `setup-node`, `pnpm/action-setup` → v5, Node 24 runtimes), new env vars wired everywhere
   (`CRON_SECRET`, `EMAIL_DRIVER`, `REQUIRE_EMAIL_VERIFICATION`), `seed-dev` marks the demo parent as verified.

## Database

Two migrations: `family_invitations_email_outbox` (tables `family_invitation`, `email_outbox`) and the hand-written
`family_invitation_constraints` (guardian-only CHECK, single-outcome CHECK, accepted-has-user CHECK, partial unique index for one open invite per
family+email), each with a violating test in `schema-integrity.test.ts`. Drift check: "No difference detected".

## Test counts

| Suite       | Phase 1 | Phase 2 | Notes                                                                                                 |
| ----------- | ------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Unit        | 48      | 66      | window logic, cursor, schema refinements, cron route auth                                             |
| Integration | 31      | 71      | +maintenance, task/child/routine management, history, invitations, 4 new constraint tests             |
| E2E         | 22      | 45      | 41 run + 4 auth-flow scenarios skipped on the mobile project (rate-limited endpoints; run on desktop) |

`pnpm check`, `pnpm format:check` and `pnpm test:e2e` all pass, also from a fresh clone following the README.

## Known limitations

- **No real email provider.** Verification, reset and invitation mail is captured, not delivered (by design: nothing paid was signed up for).
  Deployments without a provider must set `REQUIRE_EMAIL_VERIFICATION=false`; owners can share the one-time invite link by hand.
- Adding/removing steps of an _existing_ routine is not supported (reorder/optional/rename are). Step-progress rows are per run, so it needs a
  reconciliation design.
- Editing an assignment affects only occurrences generated afterwards. A future occurrence already materialized for a day that the new schedule
  no longer includes stays on the calendar until completed or skipped (deliberate: no rewriting of generated rows).
- The cron job is hourly; a brand-new assignment's future days appear on the next run (today appears immediately via the page safety net).
- Invitation links use `NEXT_PUBLIC_APP_URL`, which Next inlines at build time; set it correctly for the build.
- `email_outbox` stores live links when the dev driver is used in production; the viewer is disabled there and rows expire after 7 days.
- The parent bottom navigation now has 9 items; how it fits on very small phones was not visually checked.
- Still deferred from the Phase 2 wish-list: parent "sign out everywhere", per-child due times beyond a per-assignment time.

---

# Phase 3 — Goals and rewards

Date: 2026-11-13 · Branch: `ccr-78ac4d38-2v7h9a` · Same environment (Node 22, pnpm 10.28, PostgreSQL 16).

## What changed

1. **Goal management** (`goal.service`, `/parent/goals`): edit a goal (title, description, target, reward), archive/restore, edit a child's
   assignment (dates for one-off goals, per-assignment target override). Reset rules and the interaction with the Phase 2 expiry job are
   written down in `docs/gameplay/GOALS.md` and tested (a weekly goal whose week EXPIRED still rolls forward; extending an expired
   assignment reactivates it). `repairGoalAssignment`/`repairGoalProgress` rebuild the cached counters from `goal_contribution` with the
   pure `recomputeProgress`; tests corrupt the counters and prove the repair restores them (count and streak goals), is idempotent and
   completes-and-pays at most once. Lowering a target below progress completes the assignment once.
2. **Approvals**: `bulkApprove` (≤ 50 items, each through the single-item path in its own transaction, audited per item, partial failures
   reported per item, safe to re-send); parent note on approve/reject now stored (`parent_review.note`, new `routine_run.reviewNote`) and
   shown to the child on Today; in-app notifications (`notification` table, ADR 0009) for new submissions (all OWNER/GUARDIAN), approved /
   sent back (child) and reward requested / answered, with unread badges, cursor pagination and mark-read. **Photos on submissions were
   deferred**: `docs/development/PRIVACY.md` now records why (children's images need a documented privacy review first).
3. **Rewards**: parent catalogue (create, edit, archive/restore, price, optional stock), child reward shop, parent resolve flow with note.
   Behaviour change (ADR 0010): points and stock are **reserved when the child asks** and refunded on denial; `resolveRedemption` now
   re-reads the redemption under the lock (the Phase 1 version checked status before locking). Repeating the same decision is a no-op.
4. **Achievements gallery** (`/child/achievements`): locked badges show a theme-supplied `hint` (new `achievement_definition.hint`,
   optional in the theme schema); the description and criteria never reach the client until earned.
5. **Audit log view** (`/parent/audit`): cursor-paginated, filter by action prefix and local date range, OWNER/GUARDIAN only, one-line
   summaries from a pure template table; raw metadata is never returned (tested with a canary field).
6. **Carry-over done**: parent "sign out everywhere" (`/parent/settings`). Making it testable exposed that Better Auth's 5-minute cookie
   cache kept a revoked session alive on other devices, so `getParentSession` now reads with `disableCookieCache` (one extra indexed
   lookup per parent request).
7. Mobile parent navigation: the bottom bar showed only the first five links, leaving Goals, Rewards, History, Inbox, Log and Settings
   unreachable on a phone. It now shows four links plus a "More" menu (exercised by the mobile e2e project).

## Database

Four migrations: `phase3_notifications_reward_stock_hints` (generated), `phase3_constraints` (hand-written: one notification recipient,
`stock >= 0`, refund-needs-debit), `routine_run_review_note`, `goal_assignment_target_override` (column + CHECK). Every constraint has a
violating test (`schema-integrity.test.ts` and the feature tests). New household table `notification` has `familyId`, cascade and an index
starting with `familyId`.

## Test counts

| Suite       | Phase 2 | Phase 3 | Notes                                                                                                                                        |
| ----------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | 66      | 75      | `recomputeProgress`, audit summaries                                                                                                         |
| Integration | 71      | 114     | goal management/repair, redemptions (raced), notifications, bulk approve, audit, achievements, 3 constraint tests                            |
| E2E         | 45      | 57      | 49 run + 8 skipped on the mobile project by design (mutating or rate-limited flows run once, on desktop); +sign-out-everywhere in auth-flows |

`pnpm check`, `pnpm format:check` and `pnpm test:e2e` pass. Race tests loop six rounds; removing the child/reward locks makes the
single-balance race test fail (checked by mutation).

## Known limitations

- **Left out: real email provider.** It needs a provider account and API key; nothing was signed up for. Mail is still captured by the dev
  driver (`docs/development/EMAIL.md`).
- **Left out: adding/removing steps of an existing routine.** Needs an ADR for reconciling existing runs' `routine_step_progress` rows first.
- **Photos on submissions** are deferred pending a privacy review (see above).
- Notifications are pull-only (visible on the next page load); there is no email/push and no retention job for old rows.
- A child cannot cancel their own reward request; a parent declining is the way back.
- Editing the target of a goal never rewrites history: `COMPLETED`/`EXPIRED` assignments keep their result.
- A goal's type, recurrence and filters cannot be edited after creation (archive and recreate), to avoid reinterpreting history.
- Audit rows written before Phase 3 for approve/reject carry only the fields they always had; unknown future actions render as their
  humanised key.
- "Sign out everywhere" does not write an audit entry (the revocation happens inside Better Auth's endpoint).
- The audit and notification pages show UTC timestamps; household-local formatting is not done.
