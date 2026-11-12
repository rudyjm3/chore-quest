# Environments

| Variable                                  | Dev                       | Test                            | CI                      | Production                                             |
| ----------------------------------------- | ------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------ |
| `DATABASE_URL`                            | local `chore_quests_dev`  | same as dev                     | service container       | Supabase (Vercel secret)                               |
| `TEST_DATABASE_URL`                       | local `chore_quests_test` | required                        | service container       | unset                                                  |
| `BETTER_AUTH_SECRET`                      | any 32+ chars             | same                            | CI secret/value         | strong secret                                          |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`   | `http://localhost:3100` for e2e | `http://localhost:3100` | `https://<domain>`                                     |
| `CHILD_SESSION_SECRET`                    | any 32+ chars             | same                            | CI value                | strong secret                                          |
| `CRON_SECRET`                             | optional, 16+ chars       | CI value                        | CI value                | strong secret (Vercel Cron sends it as a Bearer token) |
| `EMAIL_DRIVER`                            | `dev`                     | `dev`                           | `dev`                   | `dev` until a provider is plugged in (mail is NOT delivered) |
| `REQUIRE_EMAIL_VERIFICATION`              | `true`                    | `true`                          | `true`                  | `true` once a provider exists; `false` before |
| `PRISMA_LOG`                              | optional `query`          | —                               | —                       | unset                                                  |

Validation: `src/lib/env.ts` (server). Prisma reads `DATABASE_URL` through `prisma.config.ts` (dotenv).

## Vercel deployment preparation

1. Create a Vercel project from this repo (framework preset: Next.js; pnpm detected from the lockfile).
2. Add the production env vars above. Do **not** add `TEST_DATABASE_URL`.
3. Build command: `pnpm build`. Add `pnpm db:migrate:deploy` as a pre-deploy step (e.g. a GitHub Action
   on the release branch) — do not run migrations from the Vercel build.
4. Run `pnpm db:seed` once per environment (safe to re-run) to load presets and the pirate adventure.
5. Never run `pnpm db:seed:dev` or `pnpm db:reset` against production.
6. Planned: Vercel Cron for occurrence materialization, pipeline retries and goal expiry.

## Supabase

Use the direct/session connection (port 5432) for `prisma migrate deploy`, and either the same or the
transaction pooler (`?pgbouncer=true`, port 6543) at runtime. Only the database URL is needed by this app;
the Supabase service-role key is not used and must not be exposed to the browser.
