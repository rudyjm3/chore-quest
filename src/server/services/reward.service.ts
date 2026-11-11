import type { Currency, RewardSourceType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { applyLedgerAmount } from "@/features/rewards/calculations";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { sourceKeys } from "@/lib/utils/source-keys";
import type { ParentAdjustmentInput } from "@/lib/validation/rewards";
import type { ParentContext } from "@/server/policies/context";
import {
  assertFamilyScope,
  assertPermission,
  requireChildInFamily,
} from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";

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

export async function createRewardDefinition(
  db: DbClient,
  ctx: ParentContext,
  input: {
    familyId: string;
    title: string;
    description?: string;
    costPoints: number;
    iconKey?: string;
  },
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canAdjustRewards");
  return db.rewardDefinition.create({ data: input });
}

/** Child asks to redeem a reward. Points are only debited when a parent approves. */
export async function requestRedemption(
  db: DbClient,
  childId: string,
  familyId: string,
  rewardDefinitionId: string,
) {
  const reward = await db.rewardDefinition.findFirst({
    where: { id: rewardDefinitionId, familyId, isActive: true },
  });
  if (!reward) throw AppError.notFound("Reward");
  const wallet = await db.rewardWallet.findUnique({
    where: { childId_currency: { childId, currency: "POINTS" } },
  });
  if ((wallet?.balance ?? 0) < reward.costPoints) {
    throw AppError.invalidState("Not enough points for this reward yet");
  }
  return db.rewardRedemption.create({
    data: { familyId, childId, rewardDefinitionId: reward.id, costPoints: reward.costPoints },
  });
}

export async function resolveRedemption(
  db: DbClient,
  ctx: ParentContext,
  redemptionId: string,
  decision: "APPROVED" | "DENIED" | "FULFILLED",
) {
  assertPermission(ctx, "canAdjustRewards");
  return db.$transaction(async (tx) => {
    const redemption = await tx.rewardRedemption.findFirst({
      where: { id: redemptionId, familyId: ctx.familyId },
    });
    if (!redemption) throw AppError.notFound("Redemption");
    await lockChildRow(tx, redemption.childId);

    if (decision === "DENIED") {
      if (redemption.status !== "REQUESTED")
        throw AppError.invalidState("Redemption already resolved");
      return tx.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: "DENIED", resolvedAt: new Date(), resolvedByUserId: ctx.userId },
      });
    }
    if (decision === "FULFILLED") {
      if (redemption.status !== "APPROVED")
        throw AppError.invalidState("Approve the redemption first");
      return tx.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: "FULFILLED" },
      });
    }
    if (redemption.status !== "REQUESTED")
      throw AppError.invalidState("Redemption already resolved");

    const { entry } = await postLedgerEntry(tx, {
      familyId: ctx.familyId,
      childId: redemption.childId,
      currency: "POINTS",
      amount: -redemption.costPoints,
      sourceType: "REDEMPTION",
      sourceId: redemption.id,
      sourceKey: sourceKeys.redemption(redemption.id),
      description: "Reward redemption",
      createdByUserId: ctx.userId,
    });
    const updated = await tx.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: "APPROVED",
        resolvedAt: new Date(),
        resolvedByUserId: ctx.userId,
        ledgerEntryId: entry.id,
      },
    });
    await recordAudit(tx, {
      familyId: ctx.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: "reward.redemption.approve",
      entityType: "RewardRedemption",
      entityId: updated.id,
      metadata: { costPoints: redemption.costPoints },
    });
    return updated;
  });
}
