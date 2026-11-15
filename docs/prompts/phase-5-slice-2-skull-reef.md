# Chore Quests — Phase 5, slice 2: rope fix, voyager gate, Skull Reef

You are continuing work on **Chore Quests** (repo `rudyjm3/chore-quest`), a gamified chore, routine and goal app for families with a theme-independent adventure engine. Phases 1–4 and Phase 5 slice 1 (Shipwreck Cove, PR #10, ADR 0019) are merged into `main`. This slice fixes one open item from slice 1 and starts **Skull Reef** (chapter 4). Whispering Jungle and Treasure Island are out of scope.

## Start here

1. Read `AGENTS.md` first and follow it. Then read `docs/NEXT_STEPS.md`, the last section of `docs/BUILD_HEALTH_REPORT.md` (Shipwreck Cove), `ROADMAP.md` (Phase 5), `ARCHITECTURE.md`, `docs/gameplay/PIRATE_ADVENTURE.md`, `docs/gameplay/GAME_ENGINE.md`, `docs/development/TESTING.md` and ADRs 0014, 0015, 0017, 0019 (item-hold gates, `pair-match`, the ensure step, purchases re-evaluating unlocks).
2. Work on a branch created from the latest `main` (`git fetch origin main`, never `git pull` main into your branch). If your environment names a branch you must push to, use that one. `main` is protected: changes land through a PR with the CI check `Lint, types, schema, tests, build` passing. Never push to `main`. Do not merge; I will.
3. Set up and confirm a green baseline before changing anything:
   ```bash
   sudo service postgresql start   # or: service postgresql start
   sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
   sudo -u postgres psql -c "CREATE DATABASE chore_quests_dev;" -c "CREATE DATABASE chore_quests_test;"
   pnpm install --frozen-lockfile
   cp .env.example .env
   pnpm db:migrate:deploy && pnpm db:seed && pnpm db:seed:dev
   pnpm check
   ```
   Baseline at the end of slice 1: unit 156, integration 212, e2e 60 passed / 13 skipped (mobile project, by design). Re-run `pnpm db:seed` after any change to theme data.

## What was decided in scoping (do not re-litigate)

Do the four items in this order. Write **one ADR (0020) for the Skull Reef design before implementing items 3 and 4**, committed first. Item 1 and 2 are small and need no ADR beyond a note in 0020.

1. **Rope dead end (config change plus tests).** `gather-rope` (Shipwreck Cove) accepts only `HYGIENE`, `SCHOOL` and `PET_CARE` approvals, so a household without such tasks can never finish `salvage-the-wreck`. Let the objective also accept any category once the planks objective is complete, with no engine change if possible (completions feed the first objective that accepts them). Variety is kept while planks are filling; nothing can dead-end. Cover with an integration test (a household whose only tasks are `CHORE` can finish the quest) and update the quest description text. Update the rope item in `docs/NEXT_STEPS.md` (item 8) and `PIRATE_ADVENTURE.md`. If it cannot be done without an engine change, stop and report before changing the engine.
2. **Voyager ship gate and economy.** Skull Reef unlocks on `CHAPTER_COMPLETED shipwreck-cove` **and** one `ship-voyager` (400 coins, purchasable once Shipwreck Cove is completed: no cycle). Same shape as the explorer gate in ADR 0019; the map's locked screen and the chapter hint must say what is missing. **Economy check first:** by the end of Shipwreck Cove a child who buys nothing else must be able to afford 400 coins. The measured number at the end of Parrot Island was 285 coins after claiming rewards; the cove adds roughly 4 + 3 chores × 5, quest 40, puzzle 15, side quest 15 and the chapter reward 100. Verify with a test (like the explorer test) and adjust the price or a reward if not; document the numbers. Grandfathering: children whose Skull Reef is already unlocked keep it; the placeholder chapter currently unlocks on the cove alone, so the ensure step must give them their quest rows.
3. **Navigation puzzle `route-plan`** (new type in `src/game/puzzles`). A small grid (suggested 5×5) with a start, a goal and reefs; the child picks an ordered list of cells (or moves up/down/left/right) that gets the ship from start to goal without touching a reef. The server verifies the path against the stored layout; **the safe route and the reef cells that matter must not leak beyond what the child is meant to see** (decide in the ADR whether reefs are visible on the board; if all reefs are shown, the puzzle is a planning puzzle and `toClientView` may include them; the answer is the path, never stored in the client view). Several valid paths are fine: verify by rules (adjacent steps, in bounds, no reef, ends on the goal), not by comparing to one stored path. Unit tests: valid, invalid, partial, diagonal, out-of-bounds, revisited cells, malformed config, and a test that `toClientView` has no answer data. Location `reef-chart` (puzzle kind), gated by holding N of a new collectible (like planks), not consumed.
4. **Kraken challenge** (multi-stage, no real cost). Three stages solved in sequence, each a puzzle the child already knows or `route-plan`: e.g. a `sequence-match` (the Kraken's tentacle pattern), a `pair-match` and a `route-plan`. Model it with existing machinery: one quest `defeat-the-kraken` with a `COMPLETE_PUZZLE` objective per stage, each with `requiresObjectiveKey` on the previous one, so the engine needs no new objective type. **No inventory debit and no new reward path:** rewards go through the existing puzzle/quest/chapter reward bundles. If the design seems to need a real cost (spending items to win), stop and write the ADR question for me instead of building a debit path.
5. **Skull Reef content**, flipped to `PLAYABLE` when items 2 to 4 are done: main quest (`navigate-the-reef`: collect chart pieces from approved chores like planks, solve `route-plan`, then the Kraken stages), one side quest, locations (a reef chart puzzle, the Kraken's lair puzzle location, a quest board, decorative), items, manifest placeholders and SVGs under `public/assets/adventures/pirate/` (never hard-code `/assets/...` in components). Chapter reward stays as configured (125 coins, 250 XP, 1 map fragment). Completing Skull Reef must unlock Whispering Jungle only as the existing placeholder (no content there).

## Tests required

- Unit: `route-plan` verifier and client view; any new pure helper.
- Integration: voyager gate (locked until bought; the purchase unlocks the chapter in the same transaction; economy numbers), the full Skull Reef flow through the chapter reward claim and Whispering Jungle unlocking, sibling scoping (never another child's data), the Kraken stages in order (a later stage cannot be submitted early), the ensure step on children who had the placeholder unlocked (start from the old data, then load the new theme data with `seedReferenceData`), the rope fix, and a **puzzle race** on a new puzzle (parallel correct submissions grant exactly once, verified by temporarily removing `lockChildRow` from `submitPuzzleAnswer` and restoring it).
- E2E in the isolated-household pattern from `tests/e2e/phase5-cove.spec.ts` (household built in the database with `tests/helpers/fixtures.ts`, deleted afterwards).
- Concurrency claims need a test that actually races, verified by temporarily reverting the fix; say so honestly if the test does not fail without it.

## Rules that matter most

- All writes go through `src/server/services`; every action resolves the actor with `requireParentContext()`/`requireChildContext()`; every query is scoped by `familyId` (and `childId` for child actors).
- Balances change only through `postLedgerEntry`, inventory only through `grantItem`, both with unique `sourceKey`s from `src/lib/utils/source-keys.ts`. Lock the child row before reading state you will change and re-read after taking the lock. Never catch `P2002` inside a PostgreSQL transaction. Never `Promise.all` on a transaction client.
- Nothing theme-specific (pirate names, item counts) in services, schema or shared components; theme content lives in `src/game/themes/<theme>` and validated config JSON. Never send a puzzle answer to the client: use the verifier's `toClientView` and `getPuzzleForChild`.
- Animation and sound state is client-only (ADR 0016) and never persisted; respect `prefers-reduced-motion`.
- Migrations only if needed: `pnpm db:migrate --name <change>`; if it hangs, generate SQL with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` into a new migration directory (strip non-SQL header lines) and run `pnpm db:migrate:deploy`. No schema change is expected (puzzle `type` is a free string). Every new env var needs the full checklist.
- One ADR per consequential choice, committed before its implementation. Every behaviour change needs tests.

## Out of scope (do not do)

- Real email provider, photos on submissions, the `NOTIFICATION_RETENTION_DAYS` override, puzzle attempt limits (they belong with Phase 6 edge rate limiting), consuming/debiting inventory, Whispering Jungle and Treasure Island content, Phase 6 items.

## Lessons from earlier slices

- Better Auth limits sign-in to 10/min and sign-up to 5. The e2e suite signs in once in `tests/e2e/auth.setup.ts`; keep it that way. Mutating e2e flows run on the desktop project only (`test.skip(isMobile)`).
- The child nav has a "More" menu. Target nav links by `href` when a name clashes. After a client navigation, wait for a heading or test id before calling `count()`.
- **Never put an infinite CSS animation on a clickable element** (Playwright waits forever). **Measure touch targets only after animations finish.**
- Match chapter rows in e2e by their leading number (`/^4\. Skull Reef/`): lock text of other chapters mentions chapter names. Do not use the regex `s` flag in e2e files (the TypeScript target rejects it); use `[\s\S]`. A leak check for `pairs` must match the word, not "repairs".
- A unit test caught a real leak in slice 1: a client view that lists items sorted by key can spell out the answer when keys line up. Check ordering in any new `toClientView`.
- The integration suite runs serially against one database; tests that change reference data must restore it with `seedReferenceData` in a `finally`.
- **Run e2e against a clean server.** Before e2e: `pkill -9 -f next-server; pkill -9 -f "next start"`, then `pnpm build`, `pnpm db:seed:dev`, `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:e2e --trace off`. Run it in the background writing to a log file. CI does not run e2e, so run it locally on the final code. Do not run `pnpm build` while an e2e run is using the server.
- Local PostgreSQL may stop between turns: `pg_isready`, then `service postgresql start`.
- Run `next typegen` (`pnpm typecheck` does) after adding routes. Unit tests must not import services (they need `DATABASE_URL`). Lint must have zero warnings.
- Code review bots (Codex) review every PR. Verify each finding against the code, reproduce it with a failing test first, fix what is real, reply on the thread with what you traced, and resolve it.
- Commit trailers: end commit messages and the PR body with the attribution lines your environment gives you.

## Finish

1. `pnpm check`, `pnpm format:check` and the full e2e suite must all pass.
2. Update `ROADMAP.md`, `ARCHITECTURE.md`, `docs/gameplay/PIRATE_ADVENTURE.md`, `docs/gameplay/GAME_ENGINE.md` (new puzzle type, any new config key), `docs/development/TESTING.md`, `docs/NEXT_STEPS.md` and `docs/BUILD_HEALTH_REPORT.md` (what changed, counts before/after, economy numbers, limitations, what was left out and why).
3. Commit in logical steps (ADR before its implementation), push the branch, open a PR against `main`, and subscribe to its activity. Fix CI failures and verify every review finding before acting on it. Do not merge.
4. If everything is done and green, propose (do not start) the next slice (Whispering Jungle: clues and artifacts).
