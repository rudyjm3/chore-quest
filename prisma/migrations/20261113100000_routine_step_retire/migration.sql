-- ADR 0011: routine steps are retired, never deleted, so progress history stays intact.
ALTER TABLE "routine_step" ADD COLUMN "retiredAt" TIMESTAMP(3);

-- Uniqueness now applies to ACTIVE steps only: a retired step must not block re-adding the same task
-- or reusing its position.
DROP INDEX "routine_step_routineId_sortOrder_key";
DROP INDEX "routine_step_routineId_taskId_key";

CREATE UNIQUE INDEX "routine_step_active_sort_key" ON "routine_step" ("routineId", "sortOrder")
  WHERE "retiredAt" IS NULL;
CREATE UNIQUE INDEX "routine_step_active_task_key" ON "routine_step" ("routineId", "taskId")
  WHERE "retiredAt" IS NULL;

CREATE INDEX "routine_step_routineId_retiredAt_idx" ON "routine_step" ("routineId", "retiredAt");
