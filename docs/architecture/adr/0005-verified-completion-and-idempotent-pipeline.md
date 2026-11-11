# ADR 0005 — `ActivityCompletion` as the single source of truth, idempotent two-phase pipeline

**Status:** accepted · **Date:** 2026-11-10

## Context

Goals, rewards and adventure progress must all derive from the same approved chore without duplicate
records, under retries, refreshes and concurrent approvals.

## Decision

- Approval creates exactly one `activity_completion` per occurrence/run (unique source columns + CHECK).
- Downstream effects run in `processCompletion` in a second transaction: child row locked, every write
  keyed by a unique `sourceKey` (ledger, inventory) or unique pair (goal/quest contributions), and the
  completion marked `PROCESSED` at the end. `reprocessPendingCompletions` retries `PENDING`/`FAILED` rows.
- Instead of a separate outbox table, the completion row itself is the durable work item.

## Consequences

- Re-running the pipeline is always safe (tested).
- A failure leaves an approved chore with pending rewards until retry; the parent UI shows the state.
- A dedicated outbox can be introduced later without changing the uniqueness guarantees.
