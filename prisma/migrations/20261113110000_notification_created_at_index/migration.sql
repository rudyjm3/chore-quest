-- Retention job (ADR 0009) scans old notifications across families by createdAt.
CREATE INDEX "notification_createdAt_idx" ON "notification"("createdAt");
