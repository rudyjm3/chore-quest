# Database

PostgreSQL via Prisma 7 (`prisma/schema.prisma`, migrations in `prisma/migrations`). Table names are
snake_case (`@@map`); model names are PascalCase. All ids are UUIDs (v7 for application tables,
`gen_random_uuid()` for Better Auth tables). Timestamps are `timestamptz` in UTC; household-local
dates are `date` columns.

## Migration history

| #   | Migration                                                | Contents                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20261110161727_auth_families`                           | Better Auth tables (`user`, `session`, `account`, `verification`), `family`, `family_settings`, `family_member`, `child`, `child_credential`, `child_session`, `audit_log`                                                                                                                      |
| 2   | `20261110161735_tasks_routines`                          | `task_preset`, `task`, `task_assignment`, `task_occurrence`, `routine_template`, `routine_template_step`, `routine`, `routine_step`, `routine_assignment`, `routine_run`, `routine_step_progress`                                                                                               |
| 3   | `20261110161739_approvals_activity_completions`          | `task_submission`, `parent_review`, `activity_completion`                                                                                                                                                                                                                                       |
| 4   | `20261110161744_goals`                                   | `goal`, `goal_assignment`, `goal_contribution`, `goal_completion`                                                                                                                                                                                                                               |
| 5   | `20261110161748_rewards_achievements`                    | `reward_wallet`, `reward_ledger_entry`, `reward_definition`, `reward_redemption`, `achievement_definition`, `earned_achievement`                                                                                                                                                                |
| 6   | `20261110161753_adventures_inventory`                    | `adventure`, `adventure_chapter`, `adventure_quest`, `quest_objective`, `puzzle_definition`, `item_definition`, `child_adventure_progress`, `child_chapter_progress`, `quest_progress`, `objective_progress`, `quest_contribution`, `puzzle_attempt`, `child_inventory_item`, `inventory_grant` |
| 7   | `20261110161821_integrity_constraints`                   | Hand-written CHECK constraints and partial unique indexes (below)                                                                                                                                                                                                                               |
| 8   | `20261112082815_family_invitations_email_outbox`         | `family_invitation` (hashed-token guardian invites), `email_outbox` (dev email driver capture)                                                                                                                                                                                                  |
| 9   | `20261112082817_family_invitation_constraints`           | Hand-written: guardian-only role CHECK, single-outcome CHECK, accepted-has-user CHECK, partial unique index `family_invitation_one_open_per_email`                                                                                                                                              |
| 10  | `20261113090000_phase3_notifications_reward_stock_hints` | `notification` (+ `NotificationKind`), `reward_definition.stock`, `reward_redemption.resolutionNote/refundEntryId`, `RewardSourceType.REDEMPTION_REFUND`, `achievement_definition.hint`                                                                                                         |
| 11  | `20261113090100_phase3_constraints`                      | Hand-written: notification has exactly one recipient, `stock >= 0`, refund requires debit                                                                                                                                                                                                       |
| 12  | `20261113090200_routine_run_review_note`                 | `routine_run.reviewNote` (parent note visible to the child)                                                                                                                                                                                                                                     |
| 13  | `20261113090300_goal_assignment_target_override`         | `goal_assignment.targetOverride` + CHECK `> 0`                                                                                                                                                                                                                                                  |
| 14  | `20261113100000_routine_step_retire`                     | `routine_step.retiredAt` (ADR 0011); `(routineId, sortOrder)` and `(routineId, taskId)` uniqueness becomes partial (`WHERE retiredAt IS NULL`)                                                                                                                                                  |
| 15  | `20261113110000_notification_created_at_index`           | Index on `notification.createdAt` for the retention job (ADR 0009)                                                                                                                                                                                                                              |
| 16  | `20261113120000_inventory_source_location_reward`        | `InventorySourceType.LOCATION_REWARD` (one-time location rewards, ADR 0014). Enum value only; no table changes.                                                                                                                                                                                 |

Workflow: edit the schema → `pnpm db:migrate --name <change>` (dev) → commit SQL → CI runs
`prisma migrate deploy` and a drift check (`prisma migrate diff --from-config-datasource --to-schema`).
`prisma db push` is not used.

## Ownership boundaries

- **Better Auth owns** `user`, `session`, `account`, `verification`. Regenerate with `pnpm auth:schema`.
  Application code only adds relation fields on `User` and reads `user.id/name/email`.
- **Application owns** everything else. Children are _not_ users.

## Entity overview

```mermaid
erDiagram
  USER ||--o{ FAMILY_MEMBER : "adult in"
  FAMILY ||--o{ FAMILY_MEMBER : has
  FAMILY ||--o{ CHILD : has
  FAMILY ||--|| FAMILY_SETTINGS : has
  CHILD ||--o| CHILD_CREDENTIAL : pin
  CHILD ||--o{ CHILD_SESSION : sessions
  FAMILY ||--o{ TASK : library
  TASK_PRESET ||--o{ TASK : "copied from"
  TASK ||--o{ TASK_ASSIGNMENT : assigned
  CHILD ||--o{ TASK_ASSIGNMENT : to
  TASK_ASSIGNMENT ||--o{ TASK_OCCURRENCE : "per local date"
  TASK_OCCURRENCE ||--o| TASK_SUBMISSION : submitted
  TASK_SUBMISSION ||--o| PARENT_REVIEW : reviewed
  TASK_OCCURRENCE ||--o| ACTIVITY_COMPLETION : verified
  ROUTINE ||--o{ ROUTINE_STEP : steps
  ROUTINE_STEP }o--|| TASK : references
  ROUTINE ||--o{ ROUTINE_ASSIGNMENT : assigned
  ROUTINE_ASSIGNMENT ||--o{ ROUTINE_RUN : "per local date"
  ROUTINE_RUN ||--o{ ROUTINE_STEP_PROGRESS : steps
  ROUTINE_RUN ||--o| ACTIVITY_COMPLETION : verified
  ACTIVITY_COMPLETION ||--o{ GOAL_CONTRIBUTION : feeds
  ACTIVITY_COMPLETION ||--o{ REWARD_LEDGER_ENTRY : credits
  ACTIVITY_COMPLETION ||--o{ QUEST_CONTRIBUTION : feeds
  GOAL ||--o{ GOAL_ASSIGNMENT : per child/period
  GOAL_ASSIGNMENT ||--o{ GOAL_CONTRIBUTION : has
  GOAL_ASSIGNMENT ||--o| GOAL_COMPLETION : done
  CHILD ||--o{ REWARD_WALLET : "POINTS/COINS/XP"
  CHILD ||--o{ REWARD_LEDGER_ENTRY : history
  ADVENTURE ||--o{ ADVENTURE_CHAPTER : chapters
  ADVENTURE_CHAPTER ||--o{ ADVENTURE_QUEST : quests
  ADVENTURE_QUEST ||--o{ QUEST_OBJECTIVE : objectives
  ADVENTURE_CHAPTER ||--o{ PUZZLE_DEFINITION : puzzles
  ADVENTURE ||--o{ ITEM_DEFINITION : items
  CHILD ||--o{ CHILD_ADVENTURE_PROGRESS : plays
  CHILD_ADVENTURE_PROGRESS ||--o{ CHILD_CHAPTER_PROGRESS : chapters
  CHILD ||--o{ QUEST_PROGRESS : quests
  QUEST_PROGRESS ||--o{ OBJECTIVE_PROGRESS : objectives
  OBJECTIVE_PROGRESS ||--o{ QUEST_CONTRIBUTION : has
  CHILD ||--o{ CHILD_INVENTORY_ITEM : owns
  CHILD ||--o{ INVENTORY_GRANT : history
```

## Key tables and invariants

### Identity and families

- `family`: `timezone` (IANA), `weekStartsOn` (0–6, CHECK), `childLoginCode` (unique, used by child sign-in).
- `family_member`: unique `(familyId, userId)`; `role` OWNER | GUARDIAN; `status` ACTIVE | INVITED | REMOVED.
- `child`: minimal profile (`displayName`, optional `avatarKey`, optional `birthYear`).
- `child_credential`: scrypt PIN hash, `failedAttempts`, `lockedUntil`.
- `child_session`: `tokenHash` (HMAC of the cookie token, unique), `expiresAt > createdAt` (CHECK), `revokedAt`.
- `audit_log`: append-only; `actorType` PARENT | CHILD | SYSTEM; indexed by `(familyId, createdAt)` and `(entityType, entityId)`.

- `family_invitation` (Phase 2): email-bound, single-use guardian invite. `tokenHash` is the SHA-256 of the link token (unique; the raw
  token is never stored). Pending = `acceptedAt IS NULL AND revokedAt IS NULL AND expiresAt > now()`. CHECKs: `role = 'GUARDIAN'`,
  not both accepted and revoked, accepted ⇒ `acceptedById`. Partial unique `(familyId, email)` while neither accepted nor revoked.
- `email_outbox` (Phase 2): mail captured by the **development** email driver only. It has no `familyId` on purpose (auth mail exists
  before a family does) and is pruned after 7 days by the maintenance job. Real providers never write to it.

### Tasks and routines

- `task` is the family's definition; `task_assignment` is who/when; `task_occurrence` is one concrete instance:
  unique `(assignmentId, localDate)`, `pointsSnapshot` frozen at generation (edits never rewrite history).
- `daysOfWeek` arrays are CHECKed to `⊆ {0..6}`; `endDate >= startDate`.
- `routine_assignment.windowStart/windowEnd` ("HH:mm", household-local, both or neither) restrict when a child may complete steps; enforced in
  `completeRoutineStep`. If end <= start the window is overnight and ends on the next local day.
- `routine_step.isOptional` steps are not required to submit a run; `sortOrder` is rewritten via a two-phase update (negative then final) to
  satisfy the unique index.
- `routine_step` references `task`; among **active** steps (`retiredAt IS NULL`) `(routineId, taskId)` and `(routineId, sortOrder)` are unique (partial indexes): no duplicated tasks. Steps are retired, never deleted (ADR 0011); a run's steps are its `routine_step_progress` rows.
- `routine_run` unique `(assignmentId, localDate)`; `routine_step_progress` unique `(runId, stepId)`.
- Global library: `task_preset` (unique `key`), `routine_template` + `routine_template_step`.

### Approvals and activity

- `task_submission` unique per `occurrenceId` (resubmission increments `attempt`); `parent_review` unique per submission, `reviewerUserId` null + `isAutomatic` for policy approvals.
- `activity_completion` is the canonical verified event: unique `taskOccurrenceId`, unique `routineRunId`, and the CHECK
  `activity_completion_single_source_chk` requires exactly one source matching `sourceType`. Carries denormalised
  `taskId/taskCategory/routineId` for eligibility filters and `processingStatus` (PENDING | PROCESSED | FAILED) for the resumable pipeline.

### Goals

- `goal` (definition with optional filters) → `goal_assignment` unique `(goalId, childId, periodKey)`; `periodKey` is `""` for
  one-off goals and `week:<weekStart>` for weekly goals.
- `goal_contribution` unique `(goalAssignmentId, completionId)`; partial unique index `goal_contribution_streak_day_uq` on
  `(goalAssignmentId, localDate) WHERE countedForStreak` guarantees at most one streak advance per day.
- `goal_completion` unique per assignment; links to the reward ledger.
- `goal_assignment.targetOverride` (CHECK `> 0`, null = goal target). The cached counters (`progressCount`, `currentStreak`, `bestStreak`,
  `lastContributionDate`) are rebuildable from `goal_contribution` (see `docs/gameplay/GOALS.md`).

### Rewards

- `reward_wallet` unique `(childId, currency)`, CHECK `balance >= 0`.
- `reward_ledger_entry`: unique `sourceKey` (idempotency), unique `(sourceType, sourceId, currency)`, CHECK `amount <> 0`,
  CHECK `balanceAfter >= 0`. Always written in the same transaction as the wallet update.
- `reward_definition`: optional `stock` (null = unlimited, CHECK `>= 0`), archived with `isActive`. `reward_redemption`: price snapshot in
  `costPoints`; the debit entry (`ledgerEntryId`) is written **at request time**, a denial writes a refund entry (`refundEntryId`, type
  `REDEMPTION_REFUND`, CHECK refund requires debit); `resolutionNote` is the parent note shown to the child (ADR 0010).
- `achievement_definition` (unique `key`, `adventureKey` null = platform-wide, `hint` = spoiler-free text shown while locked) / `earned_achievement` unique `(childId, achievementId)`.

### Notifications and audit

- `notification`: `familyId`, exactly one of `recipientUserId`/`recipientChildId` (CHECK `notification_one_recipient_chk`), `kind`, `title`,
  `body`, `entityType/entityId`, `dedupeKey` (unique per recipient; written with `skipDuplicates`), `readAt`. Indexed
  `(familyId, recipient, createdAt desc, id desc)` for cursor pagination and `(familyId, recipient, readAt)` for unread counts (ADR 0009).
- `audit_log` is read through `listAuditLog` (cursor on `createdAt desc, id desc`, action-prefix and date-range filters); `metadata` is
  never returned to the UI, only a rendered summary.
- `routine_run.reviewNote`: latest parent note on approve/reject; for task occurrences the note lives on `parent_review.note`.

### Adventure and inventory

- Definitions: `adventure` (unique `key`), `adventure_chapter` unique `(adventureId, key)` and `(adventureId, sortOrder)`,
  `adventure_quest` unique `(chapterId, key)`, `quest_objective` unique `(questId, key)`, `puzzle_definition` unique `(chapterId, key)`,
  `item_definition` unique `key`. Config JSON columns are validated by `src/game/schemas`.
- Progress: `child_adventure_progress` unique `(childId, adventureId)`; `child_chapter_progress` unique `(childId, chapterId)` with
  `rewardClaimedAt`; `quest_progress` unique `(childId, questId)`; `objective_progress` unique `(questProgressId, objectiveId)` with
  CHECK `0 <= currentCount <= targetCount`; `quest_contribution` unique `(objectiveProgressId, completionId)`.
- `puzzle_attempt`: partial unique index `puzzle_attempt_completed_uq` on `(childId, puzzleId) WHERE status = 'COMPLETED'`.
- `child_inventory_item` unique `(childId, itemId)`, CHECK `quantity >= 0`; `inventory_grant` unique `sourceKey`, CHECK `quantity <> 0`.
- `child_adventure_progress.state` (JSON) holds `{ equipped: { <slot>: <itemKey> } }` validated by `adventureStateSchema` (ADR 0013); never authoritative for rewards. One-time location rewards are `inventory_grant` rows with `sourceType = LOCATION_REWARD` and `sourceKey = location:<adventureProgressId>:<chapterKey>:<locationKey>:item:<itemKey>` (ADR 0014); "already found" is derived from that row.

## Transactions and locking

- Approval: `SELECT … FOR UPDATE` on the occurrence/run row, then status re-check → idempotent. Bulk approval is one transaction per item.
- Redemptions: lock order is always child row → reward row; the redemption is re-read inside the lock (ADR 0010).
- Pipeline and all wallet/inventory/progress writes: `lockChildRow(tx, childId)` serializes per child.
- Inside PostgreSQL interactive transactions a failed statement aborts the transaction, so services check-then-insert
  under the lock (or use `createMany({ skipDuplicates })`) instead of catching unique violations.

## Retention and deletion

Deleting a `family` cascades to every household table; deleting a `user` cascades to their auth rows and
memberships (families they created are kept via `createdById` restrict — reassign ownership first).
`family_settings.historyRetentionDays` is reserved for a retention job (not yet implemented).
