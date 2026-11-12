# Chore Quests

Chore Quests is a gamified chore, routine and goal manager for families. Parents assign real-world
responsibilities; children complete them to earn points, achievements and progress through adventure
worlds. The first theme is **Pirate Adventure — The Lost Treasure of Blackbeard Bay**.

This repository contains the **Phase 1 foundation**: a runnable Next.js application with the full
database schema, migrations, seed data, authentication, authorization, domain services, a parent and
child UI shell, and an automated test suite. See [ROADMAP.md](ROADMAP.md) for what comes next and
[docs/BUILD_HEALTH_REPORT.md](docs/BUILD_HEALTH_REPORT.md) for what was validated.

## Technology stack

| Layer           | Technology                                         | Version (pinned)         |
| --------------- | -------------------------------------------------- | ------------------------ |
| Framework       | Next.js (App Router, Turbopack, `proxy.ts`)        | 16.4.6                   |
| UI              | React, Tailwind CSS v4, shadcn/ui (Radix), lucide  | 19.3.0 / 4.3.3           |
| Language        | TypeScript (strict)                                | 5.9.3 (see note)         |
| Database        | PostgreSQL                                         | 16 locally               |
| ORM             | Prisma ORM + `@prisma/adapter-pg` driver adapter   | 7.10.1 (see note)        |
| Auth (parents)  | Better Auth (email + password, Prisma adapter)     | 1.7.19                   |
| Auth (children) | Family-managed PIN sessions (in-house, see docs)   | —                        |
| Validation      | Zod                                                | 4.6.7                    |
| Client state    | Zustand (installed; used from Phase 4 for game UI) | 5.1.0                    |
| Tests           | Vitest 5 (unit + integration), Playwright (e2e)    | 5.1.0 / 1.65             |
| Package manager | pnpm                                               | 10.28 (`packageManager`) |

Version notes

- **Prisma is pinned to 7.10.1.** The npm `latest` tag for the `prisma` CLI currently points at an
  8.0 release candidate, which Better Auth's Prisma adapter does not support yet. Do not upgrade
  `prisma`, `@prisma/client` and `@prisma/adapter-pg` independently of each other.
- **TypeScript stays on 5.9.x.** TypeScript 7 (the native port) is published as `latest` but is not yet
  what `create-next-app` and `eslint-config-next` target. Revisit when Next.js documents support.
- **ESLint 9** is used because that is what `eslint-config-next@16` scaffolds; ESLint 10 is available
  but untested with the Next config.

## Requirements

- Node.js 22 LTS (tested on 22.23)
- pnpm 10 (`corepack enable` will pick the pinned version from `package.json`)
- PostgreSQL 14+ (16 recommended) reachable locally, or Docker

## Installation

```bash
git clone <this repository> chore-quests
cd chore-quests
pnpm install --frozen-lockfile   # also runs `prisma generate` (postinstall)
cp .env.example .env         # then edit values (see below)
```

The Prisma client is generated into `src/generated/prisma`, which is git-ignored. If it is ever missing
(for example after `pnpm install --ignore-scripts`), run `pnpm db:generate`.

## Environment configuration

All variables are documented in [`.env.example`](.env.example) and validated at startup by
`src/lib/env.ts`. The important ones:

| Variable               | Purpose                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`         | PostgreSQL connection used by Prisma (runtime, migrations, seed)                                             |
| `TEST_DATABASE_URL`    | A **separate** database that integration tests reset                                                         |
| `BETTER_AUTH_SECRET`   | 32+ random bytes; signs parent sessions (`openssl rand -base64 32`)                                          |
| `BETTER_AUTH_URL`      | Public origin, e.g. `http://localhost:3000`                                                                  |
| `NEXT_PUBLIC_APP_URL`  | Same origin, exposed to the browser for the auth client                                                      |
| `CHILD_SESSION_SECRET` | 32+ random bytes; HMAC key for child session tokens                                                          |
| `CRON_SECRET`          | 16+ random chars; Bearer secret for `/api/cron/maintenance` (optional locally; route returns 503 when unset) |

Never commit `.env`. Only `.env.example` is tracked.

## Local database setup

Option A — PostgreSQL installed locally:

```bash
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE chore_quests_dev;"
sudo -u postgres psql -c "CREATE DATABASE chore_quests_test;"
```

Option B — Docker:

```bash
docker run --name chore-quests-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec chore-quests-pg psql -U postgres -c "CREATE DATABASE chore_quests_dev;"
docker exec chore-quests-pg psql -U postgres -c "CREATE DATABASE chore_quests_test;"
```

The defaults in `.env.example` match both options. Then apply migrations and seed:

```bash
pnpm db:migrate:deploy   # apply committed migrations (no prompts)
pnpm db:seed             # idempotent reference data: task presets, routine templates, pirate adventure
pnpm db:seed:dev         # OPTIONAL demo family for local development / e2e (never in production)
```

`pnpm db:seed:dev` prints the demo parent login (`demo.parent@chorequests.local` /
`DemoPassword123!`), the family code and the children's PINs (Ava 1234, Max 5678).

### Connecting Supabase PostgreSQL later

Set `DATABASE_URL` to the Supabase **session pooler or direct** connection string (port 5432) for
migrations, and the same or the transaction pooler (port 6543, add `?pgbouncer=true`) for the runtime.
Prisma 7's `pg` adapter works with both. Keep the service-role key and database password in Vercel
environment variables only; nothing in `src/` reads them except `src/lib/env.ts` on the server.

## Development commands

| Command                             | What it does                                     |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm dev`                          | Start the dev server at http://localhost:3000    |
| `pnpm build` / `pnpm start`         | Production build / serve                         |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (Next core-web-vitals + TypeScript rules) |
| `pnpm format` / `pnpm format:check` | Prettier                                         |
| `pnpm typecheck`                    | `next typegen` + `tsc --noEmit`                  |

## Database commands

| Command                  | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `pnpm db:generate`       | Regenerate the Prisma client into `src/generated/prisma`             |
| `pnpm db:validate`       | Validate `prisma/schema.prisma`                                      |
| `pnpm db:migrate`        | Create + apply a new migration in development (`prisma migrate dev`) |
| `pnpm db:migrate:deploy` | Apply committed migrations (CI, staging, production)                 |
| `pnpm db:migrate:status` | Show applied / pending migrations                                    |
| `pnpm db:reset`          | Drop, re-create, migrate and seed the **dev** database (destructive) |
| `pnpm db:seed`           | Run `prisma/seed.ts` (idempotent reference data)                     |
| `pnpm db:seed:dev`       | Run `prisma/seed-dev.ts` (demo household, development only)          |
| `pnpm db:studio`         | Prisma Studio                                                        |
| `pnpm auth:schema`       | Regenerate Better Auth models into the Prisma schema                 |

Workflow rule: schema changes go through `pnpm db:migrate --name <change>`; `prisma db push` is not
part of this project's workflow. See [docs/database/DATABASE.md](docs/database/DATABASE.md).

## Testing commands

| Command                 | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm test`             | Unit tests (pure functions, no database)                            |
| `pnpm test:integration` | Integration tests against `TEST_DATABASE_URL` (migrates + seeds it) |
| `pnpm test:e2e`         | Playwright smoke tests against a production build on port 3100      |
| `pnpm test:all`         | All three                                                           |
| `pnpm check`            | lint → typecheck → schema validate → unit → integration → build     |

Before `pnpm test:e2e`: `pnpm build && pnpm db:seed:dev` (the dev database must contain the demo
family). Set `E2E_BASE_URL` to test an already running server. In sandboxes with a pre-installed
Chromium, set `PW_CHROMIUM_PATH=/path/to/chromium`.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full map. In short:

```
prisma/           schema, migrations, seed scripts
src/app/          routes: (auth), (parent), (child), api
src/components/   ui (shadcn), layout shells, shared widgets
src/features/     per-domain server actions, pure logic and form components
src/server/       services (persistence + transactions) and policies (authorization)
src/game/         adventure engine: schemas, pure engine, themes, puzzles, chapter loader
src/lib/          auth, db, env, errors, validation, utils
tests/            unit, integration, e2e, helpers
docs/             architecture, database, gameplay, development, build health report
```

## Troubleshooting

- **`Invalid server environment configuration`** — a variable in `.env` is missing or too short.
  The message lists each problem.
- **`prisma migrate dev` hangs** — it is waiting for an interactive answer (for example a name for a
  new migration because the schema changed). Run it in a terminal, not through a pipe, or pass `--name`.
- **`P1001: Can't reach database server`** — PostgreSQL is not running or the port in `DATABASE_URL`
  is wrong. `pg_isready` should answer on 5432.
- **Integration tests refuse to start** — `TEST_DATABASE_URL` must be set and must differ from
  `DATABASE_URL`; the suite deletes household data in that database.
- **Playwright cannot find a browser** — run `pnpm exec playwright install chromium` once, or set
  `PW_CHROMIUM_PATH`.
- **Type errors mentioning `LayoutProps` / `PageProps`** — run `pnpm typecheck` (it runs `next typegen`
  first) rather than bare `tsc`.
- **`Cannot find module '@/generated/prisma/client'`** — the Prisma client was not generated. Run
  `pnpm db:generate` (normally done by `pnpm install`).
- **Better Auth: "Prisma schema mismatch"** — run `pnpm auth:schema`, review the diff in
  `prisma/schema.prisma`, then `pnpm db:migrate --name better-auth-update`.
