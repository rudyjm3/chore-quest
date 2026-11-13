# Chore Quests — Phase 3: Goals and Rewards

You are continuing work on **Chore Quests** (repo `rudyjm3/chore-quest`), a gamified chore, routine and goal app for families with a theme-independent adventure engine. Phases 1 (foundation) and 2 (family management) are merged into `main`. Your job is Phase 3: make goals, approvals and rewards usable end to end.

## Start here

1. Read `AGENTS.md` first and follow it; it is the source of truth for architecture boundaries, conventions, security rules and the definition of done. Then read `ARCHITECTURE.md`, `ROADMAP.md` (Phase 3 section), `docs/database/DATABASE.md`, `docs/database/TIMEZONES.md`, `docs/development/API_CONVENTIONS.md`, `docs/development/PRIVACY.md`, and the Phase 2 section of `docs/BUILD_HEALTH_REPORT.md` (known limitations). Read ADRs 0005 (verified completion and idempotent pipeline), 0007 (cron) and 0008 (email).
2. Work on a branch created from the latest `main`. `main` is protected: changes land only through a PR with the CI check `Lint, types, schema, tests, build` passing. Never push to `main`.
3. Set up and confirm a green baseline before changing anything:
   ```bash
   sudo service postgresql start   # or: service postgresql start
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
   sudo -u postgres psql -c "CREATE DATABASE chore_quests_dev;" -c "CREATE DATABASE chore_quests_test;"
   pnpm install --frozen-lockfile        # also runs prisma generate
   cp .env.example .env                  # defaults match the local databases
   pnpm db:migrate:deploy && pnpm db:seed && pnpm db:seed:dev
   pnpm check                            # lint, typecheck, schema, unit, integration, build
   ```

## Scope (in this order)

1. **Goal management.** Edit and archive goals; edit a goal assignment (dates, target) and define the reset rules for recurring goals. Make the interaction with the Phase 2 expiry job explicit: the cron marks past-due assignments `EXPIRED`, and `applyCompletionToGoals` rolls recurring weekly goals forward from `ACTIVE`/`COMPLETED`/`EXPIRED` periods. Keep that working and tested. Recompute streaks and progress counters from `goal_contribution` rows (the source of truth) with an idempotent repair function, plus a test that corrupts the cached counters and proves the repair restores them.
2. **Approvals.** Bulk approve for parents (one transaction per item, idempotent, each item audited, partial failures reported per item), a parent note on approve/reject that the child can see, and an in-app notification list (no email, no push) for: new submissions to review (parents), approved/rejected (child), reward redemption requested/resolved. Notifications need a table with `familyId`, a recipient, a read state, and cursor pagination.
   **Photos on submissions are out of scope** until `docs/development/PRIVACY.md` has a documented privacy review for storing children's images. State that you deferred them and why.
3. **Reward catalogue and redemptions.** Services already exist (`createRewardDefinition`, `requestRedemption`, `resolveRedemption`). Build the parent catalogue UI (create, edit, archive, price, optional stock), the child "reward shop" (request a redemption), and the parent resolve flow. Balances change only through `postLedgerEntry` with a unique `sourceKey`; reserve or debit at request time, refund on rejection, all idempotent and race-tested (two requests against one balance, double-resolve).
4. **Achievements gallery** for children, built from `earned_achievement` and `achievement_definition`. Locked achievements show a hint, not the secret condition. Nothing pirate-specific in services, schema or shared components.
5. **Parent audit log view.** Paginated (cursor), filterable by action prefix and date range, OWNER and GUARDIAN visible. Never show raw metadata JSON; render a readable summary per action.

Carry-overs from Phase 2, do these last if time allows, otherwise list them as left out:

- Plug in a real email provider behind `EmailSender` (follow `docs/development/EMAIL.md`). **Do not sign up for or require a paid service** without asking me first; if you cannot do this free, say so and stop.
- Adding/removing steps of an existing routine (needs a design for existing runs' `routine_step_progress` rows; write the ADR first).
- Parent "sign out everywhere".

If something in this list turns out to be large or blocked, finish the rest and state exactly what was left out and why.

## Rules that matter most here

- All writes through `src/server/services`; every action resolves the actor with `requireParentContext()`/`requireChildContext()` and every query is scoped by `familyId` (and `childId` for child actors).
- New tables/columns go through `pnpm db:migrate --name <change>` with committed SQL; hand-written constraints get their own migration plus a violating test. Run `pnpm db:generate` after schema changes before running tests.
- Every new env var: `.env.example`, `src/lib/env.ts`, `docs/development/ENVIRONMENT.md`, README table, CI workflow.
- Every behaviour change gets tests: pure logic in `tests/unit`, anything touching Prisma in `tests/integration`, and extend the Playwright suite for new pages. Prove a regression test fails on the old code when fixing a bug. Concurrency claims need a test that actually races (loop several rounds; a single round can pass by luck).
- Update `ROADMAP.md`, `ARCHITECTURE.md`, `docs/database/DATABASE.md`, `docs/development/TESTING.md` and add an ADR for consequential choices (notifications design, reward reservation model).
- Children under 13 use the child UI: collect no new child data, keep child pages free of external links, and never show another child's data.

## Lessons from Phases 1 and 2 (save yourself the time)

- `prisma migrate dev` prompts interactively and hangs when piped; always pass `--name`, and use `--create-only` for hand-written SQL.
- The Prisma client is git-ignored and generated by `postinstall`; run `pnpm db:generate` after any schema change or if imports from `@/generated/prisma` fail.
- Inside a PostgreSQL interactive transaction a failed statement aborts the transaction: check-then-insert under a row lock or use `createMany({ skipDuplicates })`, never catch `P2002`. Never `Promise.all` on a transaction client.
- Lock the aggregate row (`lockChildRow`, `SELECT … FOR UPDATE` on occurrences/runs/routines/invitations) before reading state you will change. Read-check-update outside a lock is a race (a Phase 2 review caught this twice).
- Better Auth limits parent sign-in to 10 per minute and sign-up to 5 (deliberate). The e2e suite signs in once in `tests/e2e/auth.setup.ts` and reuses the session; keep it that way. Auth-flow specs run on the desktop project only.
- In Playwright, `browser.newContext()` inherits the test's `use` options; pass an empty `storageState` for a clean child device. Avoid `getByRole("alert")` alone: Next's route announcer also has role alert, so scope it (`p[role=alert]`).
- `NEXT_PUBLIC_*` values are inlined at build time; e2e must not assume the runtime override changes them (use link paths, not origins).
- `pnpm db:seed:dev` resets the demo children's PIN lockouts and marks the demo parent email-verified; re-run it before e2e if PIN or sign-in tests fail.
- In this sandbox, run Playwright with `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e --trace off` after `pnpm build`.
- Local PostgreSQL may stop between turns; `pg_isready`, then `service postgresql start`.
- Mail is captured, not delivered, with the dev driver: read links from `/dev/outbox` in development or `tests/e2e/outbox.ts` in e2e.
- Code review bots (Codex) review every PR. Verify each finding against the code before acting, reproduce races with a failing test first, fix what is real, reply on each thread with what you traced, and resolve the thread.

## Finish

1. Run `pnpm check`, `pnpm format:check` and the e2e suite; all must pass. Also do a fresh clone into a scratch directory and follow the README end to end.
2. Update `docs/BUILD_HEALTH_REPORT.md` with a Phase 3 section: what changed, test counts, known limitations.
3. Commit in logical steps, push the branch, open a PR against `main`, and subscribe to its activity. Fix CI failures and verify every review finding before acting on it; reply on each thread. Do not merge — I will.
