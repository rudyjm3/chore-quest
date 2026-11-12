# ADR 0007 — Scheduled maintenance via Vercel Cron

Status: accepted (Phase 2)

## Context

Occurrences and routine runs were generated lazily on page loads (a week at a time on the parent
dashboard). That puts write load on reads, and nothing retried stuck completions or expired goals.

## Decision

- One route handler, `GET /api/cron/maintenance`, scheduled hourly in `vercel.json`. Hourly (not
  daily) because households sit in many timezones; "today" is computed per family.
- Auth: `Authorization: Bearer $CRON_SECRET` (what Vercel Cron sends), compared in constant time.
  The route **fails closed**: with no `CRON_SECRET` it returns 503. `src/proxy.ts` does not cover
  `/api/cron`, the secret is the only gate.
- The body lives in `maintenance.service.ts` (`runScheduledMaintenance`): for each family (id-ordered
  pages of 100, never unbounded) it materializes 7 household-local days of occurrences and runs,
  then expires `ACTIVE` goal assignments whose `endDate` < local today. Finally it calls
  `reprocessPendingCompletions`. Every step is idempotent (`skipDuplicates`, `status = ACTIVE` filter)
  and a failure in one family is logged and counted without stopping the others.
- Pages keep a today-only `ensure*` call as a safety net for the gap between a new assignment and the next run.

## Consequences

- Assigning a task does not instantly create next week's occurrences; the next hourly run (or the
  today-only net) does. Acceptable for chores; revisit if parents expect instant future views.
- The same function can be invoked from any other scheduler (GitHub Actions, a worker) unchanged.
