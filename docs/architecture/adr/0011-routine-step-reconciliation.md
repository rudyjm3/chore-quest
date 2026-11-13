# ADR 0011 — Adding and removing steps of an existing routine

Status: accepted (Phase 3 follow-up)

## Context

`routine_step_progress` rows are materialized per run, and approved runs have already produced an `ActivityCompletion` (points, goals,
adventure progress). Editing the step list of a routine therefore has to decide what happens to rows that already exist, without
rewriting history, losing a pending parent review, or letting a child race a parent edit.

## Decision

**A run's step set is defined by its progress rows, and a step is retired, never deleted.**

- `routine_step.retiredAt` (nullable). Removing a step sets it; the row, its `routine_step_progress` rows and everything that references
  them stay. Active steps are `retiredAt IS NULL`. `routine_step` is `ON DELETE CASCADE` from `routine` only; the service never deletes a step.
- Uniqueness moves to **partial unique indexes over active steps**: `(routineId, sortOrder)` and `(routineId, taskId)` `WHERE retiredAt IS NULL`.
  Re-adding a retired task creates a new step row (the old one stays as history). Gaps in `sortOrder` are allowed; new steps are
  appended at `max(active sortOrder) + 1`; reorder still takes a permutation of the active steps.
- **Which runs change.** Only _unfinished_ runs (`PENDING`, `IN_PROGRESS`, `REJECTED`) with `localDate >= family-local today`. Today's and future
  materialized runs are reconciled; past unfinished runs are effectively missed and stay as they were.
- **Adding a step** inserts a `PENDING` progress row for each such run (`createMany skipDuplicates`). `SUBMITTED` and `APPROVED` runs get no row: they
  are finished as the child saw them, a pending parent review is never reopened and an approved completion is never invalidated.
  Runs materialized later include every active step. An optional step is added the same way, flagged optional.
- **Removing a step** retires it. Progress rows are kept, so history still shows the step. For unfinished runs the requirement is recomputed from
  the run's rows whose step is active: if the child had already done every remaining required step, the run is submitted in the same
  transaction (parents notified; `AUTO_APPROVE` assignments are then auto-approved by `approval.service` exactly as for a normal last tick).
  Otherwise it stays `IN_PROGRESS`/`PENDING`. A retired step can no longer be ticked.
- **Invariants.** A routine always keeps at least one active _required_ step (so removing the last required step is rejected, as is making it optional,
  see `setRoutineStepOptional`). Task must belong to the family and not be archived; a task cannot appear twice among active steps.
- **Completion windows** are a property of the assignment and are untouched. A newly added step must be done inside the same window.
- **Activity history** is unaffected: `ActivityCompletion` rows reference the run, not individual steps; display of a finished run lists the steps it
  has progress rows for (including retired ones).
- **Concurrency.** Step edits lock `routine` first, then every affected run `FOR UPDATE` in `id` order. `completeRoutineStep` and review lock only the run, then read steps
  after the lock (READ COMMITTED sees the committed edit), so the order is always routine → run and no cycle exists. A tick racing an edit
  sees either the whole old or the whole new step set, and the run cannot end up submitted with a required row missing.
- Every add/remove is audited (`routine.step.add`, `routine.step.remove`) with counts of runs touched/submitted.

## Consequences

- Removing then re-adding a task yields a fresh step; progress for the old step is not carried over.
- An in-progress run whose child already did everything else is submitted on removal; the parent sees the usual "finished" notification.
- A step added after a run was submitted does not apply to that day; it applies from the next unfinished run.
- Queries that list a routine's steps for management must filter `retiredAt: null`; child/history views derive steps from progress rows.
