-- AlterTable
ALTER TABLE "goal_assignment" ADD COLUMN     "targetOverride" INTEGER;

-- A per-assignment target must be positive (null = inherit the goal's target).
ALTER TABLE "goal_assignment"
  ADD CONSTRAINT "goal_assignment_target_override_chk"
  CHECK ("targetOverride" IS NULL OR "targetOverride" > 0);
