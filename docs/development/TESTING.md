# Testing

| Layer       | Command                 | Location            | Database                                                                                                       |
| ----------- | ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unit        | `pnpm test`             | `tests/unit`        | none                                                                                                           |
| Integration | `pnpm test:integration` | `tests/integration` | `TEST_DATABASE_URL` (migrated + seeded by `tests/helpers/global-setup.ts`, household data wiped between tests) |
| End-to-end  | `pnpm test:e2e`         | `tests/e2e`         | `DATABASE_URL` with `pnpm db:seed:dev` fixtures; production build on port 3100                                 |

## What is covered

Unit: local dates and DST, recurrence, goal progress/streaks, reward math and source keys, engine unlock /
objective rules, pirate content validity, puzzle verifier, Zod schemas, authorization helpers.

Integration (spec edge cases): FK/uniqueness/CHECK constraints, transaction rollback, occurrence
generation idempotency, approve twice, four concurrent approvals, pipeline re-run, submit already-approved,
reject → resubmit → approve, auto-approve, a chore feeding multiple goals, two same-day chores on a streak,
streak partial index, weekly goal across a timezone boundary with weekly roll-over, chapter reward double
claim (parallel), full Home Port → Parrot Island progression incl. puzzle gating, idempotent purchase and
overdraft refusal, cross-family access, guardian vs owner permissions, child PIN lockout and sessions,
recurring task edited after completion, a recurring weekly goal completed in its first week rolling forward,
concurrent completion of a routine's last steps, auto-approved routines, rejected routines reopening
their steps.

E2E smoke: landing, health, sign-in pages, security headers, anonymous redirects, wrong password, parent
sign-in + navigation + children list, parent session cannot enter child area, child sign-in with family
code + PIN, today view, adventure map markers, child session cannot enter parent area, wrong PIN,
device hand-over signs the parent out.

Phase 2 additions — unit: completion-window logic (inclusive bounds, overnight, DST, timezone), history cursor, window schema, cron route
auth. Integration: maintenance job (7 local days per timezone, idempotent, goal expiry, completion retry, outbox pruning), task/assignment
editing never rewrites occurrences, archived children skipped, child profiles (avatar allow-list, archive/restore, PIN reset, code rotation),
routine editing (reorder permutations, optional steps, archive), window enforcement with a faked clock, history pagination (ties, filters,
scoping, tampered cursor, page-size clamp), invitations (hash-only storage, expiry, revoke, wrong email, concurrent accept, OWNER only, caps,
mail failure) and the `family_invitation` constraints. E2E: preset browser, task edit/archive, avatar + child archive/restore, routine reorder,
history page, settings; sign-up verification, password reset and the invite → accept → remove flow (desktop project only, because auth endpoints
are rate limited).

## Conventions

- Fixtures in `tests/helpers/fixtures.ts` create families/children/tasks directly; use services for the
  behaviour under test.
- Integration tests run serially (`fileParallelism: false`) because they share one database.
- Keep e2e at smoke level until Phase 6; richer journeys are listed in the roadmap.
- E2E reads emailed links from the `email_outbox` table (`tests/e2e/outbox.ts`), the same data `/dev/outbox` shows.
