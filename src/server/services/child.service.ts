import { hashPin, verifyPin } from "@/lib/auth/pin";
import { issueChildSession } from "@/lib/auth/child-session";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type {
  ChildSignInInput,
  CreateChildInput,
  UpdateChildProfileInput,
} from "@/lib/validation/families";
import type { ParentContext } from "@/server/policies/context";
import {
  assertFamilyScope,
  assertPermission,
  requireChildInFamily,
} from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function listChildren(db: DbClient, familyId: string) {
  return db.child.findMany({
    where: { familyId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: { credential: { select: { childId: true, lockedUntil: true } } },
  });
}

export async function listArchivedChildren(db: DbClient, familyId: string) {
  return db.child.findMany({
    where: { familyId, status: "ARCHIVED" },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

/** Rename a child or change their avatar. No other child data is collected. */
export async function updateChildProfile(
  db: DbClient,
  ctx: ParentContext,
  input: UpdateChildProfileInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageChildren");
  const child = await requireChildInFamily(db, ctx.familyId, input.childId);
  const updated = await db.child.update({
    where: { id: child.id },
    data: { displayName: input.displayName, avatarKey: input.avatarKey },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "child.update",
    entityType: "Child",
    entityId: child.id,
  });
  return updated;
}

/** Bring an archived child back. History is untouched; they must sign in again. */
export async function restoreChild(db: DbClient, ctx: ParentContext, childId: string) {
  assertPermission(ctx, "canManageChildren");
  const child = await requireChildInFamily(db, ctx.familyId, childId);
  if (child.status !== "ARCHIVED") throw AppError.invalidState("This child is not archived");
  await db.child.update({ where: { id: child.id }, data: { status: "ACTIVE" } });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "child.restore",
    entityType: "Child",
    entityId: child.id,
  });
}

export async function createChild(db: DbClient, ctx: ParentContext, input: CreateChildInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageChildren");
  const child = await db.child.create({
    data: {
      familyId: input.familyId,
      displayName: input.displayName,
      avatarKey: input.avatarKey,
      birthYear: input.birthYear,
      credential: input.pin ? { create: { pinHash: await hashPin(input.pin) } } : undefined,
    },
  });
  await recordAudit(db, {
    familyId: child.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "child.create",
    entityType: "Child",
    entityId: child.id,
  });
  return child;
}

export async function setChildPin(db: DbClient, ctx: ParentContext, childId: string, pin: string) {
  assertPermission(ctx, "canManageChildren");
  const child = await requireChildInFamily(db, ctx.familyId, childId);
  await db.childCredential.upsert({
    where: { childId: child.id },
    create: { childId: child.id, pinHash: await hashPin(pin) },
    update: { pinHash: await hashPin(pin), failedAttempts: 0, lockedUntil: null },
  });
  // A reset PIN signs the child out everywhere: whoever knew the old PIN loses access.
  await db.childSession.updateMany({
    where: { childId: child.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "child.pin.set",
    entityType: "Child",
    entityId: child.id,
  });
}

export async function archiveChild(db: DbClient, ctx: ParentContext, childId: string) {
  assertPermission(ctx, "canManageChildren");
  const child = await requireChildInFamily(db, ctx.familyId, childId);
  await db.$transaction([
    db.child.update({ where: { id: child.id }, data: { status: "ARCHIVED" } }),
    db.childSession.updateMany({
      where: { childId: child.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "child.archive",
    entityType: "Child",
    entityId: child.id,
  });
}

/** Children available on the child sign-in screen for a family code. Only names and ids. */
export async function lookupFamilyForChildSignIn(db: DbClient, familyCode: string) {
  const family = await db.family.findUnique({
    where: { childLoginCode: familyCode },
    select: {
      id: true,
      name: true,
      settings: { select: { allowChildSelfSignIn: true } },
      children: {
        where: { status: "ACTIVE", credential: { isNot: null } },
        select: { id: true, displayName: true, avatarKey: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!family || family.settings?.allowChildSelfSignIn === false) return null;
  return { id: family.id, name: family.name, children: family.children };
}

/**
 * Child sign-in with family code + PIN. Applies a per-child lockout after
 * repeated failures. Returns the raw session token for the cookie.
 */
export async function signInChild(db: DbClient, input: ChildSignInInput) {
  const family = await db.family.findUnique({
    where: { childLoginCode: input.familyCode },
    include: { settings: true },
  });
  // Uniform error to avoid revealing whether the family code exists.
  const invalid = () => AppError.unauthorized("That family code, child, or PIN is not right");
  if (!family || family.settings?.allowChildSelfSignIn === false) throw invalid();

  const credential = await db.childCredential.findFirst({
    where: { childId: input.childId, child: { familyId: family.id, status: "ACTIVE" } },
  });
  if (!credential) throw invalid();

  if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
    throw new AppError("RATE_LIMITED", "Too many tries. Ask a parent, or wait a few minutes.");
  }

  const okPin = await verifyPin(input.pin, credential.pinHash);
  if (!okPin) {
    const failedAttempts = credential.failedAttempts + 1;
    await db.childCredential.update({
      where: { childId: credential.childId },
      data: {
        failedAttempts,
        lockedUntil:
          failedAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
      },
    });
    throw invalid();
  }

  if (credential.failedAttempts > 0 || credential.lockedUntil) {
    await db.childCredential.update({
      where: { childId: credential.childId },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  const ttlMinutes = family.settings?.childSessionMinutes ?? 720;
  const { token, session } = await issueChildSession(db, {
    familyId: family.id,
    childId: credential.childId,
    ttlMinutes,
  });
  await recordAudit(db, {
    familyId: family.id,
    actorType: "CHILD",
    actorChildId: credential.childId,
    action: "child.session.start",
    entityType: "ChildSession",
    entityId: session.id,
  });
  return { token, session };
}

/** A signed-in parent starts a child session on the current device (no PIN needed). */
export async function startChildSessionAsParent(db: DbClient, ctx: ParentContext, childId: string) {
  const child = await requireChildInFamily(db, ctx.familyId, childId);
  const settings = await db.familySettings.findUnique({ where: { familyId: ctx.familyId } });
  const { token, session } = await issueChildSession(db, {
    familyId: ctx.familyId,
    childId: child.id,
    issuedByUserId: ctx.userId,
    ttlMinutes: settings?.childSessionMinutes ?? 720,
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "child.session.start",
    entityType: "ChildSession",
    entityId: session.id,
    metadata: { childId: child.id },
  });
  return { token, session };
}

export async function revokeChildSession(db: DbClient, sessionId: string) {
  await db.childSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
