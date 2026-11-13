import { z } from "zod";

/**
 * Pure shop rules shared by the child shop page and `inventory.service.purchaseItem`, so what the
 * page shows and what the server accepts can never disagree. No I/O. Theme-neutral: the keys below
 * are generic item `config` fields, the theme only supplies the values.
 */
export const shopConfigSchema = z.object({
  costCoins: z.number().int().min(1).optional(),
  tier: z.number().int().min(1).optional(),
  requiresShipTier: z.number().int().min(1).optional(),
  requiresItemKey: z.string().optional(),
  requiresChapterKey: z.string().optional(),
});
export type ShopConfig = z.infer<typeof shopConfigSchema>;

export function parseShopConfig(config: unknown): ShopConfig {
  const parsed = shopConfigSchema.safeParse(config ?? {});
  return parsed.success ? parsed.data : {};
}

export interface ShopItemInput {
  key: string;
  name: string;
  maxQuantity: number | null;
  config: unknown;
}

/** What the child already has and has done: the inputs of every rule. */
export interface ShopContext {
  coins: number;
  /** itemKey → quantity owned. */
  owned: Record<string, number>;
  /** Highest `tier` among owned ships (0 when none). */
  shipTier: number;
  completedChapterKeys: ReadonlySet<string>;
  /** itemKey → display name, to word "needs X" requirements. */
  itemNames?: Record<string, string>;
}

export type ShopAvailability =
  | { status: "available" }
  | { status: "max-owned"; reason: string }
  | { status: "cant-afford"; reason: string; missing: number }
  | { status: "locked"; reason: string };

/** The highest ship tier among owned items; `shipTiers` maps ship item key → tier. */
export function highestShipTier(
  owned: Record<string, number>,
  shipTiers: Record<string, number>,
): number {
  let best = 0;
  for (const [key, tier] of Object.entries(shipTiers)) {
    if ((owned[key] ?? 0) > 0 && tier > best) best = tier;
  }
  return best;
}

/** True when the item is something the shop sells at all. */
export function isForSale(item: ShopItemInput): boolean {
  return parseShopConfig(item.config).costCoins !== undefined;
}

export function evaluateShopItem(item: ShopItemInput, ctx: ShopContext): ShopAvailability {
  const config = parseShopConfig(item.config);
  const owned = ctx.owned[item.key] ?? 0;
  if (item.maxQuantity !== null && owned >= item.maxQuantity) {
    return { status: "max-owned", reason: "You already have this!" };
  }
  if (config.requiresChapterKey && !ctx.completedChapterKeys.has(config.requiresChapterKey)) {
    return { status: "locked", reason: "Finish more of the adventure to unlock this." };
  }
  if (config.requiresShipTier && ctx.shipTier < config.requiresShipTier) {
    return { status: "locked", reason: "You need a better ship first." };
  }
  if (config.requiresItemKey && (ctx.owned[config.requiresItemKey] ?? 0) <= 0) {
    const name = ctx.itemNames?.[config.requiresItemKey];
    return {
      status: "locked",
      reason: name ? `You need the ${name} first.` : "Find a special item first.",
    };
  }
  const cost = config.costCoins;
  if (cost === undefined) return { status: "locked", reason: "Not for sale." };
  if (ctx.coins < cost) {
    const missing = cost - ctx.coins;
    return { status: "cant-afford", reason: `${missing} more coins to go.`, missing };
  }
  return { status: "available" };
}
