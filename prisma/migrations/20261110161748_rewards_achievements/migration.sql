-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('POINTS', 'COINS', 'XP');

-- CreateEnum
CREATE TYPE "RewardSourceType" AS ENUM ('ACTIVITY_COMPLETION', 'GOAL_COMPLETION', 'QUEST_REWARD', 'CHAPTER_REWARD', 'ACHIEVEMENT', 'SIDE_MISSION', 'REDEMPTION', 'PURCHASE', 'PARENT_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'FULFILLED', 'DENIED', 'CANCELLED');

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- CreateTable
CREATE TABLE "reward_wallet" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "currency" "Currency" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_ledger_entry" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" "RewardSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "description" TEXT,
    "completionId" UUID,
    "goalCompletionId" UUID,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_ledger_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_definition" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "costPoints" INTEGER NOT NULL,
    "iconKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemption" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "rewardDefinitionId" UUID NOT NULL,
    "costPoints" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" UUID,
    "ledgerEntryId" UUID,

    CONSTRAINT "reward_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_definition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "adventureKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT,
    "criteria" JSONB NOT NULL,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earned_achievement" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "completionId" UUID,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earned_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reward_wallet_childId_currency_key" ON "reward_wallet"("childId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "reward_ledger_entry_sourceKey_key" ON "reward_ledger_entry"("sourceKey");

-- CreateIndex
CREATE INDEX "reward_ledger_entry_familyId_childId_createdAt_idx" ON "reward_ledger_entry"("familyId", "childId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reward_ledger_entry_sourceType_sourceId_currency_key" ON "reward_ledger_entry"("sourceType", "sourceId", "currency");

-- CreateIndex
CREATE INDEX "reward_definition_familyId_isActive_idx" ON "reward_definition"("familyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemption_ledgerEntryId_key" ON "reward_redemption"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "reward_redemption_familyId_status_idx" ON "reward_redemption"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_definition_key_key" ON "achievement_definition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "earned_achievement_childId_achievementId_key" ON "earned_achievement"("childId", "achievementId");

-- AddForeignKey
ALTER TABLE "reward_wallet" ADD CONSTRAINT "reward_wallet_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_wallet" ADD CONSTRAINT "reward_wallet_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "activity_completion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_goalCompletionId_fkey" FOREIGN KEY ("goalCompletionId") REFERENCES "goal_completion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_ledger_entry" ADD CONSTRAINT "reward_ledger_entry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_definition" ADD CONSTRAINT "reward_definition_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemption" ADD CONSTRAINT "reward_redemption_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemption" ADD CONSTRAINT "reward_redemption_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemption" ADD CONSTRAINT "reward_redemption_rewardDefinitionId_fkey" FOREIGN KEY ("rewardDefinitionId") REFERENCES "reward_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemption" ADD CONSTRAINT "reward_redemption_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemption" ADD CONSTRAINT "reward_redemption_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "reward_ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_achievement" ADD CONSTRAINT "earned_achievement_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_achievement" ADD CONSTRAINT "earned_achievement_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_achievement" ADD CONSTRAINT "earned_achievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievement_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earned_achievement" ADD CONSTRAINT "earned_achievement_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "activity_completion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
