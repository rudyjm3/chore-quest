-- Hand-written invariants for family_invitation (not expressible in the Prisma schema).

-- 1. Invitations can only grant GUARDIAN. OWNER is assigned at family creation and never by invite.
ALTER TABLE "family_invitation"
  ADD CONSTRAINT "family_invitation_guardian_only" CHECK ("role" = 'GUARDIAN');

-- 2. An invitation is either pending, accepted or revoked, never both accepted and revoked.
ALTER TABLE "family_invitation"
  ADD CONSTRAINT "family_invitation_single_outcome"
  CHECK (NOT ("acceptedAt" IS NOT NULL AND "revokedAt" IS NOT NULL));

-- 3. An accepted invitation records who accepted it.
ALTER TABLE "family_invitation"
  ADD CONSTRAINT "family_invitation_accepted_has_user"
  CHECK ("acceptedAt" IS NULL OR "acceptedById" IS NOT NULL);

-- 4. At most one open (neither accepted nor revoked) invitation per family and email.
--    Expiry is time-based and cannot be part of an index predicate, so the service revokes the
--    previous open invitation when re-inviting.
CREATE UNIQUE INDEX "family_invitation_one_open_per_email"
  ON "family_invitation" ("familyId", "email")
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
