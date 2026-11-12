import { createHash, randomBytes } from "node:crypto";

import type { DbClient } from "@/lib/db/prisma";
import type { EmailSender } from "@/lib/email";
import { guardianInviteMessage } from "@/lib/email/templates";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logging";
import type { ParentContext } from "@/server/policies/context";
import { assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";

export const INVITATION_TTL_DAYS = 7;
export const MAX_OPEN_INVITATIONS = 10;

/** Only this hash is stored; the raw token lives in the emailed/copied link. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function invitationUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/invite/${token}`;
}

/**
 * Invite another adult (GUARDIAN) by email. OWNER only. Re-inviting the same address revokes the
 * previous open invitation (so "resend" works and only the newest link is valid). The link is
 * returned once so the owner can share it by hand if delivery fails or no provider is configured.
 */
export async function createInvitation(
  db: DbClient,
  ctx: ParentContext,
  params: { email: string; appUrl: string; sender: EmailSender; now?: Date },
) {
  assertPermission(ctx, "canManageMembers");
  const now = params.now ?? new Date();
  const email = normalizeEmail(params.email);

  const existingMember = await db.familyMember.findFirst({
    where: { familyId: ctx.familyId, status: "ACTIVE", user: { email } },
    select: { id: true },
  });
  if (existingMember) throw AppError.conflict("That person is already in your family");

  const open = await db.familyInvitation.count({
    where: { familyId: ctx.familyId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
  });
  if (open >= MAX_OPEN_INVITATIONS) {
    throw new AppError("RATE_LIMITED", "Too many pending invitations. Revoke some first.");
  }

  const token = generateInvitationToken();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000);
  const invitation = await db.$transaction(async (tx) => {
    await tx.familyInvitation.updateMany({
      where: { familyId: ctx.familyId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const created = await tx.familyInvitation.create({
      data: {
        familyId: ctx.familyId,
        email,
        tokenHash: hashInvitationToken(token),
        invitedById: ctx.userId,
        expiresAt,
      },
    });
    await recordAudit(tx, {
      familyId: ctx.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: "family.invitation.create",
      entityType: "FamilyInvitation",
      entityId: created.id,
    });
    return created;
  });

  const url = invitationUrl(params.appUrl, token);
  let emailSent = true;
  try {
    await params.sender.send(
      guardianInviteMessage({
        to: email,
        familyName: ctx.familyName,
        inviterName: ctx.userName,
        url,
        expiresAt,
      }),
    );
  } catch (error) {
    emailSent = false;
    log.error("invitation.email_failed", {
      invitationId: invitation.id,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  return { invitation, url, emailSent };
}

/** Pending invitations for the family (OWNER only). */
export async function listOpenInvitations(db: DbClient, ctx: ParentContext, now = new Date()) {
  assertPermission(ctx, "canManageMembers");
  const rows = await db.familyInvitation.findMany({
    where: { familyId: ctx.familyId, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, email: true, createdAt: true, expiresAt: true },
  });
  return rows.map((row) => ({ ...row, expired: row.expiresAt <= now }));
}

export async function revokeInvitation(db: DbClient, ctx: ParentContext, invitationId: string) {
  assertPermission(ctx, "canManageMembers");
  const result = await db.familyInvitation.updateMany({
    where: { id: invitationId, familyId: ctx.familyId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw AppError.notFound("Invitation");
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "family.invitation.revoke",
    entityType: "FamilyInvitation",
    entityId: invitationId,
  });
}

/**
 * What the accept page may show before sign-in: the family name only. Unknown, used, revoked and
 * expired tokens are indistinguishable (null) so the endpoint reveals nothing about them.
 */
export async function previewInvitation(db: DbClient, token: string, now = new Date()) {
  const invitation = await db.familyInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { family: { select: { name: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
    return null;
  }
  return { familyName: invitation.family.name };
}

/**
 * Accept an invitation as the signed-in user. Single use: the invitation row is locked, so two
 * concurrent accepts cannot both succeed. The user's email must match the invited address.
 */
export async function acceptInvitation(
  db: DbClient,
  params: { userId: string; userEmail: string; token: string; now?: Date },
) {
  const now = params.now ?? new Date();
  const tokenHash = hashInvitationToken(params.token);
  const invalid = () => AppError.notFound("Invitation");

  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "family_invitation" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    if (locked.length === 0) throw invalid();
    const invitation = await tx.familyInvitation.findUniqueOrThrow({ where: { id: locked[0].id } });
    if (invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
      throw invalid();
    }
    if (normalizeEmail(params.userEmail) !== invitation.email) {
      throw AppError.forbidden("This invitation was sent to a different email address");
    }

    const membership = await tx.familyMember.findUnique({
      where: { familyId_userId: { familyId: invitation.familyId, userId: params.userId } },
    });
    if (!membership) {
      await tx.familyMember.create({
        data: { familyId: invitation.familyId, userId: params.userId, role: "GUARDIAN" },
      });
    } else if (membership.status !== "ACTIVE") {
      await tx.familyMember.update({
        where: { id: membership.id },
        data: { status: "ACTIVE", role: "GUARDIAN" },
      });
    }
    await tx.familyInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now, acceptedById: params.userId },
    });
    await recordAudit(tx, {
      familyId: invitation.familyId,
      actorType: "PARENT",
      actorUserId: params.userId,
      action: "family.invitation.accept",
      entityType: "FamilyInvitation",
      entityId: invitation.id,
    });
    return { familyId: invitation.familyId };
  });
}

/** Remove a guardian from the household (OWNER only; the owner cannot be removed). */
export async function removeGuardian(db: DbClient, ctx: ParentContext, memberId: string) {
  assertPermission(ctx, "canManageMembers");
  const member = await db.familyMember.findFirst({
    where: { id: memberId, familyId: ctx.familyId },
  });
  if (!member) throw AppError.notFound("Family member");
  if (member.role === "OWNER") throw AppError.invalidState("The family owner cannot be removed");
  await db.familyMember.update({ where: { id: member.id }, data: { status: "REMOVED" } });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "family.member.remove",
    entityType: "FamilyMember",
    entityId: member.id,
  });
}
