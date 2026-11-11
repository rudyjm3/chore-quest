# AGENTS.md — instructions for AI coding agents

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project purpose

Chore Quests is a family chore/routine/goal manager with a theme-independent adventure engine.
Parents assign responsibilities; children complete them; verified completions drive points, goals,
and adventure progress. The first theme is the Pirate Adventure. Children under 13 are expected users:
privacy and safety are foundational, not features.

## Before you start

1. Read `README.md`, `ARCHITECTURE.md` and the doc for the area you touch (`docs/database`,
   `docs/gameplay`, `docs/development`). Check `ROADMAP.md` for what is deliberately deferred.
2. Read `node_modules/next/dist/docs/` for any Next.js API you are unsure about (Next 16 differs:
   `proxy.ts`, async `cookies()/headers()/params`, typed `LayoutProps`/`PageProps`).
3. Run `pnpm install`, `pnpm db:migrate:deploy`, `pnpm db:seed`, then `pnpm check` to confirm a green
   baseline before changing anything.

## Approved stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 + shadcn/ui · Prisma 7.10 with
`@prisma/adapter-pg` · PostgreSQL · Better Auth 1.7 · Zod 4 · Zustand 5 · Vitest 5 · Playwright · pnpm.
Do not add a dependency when the stack already covers the need. Keep `prisma`, `@prisma/client` and
`@prisma/adapter-pg` on the same version; do not move to Prisma 8 until Better Auth supports it.

## Architecture boundaries (non-negotiable)

- `src/app` routes → `src/features` actions/components → `src/server/services` → `src/lib`.
  Pages never call Prisma directly for writes; all writes go through services.
- Only `src/server/services` writes to the database. Services take `db: DbClient` as the first
  argument so tests can inject a test client.
- `src/game/engine` and `src/features/*/{recurrence,progress,calculations}.ts` are pure: no I/O.
- The adventure engine consumes `ActivityCompletion` rows. It never writes to task/routine/goal tables.
- Nothing theme-specific (pirate names, crate counts) goes into services, schema or shared components.
  Theme content lives in `src/game/themes/<theme>` and chapter/quest/objective `config` JSON validated by
  `src/game/schemas`.
- Reward balances change only through `postLedgerEntry`; inventory only through `grantItem`.
  Both require a unique `sourceKey` from `src/lib/utils/source-keys.ts`.

## Coding conventions

- TypeScript strict; no `any`, no non-null assertions in production code unless the invariant is
  documented on the line. Prefer `satisfies`, discriminated unions and `z.infer`/`z.input`.
- Named exports; files in kebab-case; React components in PascalCase; one component per file for
  anything non-trivial.
- Server components by default; add `"use client"` only to leaves that need state or browser APIs.
- Validate at trust boundaries with Zod schemas from `src/lib/validation` (`parseOrThrow`).
- Throw `AppError` from services; return `ActionResult` from actions (`runAction`).
- Dates: UTC `Date` for instants, `LocalDate` strings (`YYYY-MM-DD`) for household-local days, helpers
  in `src/lib/utils/dates.ts`. Never use `new Date().toDateString()` or local-time arithmetic.
- Logging through `src/lib/logging.ts`; never log tokens, PINs, emails or child data.
- Format with Prettier (`pnpm format`); lint must pass with zero warnings.

## Component design

- Reuse `src/components/ui` (shadcn) and `src/components/shared` before creating new primitives.
- Mobile-first, keyboard accessible, labelled form controls, `aria-live` for async feedback.
- Parent UI: neutral, dense, functional. Child UI: `theme-child` tokens, large targets (≥44px),
  playful but readable.
- Artwork goes through asset manifests; never hard-code `/assets/...` paths in components.
- Keep animation state out of persisted game state.

## Database and migrations

- Change `prisma/schema.prisma`, then `pnpm db:migrate --name <snake_case_change>`. Commit the generated
  SQL. Review it: destructive changes need an explicit plan and a backfill.
- Hand-written constraints (CHECK, partial indexes) belong in their own migration with comments; add a
  test in `tests/integration/schema-integrity.test.ts`.
- Never run `prisma db push`, `migrate reset`, or seeds against a production database.
- Better Auth tables are regenerated with `pnpm auth:schema`; do not hand-edit them beyond relations.
- Every new household-scoped table gets `familyId` + cascade + an index starting with `familyId`.

## Security requirements

- Resolve the actor with `requireParentContext()` / `requireChildContext()` in every action and route
  handler. `src/proxy.ts` is not an authorization layer.
- Scope every query by `familyId` (and `childId` for child actors). Use `assertFamilyScope`,
  `assertPermission`, `requireChildInFamily`.
- Idempotency keys for anything that credits/debits or grants. Lock the child row (`lockChildRow`) in
  transactions that touch wallets/inventory/progress.
- Record `audit_log` entries for approvals, reward adjustments, membership and credential changes.
- Collect the minimum child data (display name, optional birth year). No child emails, photos or
  precise location without a documented privacy review.
- Secrets only via environment variables validated in `src/lib/env.ts`; nothing secret in
  `NEXT_PUBLIC_*`.

## Testing expectations

- Pure logic → `tests/unit`. Anything touching Prisma → `tests/integration` (real PostgreSQL, uses
  `tests/helpers`). User-visible flows → `tests/e2e` (keep smoke-level unless the milestone asks for more).
- A bug fix comes with a regression test. A new invariant comes with a test that violates it.
- Run `pnpm test` and `pnpm test:integration` locally; `pnpm check` before opening a PR.

## Documentation update rules

- New table/column → `docs/database/DATABASE.md`. New service or boundary → `ARCHITECTURE.md`.
- New gameplay rule or config key → `docs/gameplay/GAME_ENGINE.md` (and the theme doc).
- New env var → `.env.example`, `src/lib/env.ts`, `docs/development/ENVIRONMENT.md`, README table.
- Consequential decision → a new ADR in `docs/architecture/adr/`.
- Update `ROADMAP.md` status when you complete or defer an item.

## Prohibited anti-patterns

- Trusting client state for rewards, approvals or progress.
- Catching `P2002` inside a PostgreSQL interactive transaction (it aborts the transaction); check first
  or use `createMany({ skipDuplicates })` instead.
- `Promise.all` of several queries on one transaction client (single connection).
- Duplicating tasks for routines, duplicating services, or copying a component instead of extending it.
- Giant utility modules, circular imports, `features` importing from `app`.
- Suppressing lint/type errors (`eslint-disable`, `@ts-ignore`) to get green.
- Pirate-specific assumptions in services, schema or shared components.
- Unbounded queries over history tables; always paginate or window by date.

## Definition of done

- `pnpm check` passes (lint, typecheck, schema validate, unit, integration, build) and e2e passes
  when UI changed.
- New behaviour is covered by tests; invariants are enforced in the database where practical.
- Authorization is enforced server-side for every new action/route.
- Docs updated per the rules above; `.env.example` in sync.
- No secrets, generated clients or build output committed.
- The change is scoped to the request: no drive-by refactors.
