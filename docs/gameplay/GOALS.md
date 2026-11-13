# Goals: editing, reset rules and repair

Goals are parent-defined targets counted from **verified** completions (`activity_completion`). The pipeline writes one
`goal_contribution` per (assignment, completion); those rows are the source of truth for progress.

## Reset rules

| Goal                                       | Rule                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `recurrence = NONE`                        | One assignment per child. It never resets; it ends when the target is reached, when its optional end date passes (the job marks it `EXPIRED`), or when the goal is archived.                                                                                                   |
| `recurrence = WEEKLY` (weekly-count goals) | Every household week (`weekStartsOn`) is its own assignment (`periodKey = week:<start>`) with counters starting at zero. The first eligible completion after a week closes creates the next week's assignment, whether the earlier week is `ACTIVE`, `COMPLETED` or `EXPIRED`. |
| Consecutive-day goals                      | No calendar reset. A missed day restarts the current streak on the next contribution; the best streak is kept. Only one contribution per local day advances the streak; older (out-of-order) approvals never extend it.                                                        |

Closed periods (`COMPLETED`, `EXPIRED`) never take new contributions.

## Interaction with the expiry job

`maintenance.service.expireGoalAssignments` (hourly cron) sets `ACTIVE` assignments whose `endDate` is before the family's local today to
`EXPIRED`. `applyCompletionToGoals` loads `ACTIVE`, `COMPLETED` and `EXPIRED` assignments so a recurring weekly goal rolls forward even
after the job expired its last week. Both directions are covered by `tests/integration/goal-management.test.ts` and `goals.test.ts`.
Extending the end date of an `EXPIRED` assignment to a date that is not in the past reactivates it; moving an `ACTIVE` assignment's end
date into the past leaves it to the next job run.

## Editing

- **Goal** (`updateGoal`): title, description, target, reward points and reward note. The type, recurrence and eligibility filters are fixed
  after creation (history would be reinterpreted); archive the goal and create a new one instead.
  - A new target applies to every `ACTIVE` assignment without its own override. Lowering it to or below a child's progress completes that
    assignment and pays the reward exactly once (`goal_completion` is unique per assignment; the ledger key is per goal completion).
    `COMPLETED`/`EXPIRED` assignments keep their result.
  - A reward change affects only completions that happen afterwards (`goal_completion.pointsAwarded` is a snapshot).
- **Archive / restore** (`setGoalArchived`): archived goals receive no contributions and disappear from child lists; restoring brings back
  the assignments as they were.
- **Assignment** (`updateGoalAssignment`): a per-assignment target override (`targetOverride`, null = use the goal's), and for one-off goals
  the start/end dates. Weekly assignments are pinned to their week, so their dates are fixed; a target override then applies to that week
  only (the next week reverts to the goal's target). Completed assignments cannot be edited.

## Repair

`repairGoalAssignment` (also per goal via `repairGoalProgress`, shown to parents as "Recalculate progress") replays the contribution rows
in processing order with the pure `recomputeProgress` and rewrites `progressCount`, `currentStreak`, `bestStreak` and
`lastContributionDate` when they drifted. For streak goals only rows with `countedForStreak = true` are replayed (same-day repeats and
out-of-order approvals were stored as non-credited). It runs under the child row lock, is idempotent, and completes an `ACTIVE`
assignment whose replay reached the target (paying once). Changes are audited as `goal.repair`.
