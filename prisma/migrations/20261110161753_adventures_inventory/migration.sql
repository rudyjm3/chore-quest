-- CreateEnum
CREATE TYPE "ChapterDefinitionStatus" AS ENUM ('PLAYABLE', 'PLACEHOLDER');

-- CreateEnum
CREATE TYPE "QuestKind" AS ENUM ('MAIN', 'SIDE');

-- CreateEnum
CREATE TYPE "ObjectiveType" AS ENUM ('APPROVED_ACTIVITIES', 'COMPLETE_ROUTINES', 'COMPLETE_PUZZLE', 'COLLECT_ITEMS', 'VISIT_LOCATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('RESOURCE', 'COLLECTIBLE', 'COSMETIC', 'SHIP', 'SHIP_UPGRADE', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AdventureProgressStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ChapterProgressStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestProgressStatus" AS ENUM ('LOCKED', 'ACTIVE', 'COMPLETED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "PuzzleAttemptStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventorySourceType" AS ENUM ('OBJECTIVE_PROGRESS', 'QUEST_REWARD', 'CHAPTER_REWARD', 'PUZZLE_REWARD', 'ACHIEVEMENT', 'PURCHASE', 'PARENT_GRANT', 'CONSUMED');

-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT pg_catalog.gen_random_uuid();

-- CreateTable
CREATE TABLE "adventure" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "themeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adventure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adventure_chapter" (
    "id" UUID NOT NULL,
    "adventureId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "locationName" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChapterDefinitionStatus" NOT NULL DEFAULT 'PLACEHOLDER',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adventure_chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adventure_quest" (
    "id" UUID NOT NULL,
    "chapterId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "QuestKind" NOT NULL DEFAULT 'MAIN',
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adventure_quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_objective" (
    "id" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "ObjectiveType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,

    CONSTRAINT "quest_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_definition" (
    "id" UUID NOT NULL,
    "chapterId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_definition" (
    "id" UUID NOT NULL,
    "adventureId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ItemType" NOT NULL,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "iconKey" TEXT,
    "maxQuantity" INTEGER,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_adventure_progress" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "adventureId" UUID NOT NULL,
    "currentChapterId" UUID,
    "status" "AdventureProgressStatus" NOT NULL DEFAULT 'ACTIVE',
    "state" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_adventure_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_chapter_progress" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "adventureProgressId" UUID NOT NULL,
    "chapterId" UUID NOT NULL,
    "status" "ChapterProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rewardClaimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_chapter_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_progress" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "status" "QuestProgressStatus" NOT NULL DEFAULT 'LOCKED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objective_progress" (
    "id" UUID NOT NULL,
    "questProgressId" UUID NOT NULL,
    "objectiveId" UUID NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "targetCount" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objective_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_contribution" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "objectiveProgressId" UUID NOT NULL,
    "completionId" UUID NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_attempt" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "puzzleId" UUID NOT NULL,
    "status" "PuzzleAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "attemptData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "puzzle_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_inventory_item" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "equippedAt" TIMESTAMP(3),
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_grant" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sourceType" "InventorySourceType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adventure_key_key" ON "adventure"("key");

-- CreateIndex
CREATE UNIQUE INDEX "adventure_chapter_adventureId_key_key" ON "adventure_chapter"("adventureId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "adventure_chapter_adventureId_sortOrder_key" ON "adventure_chapter"("adventureId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "adventure_quest_chapterId_key_key" ON "adventure_quest"("chapterId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "quest_objective_questId_key_key" ON "quest_objective"("questId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_definition_chapterId_key_key" ON "puzzle_definition"("chapterId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "item_definition_key_key" ON "item_definition"("key");

-- CreateIndex
CREATE INDEX "item_definition_adventureId_type_idx" ON "item_definition"("adventureId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "child_adventure_progress_childId_adventureId_key" ON "child_adventure_progress"("childId", "adventureId");

-- CreateIndex
CREATE UNIQUE INDEX "child_chapter_progress_childId_chapterId_key" ON "child_chapter_progress"("childId", "chapterId");

-- CreateIndex
CREATE INDEX "quest_progress_familyId_childId_status_idx" ON "quest_progress"("familyId", "childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quest_progress_childId_questId_key" ON "quest_progress"("childId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "objective_progress_questProgressId_objectiveId_key" ON "objective_progress"("questProgressId", "objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "quest_contribution_objectiveProgressId_completionId_key" ON "quest_contribution"("objectiveProgressId", "completionId");

-- CreateIndex
CREATE INDEX "puzzle_attempt_childId_puzzleId_idx" ON "puzzle_attempt"("childId", "puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "child_inventory_item_childId_itemId_key" ON "child_inventory_item"("childId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_grant_sourceKey_key" ON "inventory_grant"("sourceKey");

-- CreateIndex
CREATE INDEX "inventory_grant_childId_itemId_idx" ON "inventory_grant"("childId", "itemId");

-- AddForeignKey
ALTER TABLE "adventure_chapter" ADD CONSTRAINT "adventure_chapter_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adventure_quest" ADD CONSTRAINT "adventure_quest_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "adventure_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_objective" ADD CONSTRAINT "quest_objective_questId_fkey" FOREIGN KEY ("questId") REFERENCES "adventure_quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_definition" ADD CONSTRAINT "puzzle_definition_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "adventure_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_definition" ADD CONSTRAINT "item_definition_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_adventure_progress" ADD CONSTRAINT "child_adventure_progress_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_adventure_progress" ADD CONSTRAINT "child_adventure_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_adventure_progress" ADD CONSTRAINT "child_adventure_progress_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_chapter_progress" ADD CONSTRAINT "child_chapter_progress_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_chapter_progress" ADD CONSTRAINT "child_chapter_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_chapter_progress" ADD CONSTRAINT "child_chapter_progress_adventureProgressId_fkey" FOREIGN KEY ("adventureProgressId") REFERENCES "child_adventure_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_chapter_progress" ADD CONSTRAINT "child_chapter_progress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "adventure_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "adventure_quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_progress" ADD CONSTRAINT "objective_progress_questProgressId_fkey" FOREIGN KEY ("questProgressId") REFERENCES "quest_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_progress" ADD CONSTRAINT "objective_progress_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "quest_objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_contribution" ADD CONSTRAINT "quest_contribution_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_contribution" ADD CONSTRAINT "quest_contribution_objectiveProgressId_fkey" FOREIGN KEY ("objectiveProgressId") REFERENCES "objective_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_contribution" ADD CONSTRAINT "quest_contribution_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "activity_completion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_attempt" ADD CONSTRAINT "puzzle_attempt_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_attempt" ADD CONSTRAINT "puzzle_attempt_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_attempt" ADD CONSTRAINT "puzzle_attempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzle_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_inventory_item" ADD CONSTRAINT "child_inventory_item_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_inventory_item" ADD CONSTRAINT "child_inventory_item_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_inventory_item" ADD CONSTRAINT "child_inventory_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_grant" ADD CONSTRAINT "inventory_grant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_grant" ADD CONSTRAINT "inventory_grant_childId_fkey" FOREIGN KEY ("childId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_grant" ADD CONSTRAINT "inventory_grant_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
