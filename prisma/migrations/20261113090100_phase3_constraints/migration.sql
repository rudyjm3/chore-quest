-- Phase 3 hand-written constraints (Prisma Migrate cannot express CHECKs).

-- A notification has exactly one recipient: a parent user or a child, never both, never neither.
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_one_recipient_chk"
  CHECK (("recipientUserId" IS NULL) <> ("recipientChildId" IS NULL));

-- Reward stock can never go negative (null = unlimited). Reservation happens under a row lock;
-- this is the backstop that makes overselling impossible even if a code path forgets the lock.
ALTER TABLE "reward_definition"
  ADD CONSTRAINT "reward_definition_stock_nonneg_chk"
  CHECK ("stock" IS NULL OR "stock" >= 0);

-- A redemption cannot be refunded without having been debited first.
ALTER TABLE "reward_redemption"
  ADD CONSTRAINT "reward_redemption_refund_needs_debit_chk"
  CHECK ("refundEntryId" IS NULL OR "ledgerEntryId" IS NOT NULL);
