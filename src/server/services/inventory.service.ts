import type { Prisma } from "@/generated/prisma/client";
import type { InventorySourceType } from "@/generated/prisma/enums";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { sourceKeys } from "@/lib/utils/source-keys";
import {
  evaluateShopItem,
  highestShipTier,
  isForSale,
  parseShopConfig,
  type ShopAvailability,
  type ShopContext,
} from "@/features/shop/shop-state";

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
    include: { item: { include: { adventure: { select: { themeKey: true } } } } },
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
    // The child must belong to the stated family; a mismatched pair is treated as unknown.
    const child = await tx.child.findFirst({
      where: { id: params.childId, familyId: params.familyId },
      select: { id: true },
    });
    if (!child) throw AppError.notFound("Child");
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
    if (!isForSale(item)) throw AppError.invalidState("This item is not for sale");
    const cost = parseShopConfig(item.config).costCoins as number; // checked by isForSale above

    // The same rules the shop page shows, evaluated here under the child lock (never client state).
    const availability = evaluateShopItem(item, await loadShopContext(tx, params.childId));
    if (availability.status === "max-owned") throw AppError.invalidState("You already own this");
    if (availability.status === "locked") throw AppError.invalidState(availability.reason);

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

/** Everything the shop rules need, read inside the caller's transaction/connection. */
export async function loadShopContext(
  db: Prisma.TransactionClient | DbClient,
  childId: string,
): Promise<ShopContext & { shipTiers: Record<string, number> }> {
  const wallet = await db.rewardWallet.findUnique({
    where: { childId_currency: { childId, currency: "COINS" } },
  });
  const inventory = await db.childInventoryItem.findMany({
    where: { childId },
    include: { item: { select: { key: true, type: true, config: true } } },
  });
  const owned: Record<string, number> = {};
  for (const row of inventory) owned[row.item.key] = row.quantity;
  const ships = await db.itemDefinition.findMany({
    where: { type: "SHIP", isActive: true },
    select: { key: true, config: true },
  });
  const shipTiers: Record<string, number> = {};
  for (const ship of ships) shipTiers[ship.key] = parseShopConfig(ship.config).tier ?? 0;
  const chapters = await db.childChapterProgress.findMany({
    where: { childId, status: "COMPLETED" },
    select: { chapter: { select: { key: true } } },
  });
  return {
    coins: wallet?.balance ?? 0,
    owned,
    shipTier: highestShipTier(owned, shipTiers),
    shipTiers,
    completedChapterKeys: new Set(chapters.map((c) => c.chapter.key)),
  };
}

export interface ShopListing {
  key: string;
  name: string;
  description: string | null;
  type: string;
  rarity: string;
  iconKey: string | null;
  themeKey: string | null;
  costCoins: number;
  owned: number;
  maxQuantity: number | null;
  availability: ShopAvailability;
}

/** The supply shop for one child: every active item that has a coin price, with its state. */
export async function listShopItems(db: DbClient, ctx: { familyId: string; childId: string }) {
  const [items, context] = await Promise.all([
    db.itemDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { key: "asc" }],
      include: { adventure: { select: { themeKey: true } } },
    }),
    loadShopContext(db, ctx.childId),
  ]);
  const itemNames = Object.fromEntries(items.map((i) => [i.key, i.name]));
  const listings: ShopListing[] = items
    .filter((item) => isForSale(item))
    .map((item) => ({
      key: item.key,
      name: item.name,
      description: item.description,
      type: item.type,
      rarity: item.rarity,
      iconKey: item.iconKey,
      themeKey: item.adventure?.themeKey ?? null,
      costCoins: parseShopConfig(item.config).costCoins as number,
      owned: context.owned[item.key] ?? 0,
      maxQuantity: item.maxQuantity,
      availability: evaluateShopItem(item, { ...context, itemNames }),
    }));
  // Cheapest first inside each type; stable and predictable for kids.
  listings.sort((a, b) => a.type.localeCompare(b.type) || a.costCoins - b.costCoins);
  return { coins: context.coins, listings };
}
