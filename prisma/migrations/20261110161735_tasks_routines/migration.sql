-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('CHORE', 'HYGIENE', 'SCHOOL', 'PET_CARE', 'HELPING', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'SPECIFIC_DAYS');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RoutineRunStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'MISSED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- CreateTable
CREATE TABLE "task_preset" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'CHORE',
    "defaultPoints" INTEGER NOT NULL DEFAULT 5,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "presetId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'CHORE',
    "iconKey" TEXT,
    "points" INTEGER NOT NULL DEFAULT 5,
    "approvalPolicy" "ApprovalPolicy" NOT NULL DEFAULT 'PARENT_REVIEW',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignment" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "dueTime" TEXT,
    "pointsOverride" INTEGER,
    "approvalPolicyOverride" "ApprovalPolicy",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_occurrence" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "dueAt" TIMESTAMP(3),
    "pointsSnapshot" INTEGER NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_template" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_template_step" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "presetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "routine_template_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_step" (
    "id" UUID NOT NULL,
    "routineId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "routine_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_assignment" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "routineId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "windowStart" TEXT,
    "windowEnd" TEXT,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "approvalPolicy" "ApprovalPolicy" NOT NULL DEFAULT 'PARENT_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_run" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "status" "RoutineRunStatus" NOT NULL DEFAULT 'PENDING',
    "bonusPointsSnapshot" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_step_progress" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "stepId" UUID NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_step_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_preset_key_key" ON "task_preset"("key");

-- CreateIndex
CREATE INDEX "task_familyId_isArchived_idx" ON "task"("familyId", "isArchived");

-- CreateIndex
CREATE INDEX "task_assignment_familyId_childId_status_idx" ON "task_assignment"("familyId", "childId", "status");

-- CreateIndex
CREATE INDEX "task_assignment_taskId_idx" ON "task_assignment"("taskId");

-- CreateIndex
CREATE INDEX "task_occurrence_familyId_childId_localDate_idx" ON "task_occurrence"("familyId", "childId", "localDate");

-- CreateIndex
CREATE INDEX "task_occurrence_familyId_status_idx" ON "task_occurrence"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "task_occurrence_assignmentId_localDate_key" ON "task_occurrence"("assignmentId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "routine_template_key_key" ON "routine_template"("key");

-- CreateIndex
CREATE UNIQUE INDEX "routine_template_step_templateId_sortOrder_key" ON "routine_template_step"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "routine_template_step_templateId_presetId_key" ON "routine_template_step"("templateId", "presetId");

-- CreateIndex
CREATE INDEX "routine_familyId_isArchived_idx" ON "routine"("familyId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "routine_step_routineId_sortOrder_key" ON "routine_step"("routineId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "routine_step_routineId_taskId_key" ON "routine_step"("routineId", "taskId");

-- CreateIndex
CREATE INDEX "routine_assignment_familyId_childId_status_idx" ON "routine_assignment"("familyId", "childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "routine_assignment_routineId_childId_key" ON "routine_assignment"("routineId", "childId");

-- CreateIndex
CREATE INDEX "routine_run_familyId_childId_localDate_idx" ON "routine_run"("familyId", "childId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "routine_run_assignmentId_localDate_key" ON "routine_run"("assignmentId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "routine_step_progress_runId_stepId_key" ON "routine_step_progress"("runId", "stepId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "task_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "task_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_occurrence" ADD CONSTRAINT "task_occurrence_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_template_step" ADD CONSTRAINT "routine_template_step_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "routine_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_template_step" ADD CONSTRAINT "routine_template_step_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "task_preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine" ADD CONSTRAINT "routine_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_step" ADD CONSTRAINT "routine_step_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_step" ADD CONSTRAINT "routine_step_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_assignment" ADD CONSTRAINT "routine_assignment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_assignment" ADD CONSTRAINT "routine_assignment_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_assignment" ADD CONSTRAINT "routine_assignment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "routine_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_step_progress" ADD CONSTRAINT "routine_step_progress_runId_fkey" FOREIGN KEY ("runId") REFERENCES "routine_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_step_progress" ADD CONSTRAINT "routine_step_progress_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "routine_step"("id") ON DELETE CASCADE ON UPDATE CASCADE;
