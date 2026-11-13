# Chore Quests — Phase 3 follow-ups and the start of Phase 4

You are continuing work on **Chore Quests** (repo `rudyjm3/chore-quest`), a gamified chore, routine and goal app for families with a theme-independent adventure engine. Phases 1–3 are merged into `main`. This prompt covers (A) the Phase 3 leftovers that can be done now and (B) the first slice of Phase 4 (Pirate Adventure) that builds on services that already exist.

**Out of scope for this prompt: the real email provider.** It is handled separately later. Do not sign up for, add or configure any email service, and do not change `EmailSender` beyond what the work below needs.

## Start here

1. Read `AGENTS.md` first and follow it; it is the source of truth for architecture boundaries, conventions, security rules and the definition of done. Then read `ARCHITECTURE.md`, `ROADMAP.md` (Phase 3 and Phase 4 sections), `docs/database/DATABASE.md`, `docs/database/TIMEZONES.md`, `docs/development/API_CONVENTIONS.md`, `docs/development/PRIVACY.md`, `docs/gameplay/GAME_ENGINE.md`, `docs/gameplay/PIRATE_ADVENTURE.md`, `docs/gameplay/GOALS.md`, ADRs 0005, 0007, 0009 and 0010, and the Phase 3 section of `docs/BUILD_HEALTH_REPORT.md` (known limitations).
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

## Part A — Phase 3 leftovers (in this order)

### A1. Add/remove steps on an existing routine

Phase 2 deliberately left this out: `routine_step_progress` rows are created per run, so changing a routine's steps needs a reconciliation design.

1. **Write the ADR first** (`docs/architecture/adr/0011-…`) and commit it before any code. It must decide, with reasons:
   - What happens to runs that already exist: today's and future materialized runs, runs in progress (some steps `DONE`), runs already `SUBMITTED` or `APPROVED`, and historical runs.
   - Adding a step: which runs get a new `PENDING` progress row, and what happens to a run that was already complete or submitted (it must not silently become incomplete and lose a pending parent review).
   - Removing a step: whether to delete or retire it (keep history and ledger/audit references intact), and what happens to a run whose only remaining required steps are now done.
   - Interaction with completion windows, optional steps (at least one required step must remain), step ordering (unique order index), and activity history.
   - Concurrency: which rows to lock (`routine`, `routine_run`, ordering) so a child ticking a step cannot race an edit.
2. Implement in `routine.service` with audit entries. Reconcile existing rows in the same transaction as the step change, and do not rewrite approved or submitted history.
3. Parent UI on the routine page: add a step (pick a task, optional flag), remove a step with a confirmation that says what happens to today's runs.
4. Tests: integration tests for every case in the ADR (add/remove with runs pending, in progress, submitted, approved; last required step; concurrent tick versus edit, looped over several rounds), a violating-input test for any new constraint, an e2e for add and remove.

### A2. Photos on submissions: stay blocked

Do **not** implement uploads, storage or any image field. `docs/development/PRIVACY.md` records that this needs a documented privacy review first. In this prompt you may only:

- Draft that review as a decision document (`docs/development/PHOTO_REVIEW.md`, status "proposed, not approved"): data flow, what could be captured by accident (faces, surroundings, EXIF/location), consent under COPPA/GDPR-K, storage vendor and region, retention and deletion, who can view, moderation, and a go/no-go checklist the owner can sign off.
- Link it from `PRIVACY.md` and `ROADMAP.md`.
  State clearly in your report that nothing was built and that the owner must approve the review first.

### A3. Smaller items

1. **Child cancels their own reward request.** A child can cancel a `REQUESTED` redemption of their own (not `APPROVED`). Same reservation rules as ADR 0010: refund the points through `postLedgerEntry` with its own unique `sourceKey`, restore stock, notify the parents, audit it, idempotent, child-and-family scoped, lock order child → reward. `RedemptionStatus.CANCELLED` already exists. Tests: cancel refunds once, double-cancel is a no-op, cancel versus parent approve race (looped), another child's request is `NOT_FOUND`, cannot cancel after approval. Add the button to the child shop's "My requests".
2. **Household-local timestamps** on the audit log and notification pages (parent and child). Format instants in the family's timezone with the helpers in `src/lib/utils/dates.ts` (no `toLocaleString` on the server's zone, no `toDateString`). Unit-test the formatter across a DST change and a non-UTC zone.
3. **Notification retention job.** Add a bounded, idempotent step to the scheduled maintenance job (`maintenance.service`, ADR 0007) that deletes **read** notifications older than a documented window (default 90 days) and unread ones older than a longer window (default 180 days), in batches. Make the windows constants with an optional `NOTIFICATION_RETENTION_DAYS` override only if you also complete the env-var checklist below. Summarize the count in the job result. Tests: deletes only old rows, respects read versus unread, batches, is family-neutral, idempotent on re-run.

## Part B — Phase 4, first slice

The roadmap marks the Pirate Adventure as "functional with placeholder art". Production artwork is **not** available, so everything here goes through the asset manifests (`src/game/themes/pirate/manifest.ts`) with placeholders; never hard-code `/assets/...` paths in components. Nothing pirate-specific goes into services, schema or shared components: theme content lives in `src/game/themes/<theme>` and chapter/quest/objective `config` JSON validated by `src/game/schemas`.

Do these in order; if one is large or blocked, finish the rest and report exactly what was left out.

### B1. Supply shop UI (child)

`inventory.service.purchaseItem` already exists (idempotent, debits coins through `postLedgerEntry`, grants through `grantItem`). Build the child-facing shop:

- List purchasable items from the theme's item definitions (price, rarity, owned quantity, max quantity), with clear "can't afford" and "already have the maximum" states.
- Purchase action: `requireChildContext()`, a client-generated idempotency key per button render (as the parent adjustment form does), `ActionResult` feedback with `aria-live`.
- Tests: unit for any pure shop logic; integration for double-submit with the same key (one debit), overdraft refusal, max quantity, another family's item, and a raced double purchase against one balance (looped rounds); e2e for a purchase.

### B2. Inventory screen (child)

A collectibles and inventory page showing the child's `child_inventory_item` rows grouped by item type, with rarity styling that does not rely on colour alone. Read-only for now, scoped by `familyId` and `childId`, no other child's data. Link it from the child navigation without crowding the bottom bar (the parent nav now uses a "More" pattern; do the same on the child side if you need a seventh link, and keep touch targets ≥ 44px).

### B3. Home Port scene interactions (stretch)

Only if B1–B2 are done and green: the quest board (list the active quests and objectives from engine state) and the crew camp (cosmetic equip/unequip, persisted as small selection state in `child_adventure_progress.state`, never authoritative for rewards). Keep animation state out of persisted game state. If time is short, write a short design note for the lighthouse, hidden cove and Pip dialogue instead of building them.

## Rules that matter most here

- All writes through `src/server/services`; every action resolves the actor with `requireParentContext()`/`requireChildContext()` and every query is scoped by `familyId` (and `childId` for child actors).
- Balances change only through `postLedgerEntry`, inventory only through `grantItem`, both with a unique `sourceKey` from `src/lib/utils/source-keys.ts`. Lock the child row before reading state you will change; when a second row is involved, always lock child → other row.
- New tables/columns go through `pnpm db:migrate --name <change>` with committed SQL (non-interactive environments hang on it: if it refuses, generate the SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into a new migration directory and run `pnpm db:migrate:deploy`). Hand-written constraints get their own migration plus a violating test. Run `pnpm db:generate` after schema changes.
- Every new env var: `.env.example`, `src/lib/env.ts`, `docs/development/ENVIRONMENT.md`, README table, CI workflow.
- Every behaviour change gets tests: pure logic in `tests/unit`, Prisma in `tests/integration`, new pages in the Playwright suite. A bug fix needs a regression test that fails on the old code. Concurrency claims need a test that actually races and, where possible, a deterministic one (hold the child lock in an outer transaction, start the operation, change state, release) because a single natural race often passes by luck on the old code; verify by temporarily reverting the fix.
- Update `ROADMAP.md`, `ARCHITECTURE.md`, `docs/database/DATABASE.md`, `docs/development/TESTING.md`, `docs/gameplay/PIRATE_ADVENTURE.md` where relevant, and add an ADR for each consequential choice.
- Children under 13 use the child UI: collect no new child data, keep child pages free of external links, never show another child's data, and use friendly copy.

## Lessons from Phases 1–3 (save yourself the time)

- `prisma migrate dev` prompts interactively and hangs or refuses when non-interactive; see the migration note above. The Prisma client is git-ignored and generated by `postinstall`; run `pnpm db:generate` after any schema change.
- Inside a PostgreSQL interactive transaction a failed statement aborts the transaction: check-then-insert under a row lock, or `createMany({ skipDuplicates })`; never catch `P2002`. Never `Promise.all` on a transaction client.
- Re-read the row **after** taking its lock; checking status before the lock is a race (Phase 1 and Phase 3 reviews both caught this).
- Better Auth limits sign-in to 10 per minute and sign-up to 5. The e2e suite signs in once in `tests/e2e/auth.setup.ts` and reuses the session; keep it that way. Mutating e2e flows run on the desktop project only (`test.skip(isMobile)`). Anything that revokes the shared parent session ("sign out everywhere") must use a separately created user.
- Server-side parent session reads bypass Better Auth's cookie cache on purpose (immediate revocation).
- In Playwright, `browser.newContext()` inherits the test's `use` options; pass an empty `storageState` for a clean child device. Avoid `getByRole("alert")` alone (Next's route announcer also has that role); scope it (`p[role=alert]`). `signInAsChild` in `tests/e2e/fixtures.ts` signs a child in on a fresh device.
- `pnpm db:seed:dev` resets the demo children's PIN lockouts and marks the demo parent verified; re-run it before e2e. In this sandbox run `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e --trace off` after `pnpm build`.
- Local PostgreSQL may stop between turns: `pg_isready`, then `service postgresql start`.
- Run `next typegen` (`pnpm typecheck` does) after adding routes, or `PageProps<"/route">` will not type-check.
- Code review bots (Codex) review every PR. Verify each finding against the code, reproduce it with a failing test first, fix what is real, reply on each thread with what you traced, and resolve the thread (the resolve tool needs `owner`, `repo` and `threadId`).

## Finish

1. Run `pnpm check`, `pnpm format:check` and the e2e suite; all must pass. Also do a fresh clone into a scratch directory with its own databases and follow the README end to end.
2. Add a "Phase 3 follow-ups and Phase 4 start" section to `docs/BUILD_HEALTH_REPORT.md`: what changed, test counts, known limitations, and exactly what was left out and why.
3. Commit in logical steps (the ADR before its implementation), push the branch, open a PR against `main`, and subscribe to its activity. Fix CI failures and verify every review finding before acting on it; reply on each thread. Do not merge — I will.
