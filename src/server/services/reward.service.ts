import type { Currency, RewardSourceType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { applyLedgerAmount } from "@/features/rewards/calculations";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { sourceKeys } from "@/lib/utils/source-keys";
import type {
  CreateRewardInput,
  ParentAdjustmentInput,
  UpdateRewardInput,
} from "@/lib/validation/rewards";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import {
  assertFamilyScope,
  assertPermission,
  requireChildInFamily,
} from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";
import { notifyChild, notifyParents } from "./notification.service";

export interface LedgerCreditInput {
  familyId: string;
  childId: string;
  currency: Currency;
  amount: number;
  sourceType: RewardSourceType;
  sourceId: string;
  sourceKey: string;
  description?: string;
  completionId?: string | null;
  goalCompletionId?: string | null;
  createdByUserId?: string | null;
}

/**
 * Append a ledger entry and move the wallet balance in one step.
 *
 * Idempotent on `sourceKey`: if an entry with the same key exists, nothing is
 * written and `created` is false. The caller MUST hold the child row lock
 * (`lockChildRow`) so concurrent writers for the same child are serialized.
 */
export async function postLedgerEntry(tx: Prisma.TransactionClient, input: LedgerCreditInput) {
  const existing = await tx.rewardLedgerEntry.findUnique({ where: { sourceKey: input.sourceKey } });
  if (existing) return { entry: existing, created: false as const };

  const wallet = await tx.rewardWallet.upsert({
    where: { childId_currency: { childId: input.childId, currency: input.currency } },
    create: {
      familyId: input.familyId,
      childId: input.childId,
      currency: input.currency,
      balance: 0,
    },
    update: {},
  });
  const balanceAfter = applyLedgerAmount(wallet.balance, input.amount);

  const entry = await tx.rewardLedgerEntry.create({
    data: {
      familyId: input.familyId,
      childId: input.childId,
      currency: input.currency,
      amount: input.amount,
      balanceAfter,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      description: input.description,
      completionId: input.completionId ?? null,
      goalCompletionId: input.goalCompletionId ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
  await tx.rewardWallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
  return { entry, created: true as const };
}

export async function getWallets(db: DbClient, childId: string) {
  const wallets = await db.rewardWallet.findMany({ where: { childId } });
  const byCurrency: Record<Currency, number> = { POINTS: 0, COINS: 0, XP: 0 };
  for (const w of wallets) byCurrency[w.currency] = w.balance;
  return byCurrency;
}

export async function listLedger(db: DbClient, childId: string, limit = 25, cursor?: string) {
  const entries = await db.rewardLedgerEntry.findMany({
    where: { childId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = entries.length > limit;
  const page = hasMore ? entries.slice(0, limit) : entries;
  return { entries: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/** Parent-initiated manual adjustment, idempotent on the client-supplied key. */
export async function parentAdjustment(
  db: DbClient,
  ctx: ParentContext,
  input: ParentAdjustmentInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canAdjustRewards");
  await requireChildInFamily(db, ctx.familyId, input.childId);

  return db.$transaction(async (tx) => {
    await lockChildRow(tx, input.childId);
    const result = await postLedgerEntry(tx, {
      familyId: ctx.familyId,
      childId: input.childId,
      currency: input.currency,
      amount: input.amount,
      sourceType: "PARENT_ADJUSTMENT",
      sourceId: input.idempotencyKey,
      sourceKey: sourceKeys.parentAdjustment(input.idempotencyKey, input.currency),
      description: input.reason,
      createdByUserId: ctx.userId,
    });
    if (result.created) {
      await recordAudit(tx, {
        familyId: ctx.familyId,
        actorType: "PARENT",
        actorUserId: ctx.userId,
        action: "reward.adjust",
        entityType: "RewardLedgerEntry",
        entityId: result.entry.id,
        metadata: { currency: input.currency, amount: input.amount, reason: input.reason },
      });
    }
    return result;
  });
}

// ---------------------------------------------------------------------------
// Reward catalogue
// ---------------------------------------------------------------------------

export async function createRewardDefinition(
  db: DbClient,
  ctx: ParentContext,
  input: CreateRewardInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canAdjustRewards");
  const reward = await db.rewardDefinition.create({
    data: {
      familyId: input.familyId,
      title: input.title,
      description: input.description,
      costPoints: input.costPoints,
      iconKey: input.iconKey,
      stock: input.stock ?? null,
    },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "reward.create",
    entityType: "RewardDefinition",
    entityId: reward.id,
    metadata: { title: reward.title, costPoints: reward.costPoints, stock: reward.stock },
  });
  return reward;
}

/**
 * Edit a reward. The price only affects future requests: an open redemption keeps the
 * `costPoints` snapshot taken when it was requested.
 */
export async function updateRewardDefinition(
  db: DbClient,
  ctx: ParentContext,
  input: UpdateRewardInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canAdjustRewards");
  return db.$transaction(async (tx) => {
    await lockRewardRow(tx, input.rewardId);
    const existing = await tx.rewardDefinition.findFirst({
      where: { id: input.rewardId, familyId: ctx.familyId },
    });
    if (!existing) throw AppError.notFound("Reward");
    const reward = await tx.rewardDefinition.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description ?? null,
        costPoints: input.costPoints,
        iconKey: input.iconKey ?? null,
        stock: input.stock ?? null,
      },
    });
    await recordAudit(tx, {
      familyId: ctx.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: "reward.update",
      entityType: "RewardDefinition",
      entityId: reward.id,
      metadata: {
        title: reward.title,
        costPoints: reward.costPoints,
        previousCostPoints: existing.costPoints,
        stock: reward.stock,
      },
    });
    return reward;
  });
}

export async function setRewardActive(
  db: DbClient,
  ctx: ParentContext,
  input: { familyId: string; rewardId: string; active: boolean },
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canAdjustRewards");
  const existing = await db.rewardDefinition.findFirst({
    where: { id: input.rewardId, familyId: ctx.familyId },
  });
  if (!existing) throw AppError.notFound("Reward");
  if (existing.isActive === input.active) return existing;
  const reward = await db.rewardDefinition.update({
    where: { id: existing.id },
    data: { isActive: input.active },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: input.active ? "reward.restore" : "reward.archive",
    entityType: "RewardDefinition",
    entityId: reward.id,
    metadata: { title: reward.title },
  });
  return reward;
}

export async function listRewardDefinitions(
  db: DbClient,
  familyId: string,
  options: { includeArchived?: boolean } = {},
) {
  return db.rewardDefinition.findMany({
    where: { familyId, ...(options.includeArchived ? {} : { isActive: true }) },
    orderBy: [{ isActive: "desc" }, { costPoints: "asc" }, { title: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Redemptions (ADR 0010: reserve at request, refund on denial)
// ---------------------------------------------------------------------------

async function lockRewardRow(tx: Prisma.TransactionClient, rewardId: string) {
  await tx.$queryRaw`SELECT id FROM "reward_definition" WHERE id = ${rewardId}::uuid FOR UPDATE`;
}

/**
 * Child asks to spend points on a reward. The points are debited (reserved) and one unit of
 * stock is taken immediately, so a child cannot request more than they can pay for and two
 * children cannot claim the last unit. A denial gives both back. Locks are always taken in the
 * order child → reward so concurrent requests serialize without deadlocking.
 */
export async function requestRedemption(
  db: DbClient,
  ctx: ChildContext,
  rewardDefinitionId: string,
) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, ctx.childId);
    await lockRewardRow(tx, rewardDefinitionId);
    const reward = await tx.rewardDefinition.findFirst({
      where: { id: rewardDefinitionId, familyId: ctx.familyId, isActive: true },
    });
    if (!reward) throw AppError.notFound("Reward");
    if (reward.stock !== null && reward.stock <= 0) {
      throw AppError.invalidState("This reward is all gone for now");
    }
    const wallet = await tx.rewardWallet.findUnique({
      where: { childId_currency: { childId: ctx.childId, currency: "POINTS" } },
    });
    if ((wallet?.balance ?? 0) < reward.costPoints) {
      throw AppError.invalidState("Not enough points for this reward yet");
    }

    const redemption = await tx.rewardRedemption.create({
      data: {
        familyId: ctx.familyId,
        childId: ctx.childId,
        rewardDefinitionId: reward.id,
        costPoints: reward.costPoints,
      },
    });
    let ledgerEntryId: string | null = null;
    if (reward.costPoints > 0) {
      const { entry } = await postLedgerEntry(tx, {
        familyId: ctx.familyId,
        childId: ctx.childId,
        currency: "POINTS",
        amount: -reward.costPoints,
        sourceType: "REDEMPTION",
        sourceId: redemption.id,
        sourceKey: sourceKeys.redemption(redemption.id),
        description: `Reserved for “${reward.title}”`,
      });
      ledgerEntryId = entry.id;
    }
    if (reward.stock !== null) {
      await tx.rewardDefinition.update({
        where: { id: reward.id },
        data: { stock: { decrement: 1 } },
      });
    }
    const updated = await tx.rewardRedemption.update({
      where: { id: redemption.id },
      data: { ledgerEntryId },
    });
    await notifyParents(tx, ctx.familyId, {
      kind: "REDEMPTION_REQUESTED",
      title: `${ctx.childName} asked for “${reward.title}”`,
      body: `${reward.costPoints} points are reserved until you decide.`,
      entityType: "RewardRedemption",
      entityId: redemption.id,
      dedupeKey: `redemption:${redemption.id}:requested`,
    });
    await recordAudit(tx, {
      familyId: ctx.familyId,
      actorType: "CHILD",
      actorChildId: ctx.childId,
      action: "reward.redemption.request",
      entityType: "RewardRedemption",
      entityId: redemption.id,
      metadata: { title: reward.title, costPoints: reward.costPoints },
    });
    return updated;
  });
}

export type RedemptionDecision = "APPROVED" | "DENIED" | "FULFILLED";

const DECISION_RESULT = {
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  FULFILLED: "FULFILLED",
} as const;

/**
 * Parent resolves a redemption. The row is re-read after the child lock is held, so two parents
 * resolving at once cannot both act on a stale REQUESTED status. Repeating the same decision is a
 * no-op that returns the resolved row; a conflicting decision is rejected.
 */
export async function resolveRedemption(
  db: DbClient,
  ctx: ParentContext,
  input: { redemptionId: string; decision: RedemptionDecision; note?: string },
) {
  assertPermission(ctx, "canAdjustRewards");
  const found = await db.rewardRedemption.findFirst({
    where: { id: input.redemptionId, familyId: ctx.familyId },
    select: { childId: true, rewardDefinitionId: true },
  });
  if (!found) throw AppError.notFound("Redemption");

  return db.$transaction(async (tx) => {
    await lockChildRow(tx, found.childId);
    await lockRewardRow(tx, found.rewardDefinitionId);
    const redemption = await tx.rewardRedemption.findFirst({
      where: { id: input.redemptionId, familyId: ctx.familyId },
      include: { rewardDefinition: { select: { title: true, stock: true } } },
    });
    if (!redemption) throw AppError.notFound("Redemption");
    const title = redemption.rewardDefinition.title;
    const target = DECISION_RESULT[input.decision];

    if (redemption.status === target) return redemption; // same decision again: idempotent
    const allowedFrom = input.decision === "FULFILLED" ? "APPROVED" : "REQUESTED";
    if (redemption.status !== allowedFrom) {
      throw AppError.invalidState(
        input.decision === "FULFILLED"
          ? "Approve the redemption first"
          : "Redemption already resolved",
      );
    }

    const now = new Date();
    let refundEntryId: string | null = null;
    if (input.decision === "DENIED") {
      if (redemption.costPoints > 0) {
        const { entry } = await postLedgerEntry(tx, {
          familyId: ctx.familyId,
          childId: redemption.childId,
          currency: "POINTS",
          amount: redemption.costPoints,
          sourceType: "REDEMPTION_REFUND",
          sourceId: redemption.id,
          sourceKey: sourceKeys.redemptionRefund(redemption.id),
          description: `Refund for “${title}”`,
          createdByUserId: ctx.userId,
        });
        refundEntryId = entry.id;
      }
      if (redemption.rewardDefinition.stock !== null) {
        await tx.rewardDefinition.update({
          where: { id: redemption.rewardDefinitionId },
          data: { stock: { increment: 1 } },
        });
      }
    }

    const updated = await tx.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: target,
        resolutionNote: input.note ?? redemption.resolutionNote,
        ...(input.decision === "FULFILLED"
          ? {}
          : { resolvedAt: now, resolvedByUserId: ctx.userId }),
        ...(refundEntryId ? { refundEntryId } : {}),
      },
    });
    await recordAudit(tx, {
      familyId: ctx.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: `reward.redemption.${input.decision === "DENIED" ? "deny" : input.decision === "APPROVED" ? "approve" : "fulfill"}`,
      entityType: "RewardRedemption",
      entityId: updated.id,
      metadata: { title, costPoints: redemption.costPoints, note: input.note },
    });
    await notifyChild(tx, ctx.familyId, redemption.childId, {
      kind: "REDEMPTION_RESOLVED",
      title:
        input.decision === "DENIED"
          ? `“${title}” was not approved`
          : input.decision === "APPROVED"
            ? `“${title}” was approved!`
            : `“${title}” is ready — enjoy!`,
      body:
        input.decision === "DENIED"
          ? `Your ${redemption.costPoints} points are back.${input.note ? ` ${input.note}` : ""}`
          : input.note,
      entityType: "RewardRedemption",
      entityId: updated.id,
      dedupeKey: `redemption:${updated.id}:${input.decision.toLowerCase()}`,
    });
    return updated;
  });
}

export async function listRedemptionsForFamily(
  db: DbClient,
  familyId: string,
  options: { statuses?: Array<"REQUESTED" | "APPROVED" | "FULFILLED" | "DENIED">; limit?: number },
) {
  return db.rewardRedemption.findMany({
    where: { familyId, ...(options.statuses ? { status: { in: options.statuses } } : {}) },
    include: {
      child: { select: { id: true, displayName: true } },
      rewardDefinition: { select: { title: true } },
    },
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    take: options.limit ?? 50,
  });
}

/** A child's own redemptions only (scoped by familyId and childId). */
export async function listRedemptionsForChild(db: DbClient, ctx: ChildContext, limit = 20) {
  return db.rewardRedemption.findMany({
    where: { familyId: ctx.familyId, childId: ctx.childId },
    include: { rewardDefinition: { select: { title: true } } },
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
    take: limit,
  });
}
