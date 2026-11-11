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

| Suite                                                          | Result                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| Unit (`pnpm test`)                                             | 48 passed / 48 (7 files)                                     |
| Integration (`pnpm test:integration`)                          | 31 passed / 31 (5 files) on PostgreSQL 16                    |
| End-to-end (`pnpm test:e2e`)                                   | 22 passed / 22 (11 scenarios × chromium + Pixel 7 emulation) |
| Lint / format / typecheck / schema validate / production build | pass                                                         |

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
