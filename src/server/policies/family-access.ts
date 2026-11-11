import type { FamilyRole } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

import type { ChildContext, ParentContext } from "./context";

/**
 * Pure authorization helpers. They know nothing about HTTP or Next.js so they
 * can be unit tested and reused by actions, route handlers and jobs.
 */

export type Actor = ParentContext | ChildContext;

/** Every household-scoped operation must pass through this check. */
export function assertFamilyScope(actor: Actor, familyId: string): void {
  if (actor.familyId !== familyId) {
    throw AppError.forbidden("This record belongs to another family");
  }
}

export function assertParent(actor: Actor): asserts actor is ParentContext {
  if (actor.kind !== "parent") throw AppError.forbidden("Parent access required");
}

export function assertChild(actor: Actor): asserts actor is ChildContext {
  if (actor.kind !== "child") throw AppError.forbidden("Child access required");
}

/** A child may only act on their own records. */
export function assertOwnChild(actor: ChildContext, childId: string): void {
  if (actor.childId !== childId)
    throw AppError.forbidden("You can only change your own activities");
}

export const parentPermissions = {
  canManageFamily: (role: FamilyRole) => role === "OWNER",
  canManageMembers: (role: FamilyRole) => role === "OWNER",
  canManageChildren: (role: FamilyRole) => role === "OWNER" || role === "GUARDIAN",
  canManageTasks: (role: FamilyRole) => role === "OWNER" || role === "GUARDIAN",
  canApprove: (role: FamilyRole) => role === "OWNER" || role === "GUARDIAN",
  canAdjustRewards: (role: FamilyRole) => role === "OWNER" || role === "GUARDIAN",
  canDeleteFamily: (role: FamilyRole) => role === "OWNER",
} as const;

export function assertPermission(
  actor: ParentContext,
  permission: keyof typeof parentPermissions,
): void {
  if (!parentPermissions[permission](actor.role)) {
    throw AppError.forbidden(`Your role (${actor.role}) cannot perform this action`);
  }
}

/**
 * Load a child and verify it belongs to the actor's family. Returns the child
 * so callers do not need a second query.
 */
export async function requireChildInFamily(db: DbClient, familyId: string, childId: string) {
  const child = await db.child.findFirst({ where: { id: childId, familyId } });
  if (!child) throw AppError.notFound("Child");
  return child;
}
