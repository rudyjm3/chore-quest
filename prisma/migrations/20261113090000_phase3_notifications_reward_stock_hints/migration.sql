-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SUBMISSION_PENDING', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED', 'REDEMPTION_REQUESTED', 'REDEMPTION_RESOLVED');

-- AlterEnum
ALTER TYPE "RewardSourceType" ADD VALUE 'REDEMPTION_REFUND';

-- AlterTable
ALTER TABLE "achievement_definition" ADD COLUMN     "hint" TEXT;

-- AlterTable
ALTER TABLE "reward_definition" ADD COLUMN     "stock" INTEGER;

-- AlterTable
ALTER TABLE "reward_redemption" ADD COLUMN     "refundEntryId" UUID,
ADD COLUMN     "resolutionNote" TEXT;

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "recipientUserId" UUID,
    "recipientChildId" UUID,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_familyId_recipientUserId_createdAt_id_idx" ON "notification"("familyId", "recipientUserId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notification_familyId_recipientChildId_createdAt_id_idx" ON "notification"("familyId", "recipientChildId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "notification_familyId_recipientUserId_readAt_idx" ON "notification"("familyId", "recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "notification_familyId_recipientChildId_readAt_idx" ON "notification"("familyId", "recipientChildId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipientUserId_dedupeKey_key" ON "notification"("recipientUserId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipientChildId_dedupeKey_key" ON "notification"("recipientChildId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemption_refundEntryId_key" ON "reward_redemption"("refundEntryId");

-- CreateIndex
CREATE INDEX "reward_redemption_familyId_childId_requestedAt_idx" ON "reward_redemption"("familyId", "childId", "requestedAt");

-- AddForeignKey
ALTER TABLE "reward_redemption" ADD CONSTRAINT "reward_redemption_refundEntryId_fkey" FOREIGN KEY ("refundEntryId") REFERENCES "reward_ledger_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientChildId_fkey" FOREIGN KEY ("recipientChildId") REFERENCES "child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

