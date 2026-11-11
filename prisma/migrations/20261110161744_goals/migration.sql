-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('TOTAL_COUNT', 'WEEKLY_COUNT', 'CONSECUTIVE_DAYS', 'ROUTINE_CONSISTENCY', 'CUSTOM_MILESTONE');

-- CreateEnum
CREATE TYPE "GoalRecurrence" AS ENUM ('NONE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "GoalAssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- CreateTable
CREATE TABLE "goal" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GoalType" NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "recurrence" "GoalRecurrence" NOT NULL DEFAULT 'NONE',
    "filterTaskId" UUID,
    "filterRoutineId" UUID,
    "filterCategory" "TaskCategory",
    "filterSourceType" "ActivitySourceType",
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "rewardDescription" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_assignment" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "periodKey" TEXT NOT NULL DEFAULT '',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "GoalAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "progressCount" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastContributionDate" DATE,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contribution" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "goalAssignmentId" UUID NOT NULL,
    "completionId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "countedForStreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_completion" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "goalAssignmentId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "goal_completion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_familyId_isArchived_idx" ON "goal"("familyId", "isArchived");

-- CreateIndex
CREATE INDEX "goal_assignment_familyId_childId_status_idx" ON "goal_assignment"("familyId", "childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "goal_assignment_goalId_childId_periodKey_key" ON "goal_assignment"("goalId", "childId", "periodKey");

-- CreateIndex
CREATE INDEX "goal_contribution_goalAssignmentId_localDate_idx" ON "goal_contribution"("goalAssignmentId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "goal_contribution_goalAssignmentId_completionId_key" ON "goal_contribution"("goalAssignmentId", "completionId");

-- CreateIndex
CREATE UNIQUE INDEX "goal_completion_goalAssignmentId_key" ON "goal_completion"("goalAssignmentId");

-- CreateIndex
CREATE INDEX "goal_completion_familyId_childId_idx" ON "goal_completion"("familyId", "childId");

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_assignment" ADD CONSTRAINT "goal_assignment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_assignment" ADD CONSTRAINT "goal_assignment_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_assignment" ADD CONSTRAINT "goal_assignment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_goalAssignmentId_fkey" FOREIGN KEY ("goalAssignmentId") REFERENCES "goal_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contribution" ADD CONSTRAINT "goal_contribution_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "activity_completion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_completion" ADD CONSTRAINT "goal_completion_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_completion" ADD CONSTRAINT "goal_completion_goalAssignmentId_fkey" FOREIGN KEY ("goalAssignmentId") REFERENCES "goal_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_completion" ADD CONSTRAINT "goal_completion_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
