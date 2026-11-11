-- ---------------------------------------------------------------------------
-- 0007 — Additional integrity constraints
-- These invariants cannot be expressed in the Prisma schema language, so they
-- live here as hand-written SQL. Prisma Migrate ignores CHECK constraints and
-- partial indexes when diffing, so later `prisma migrate dev` runs keep them.
-- ---------------------------------------------------------------------------

-- A verified completion references exactly one source record, and that
-- source must match its declared sourceType.
ALTER TABLE "activity_completion"
  ADD CONSTRAINT "activity_completion_single_source_chk" CHECK (
    ("sourceType" = 'TASK_OCCURRENCE' AND "taskOccurrenceId" IS NOT NULL AND "routineRunId" IS NULL)
    OR
    ("sourceType" = 'ROUTINE_RUN' AND "routineRunId" IS NOT NULL AND "taskOccurrenceId" IS NULL)
  );

-- Points are never negative at any level.
ALTER TABLE "task"            ADD CONSTRAINT "task_points_nonneg_chk"             CHECK ("points" >= 0);
ALTER TABLE "task_preset"     ADD CONSTRAINT "task_preset_points_nonneg_chk"      CHECK ("defaultPoints" >= 0);
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_points_nonneg_chk"  CHECK ("pointsOverride" IS NULL OR "pointsOverride" >= 0);
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_points_nonneg_chk"  CHECK ("pointsSnapshot" >= 0);
ALTER TABLE "routine_assignment" ADD CONSTRAINT "routine_assignment_bonus_nonneg_chk" CHECK ("bonusPoints" >= 0);
ALTER TABLE "activity_completion" ADD CONSTRAINT "activity_completion_points_nonneg_chk" CHECK ("pointsAwarded" >= 0);
ALTER TABLE "goal"            ADD CONSTRAINT "goal_target_positive_chk"           CHECK ("targetCount" > 0);
ALTER TABLE "goal"            ADD CONSTRAINT "goal_reward_nonneg_chk"             CHECK ("rewardPoints" >= 0);
ALTER TABLE "reward_definition" ADD CONSTRAINT "reward_definition_cost_nonneg_chk" CHECK ("costPoints" >= 0);

-- Schedules: days of week are 0..6 and date ranges are ordered.
ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_days_chk" CHECK ("daysOfWeek" <@ ARRAY[0,1,2,3,4,5,6]),
  ADD CONSTRAINT "task_assignment_dates_chk" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "routine_assignment"
  ADD CONSTRAINT "routine_assignment_days_chk" CHECK ("daysOfWeek" <@ ARRAY[0,1,2,3,4,5,6]),
  ADD CONSTRAINT "routine_assignment_dates_chk" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "goal_assignment"
  ADD CONSTRAINT "goal_assignment_dates_chk" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "family"
  ADD CONSTRAINT "family_week_start_chk" CHECK ("weekStartsOn" BETWEEN 0 AND 6);

-- Reward ledger: balances never go negative and entries are never zero.
ALTER TABLE "reward_wallet"       ADD CONSTRAINT "reward_wallet_balance_nonneg_chk" CHECK ("balance" >= 0);
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_amount_nonzero_chk" CHECK ("amount" <> 0);
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_balance_nonneg_chk" CHECK ("balanceAfter" >= 0);

-- Inventory: quantities never go negative and grants are never zero.
ALTER TABLE "child_inventory_item" ADD CONSTRAINT "child_inventory_item_qty_nonneg_chk" CHECK ("quantity" >= 0);
ALTER TABLE "inventory_grant"      ADD CONSTRAINT "inventory_grant_qty_nonzero_chk"     CHECK ("quantity" <> 0);

-- Goals: at most ONE contribution per day can advance a consecutive-day streak.
CREATE UNIQUE INDEX "goal_contribution_streak_day_uq"
  ON "goal_contribution" ("goalAssignmentId", "localDate")
  WHERE "countedForStreak" = true;

-- Puzzles: a child completes a given puzzle at most once.
CREATE UNIQUE INDEX "puzzle_attempt_completed_uq"
  ON "puzzle_attempt" ("childId", "puzzleId")
  WHERE "status" = 'COMPLETED';

-- Quest objectives: progress never exceeds its target or goes negative.
ALTER TABLE "objective_progress"
  ADD CONSTRAINT "objective_progress_count_chk" CHECK ("currentCount" >= 0 AND "currentCount" <= "targetCount");

-- Child sessions must expire after they are created.
ALTER TABLE "child_session" ADD CONSTRAINT "child_session_expiry_chk" CHECK ("expiresAt" > "createdAt");
