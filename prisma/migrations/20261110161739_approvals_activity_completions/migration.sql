-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivitySourceType" AS ENUM ('TASK_OCCURRENCE', 'ROUTINE_RUN');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- CreateTable
CREATE TABLE "task_submission" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_review" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "reviewerUserId" UUID,
    "decision" "ReviewDecision" NOT NULL,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_completion" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "sourceType" "ActivitySourceType" NOT NULL,
    "taskOccurrenceId" UUID,
    "routineRunId" UUID,
    "localDate" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" UUID,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "taskId" UUID,
    "taskCategory" "TaskCategory",
    "routineId" UUID,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_completion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_submission_occurrenceId_key" ON "task_submission"("occurrenceId");

-- CreateIndex
CREATE INDEX "task_submission_familyId_status_idx" ON "task_submission"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "parent_review_submissionId_key" ON "parent_review"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_completion_taskOccurrenceId_key" ON "activity_completion"("taskOccurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_completion_routineRunId_key" ON "activity_completion"("routineRunId");

-- CreateIndex
CREATE INDEX "activity_completion_familyId_childId_localDate_idx" ON "activity_completion"("familyId", "childId", "localDate");

-- CreateIndex
CREATE INDEX "activity_completion_processingStatus_idx" ON "activity_completion"("processingStatus");

-- AddForeignKey
ALTER TABLE "task_submission" ADD CONSTRAINT "task_submission_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submission" ADD CONSTRAINT "task_submission_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "task_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_submission" ADD CONSTRAINT "task_submission_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_review" ADD CONSTRAINT "parent_review_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_review" ADD CONSTRAINT "parent_review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "task_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_review" ADD CONSTRAINT "parent_review_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_completion" ADD CONSTRAINT "activity_completion_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_completion" ADD CONSTRAINT "activity_completion_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_completion" ADD CONSTRAINT "activity_completion_taskOccurrenceId_fkey" FOREIGN KEY ("taskOccurrenceId") REFERENCES "task_occurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_completion" ADD CONSTRAINT "activity_completion_routineRunId_fkey" FOREIGN KEY ("routineRunId") REFERENCES "routine_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
