import type { Prisma } from "@/generated/prisma/client";
import type { InventorySourceType } from "@/generated/prisma/enums";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { sourceKeys } from "@/lib/utils/source-keys";

import { postLedgerEntry } from "./reward.service";

export interface GrantItemInput {
  familyId: string;
  childId: string;
  itemKey: string;
  quantity: number;
  sourceType: InventorySourceType;
  sourceKey: string;
}

/**
 * Grant (or consume, with negative quantity) an item. Idempotent on sourceKey.
 * Caller must hold the child row lock. Respects `maxQuantity` by clamping.
 */
export async function grantItem(tx: Prisma.TransactionClient, input: GrantItemInput) {
  const existing = await tx.inventoryGrant.findUnique({ where: { sourceKey: input.sourceKey } });
  if (existing) return { grant: existing, created: false as const };

  const item = await tx.itemDefinition.findUnique({ where: { key: input.itemKey } });
  if (!item || !item.isActive) throw AppError.notFound(`Item ${input.itemKey}`);

  const current = await tx.childInventoryItem.findUnique({
    where: { childId_itemId: { childId: input.childId, itemId: item.id } },
  });
  const currentQty = current?.quantity ?? 0;
  let nextQty = currentQty + input.quantity;
  if (nextQty < 0) throw AppError.invalidState(`Not enough ${item.name}`);
  if (item.maxQuantity != null && nextQty > item.maxQuantity) nextQty = item.maxQuantity;
  const applied = nextQty - currentQty;
  if (applied === 0) {
    // Already at cap: record nothing but keep the call idempotent for callers.
    return { grant: null, created: false as const };
  }

  const grant = await tx.inventoryGrant.create({
    data: {
      familyId: input.familyId,
      childId: input.childId,
      itemId: item.id,
      quantity: applied,
      sourceType: input.sourceType,
      sourceKey: input.sourceKey,
    },
  });
  await tx.childInventoryItem.upsert({
    where: { childId_itemId: { childId: input.childId, itemId: item.id } },
    create: {
      familyId: input.familyId,
      childId: input.childId,
      itemId: item.id,
      quantity: nextQty,
    },
    update: { quantity: nextQty },
  });
  return { grant, created: true as const };
}

export async function getInventory(db: DbClient, childId: string) {
  const rows = await db.childInventoryItem.findMany({
    where: { childId, quantity: { gt: 0 } },
    include: { item: true },
    orderBy: { acquiredAt: "asc" },
  });
  return rows;
}

export async function inventoryByItemKey(
  db: DbClient,
  childId: string,
): Promise<Record<string, number>> {
  const rows = await db.childInventoryItem.findMany({
    where: { childId },
    include: { item: { select: { key: true } } },
  });
  const map: Record<string, number> = {};
  for (const row of rows) map[row.item.key] = row.quantity;
  return map;
}

/**
 * Buy a ship/upgrade/cosmetic with COINS. Idempotent on the client-provided
 * key: a retried request neither double-charges nor double-grants.
 */
export async function purchaseItem(
  db: DbClient,
  params: { familyId: string; childId: string; itemKey: string; idempotencyKey: string },
) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, params.childId);
    const item = await tx.itemDefinition.findUnique({ where: { key: params.itemKey } });
    if (!item || !item.isActive) throw AppError.notFound("Item");

    // Retried request: the debit already exists, so return the earlier outcome.
    const priorDebit = await tx.rewardLedgerEntry.findUnique({
      where: { sourceKey: sourceKeys.purchaseDebit(params.idempotencyKey) },
    });
    if (priorDebit) {
      const priorGrant = await tx.inventoryGrant.findUnique({
        where: { sourceKey: sourceKeys.purchaseItem(params.idempotencyKey, item.key) },
      });
      return {
        item,
        debit: { entry: priorDebit, created: false as const },
        grant: { grant: priorGrant, created: false as const },
        replayed: true as const,
      };
    }
    const config = (item.config ?? {}) as { costCoins?: number; requiresShipTier?: number };
    const cost = config.costCoins;
    if (typeof cost !== "number") throw AppError.invalidState("This item is not for sale");

    const owned = await tx.childInventoryItem.findUnique({
      where: { childId_itemId: { childId: params.childId, itemId: item.id } },
    });
    if (item.maxQuantity != null && (owned?.quantity ?? 0) >= item.maxQuantity) {
      throw AppError.invalidState("You already own this");
    }

    const debit = await postLedgerEntry(tx, {
      familyId: params.familyId,
      childId: params.childId,
      currency: "COINS",
      amount: -cost,
      sourceType: "PURCHASE",
      sourceId: params.idempotencyKey,
      sourceKey: sourceKeys.purchaseDebit(params.idempotencyKey),
      description: `Bought ${item.name}`,
    });
    const grant = await grantItem(tx, {
      familyId: params.familyId,
      childId: params.childId,
      itemKey: item.key,
      quantity: 1,
      sourceType: "PURCHASE",
      sourceKey: sourceKeys.purchaseItem(params.idempotencyKey, item.key),
    });
    return { item, debit, grant, replayed: false as const };
  });
}
