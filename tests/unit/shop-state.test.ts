import { describe, expect, it } from "vitest";

import {
  evaluateShopItem,
  highestShipTier,
  isForSale,
  parseShopConfig,
  type ShopContext,
} from "@/features/shop/shop-state";

const base: ShopContext = {
  coins: 100,
  owned: {},
  shipTier: 1,
  completedChapterKeys: new Set(),
};
const sail = { key: "sail", name: "Sail", maxQuantity: 1, config: { costCoins: 40 } };

describe("shop state", () => {
  it("is available when affordable, unowned and unlocked", () => {
    expect(evaluateShopItem(sail, base)).toEqual({ status: "available" });
  });

  it("reports how many coins are missing", () => {
    expect(evaluateShopItem(sail, { ...base, coins: 15 })).toMatchObject({
      status: "cant-afford",
      missing: 25,
    });
  });

  it("max owned beats everything else", () => {
    expect(evaluateShopItem(sail, { ...base, coins: 0, owned: { sail: 1 } }).status).toBe(
      "max-owned",
    );
    const stackable = { ...sail, maxQuantity: null };
    expect(evaluateShopItem(stackable, { ...base, owned: { sail: 99 } }).status).toBe("available");
  });

  it("enforces ship tier, required item and completed chapter", () => {
    const cannon = {
      key: "cannon",
      name: "Cannon",
      maxQuantity: 1,
      config: { costCoins: 10, requiresShipTier: 2 },
    };
    expect(evaluateShopItem(cannon, base).status).toBe("locked");
    expect(evaluateShopItem(cannon, { ...base, shipTier: 2 }).status).toBe("available");
    const perch = {
      key: "perch",
      name: "Perch",
      maxQuantity: 1,
      config: { costCoins: 10, requiresItemKey: "magic-compass" },
    };
    expect(evaluateShopItem(perch, base)).toMatchObject({ status: "locked" });
    expect(evaluateShopItem(perch, { ...base, owned: { "magic-compass": 1 } }).status).toBe(
      "available",
    );
    const ship = {
      key: "explorer",
      name: "Explorer",
      maxQuantity: 1,
      config: { costCoins: 10, requiresChapterKey: "parrot-island" },
    };
    expect(evaluateShopItem(ship, base).status).toBe("locked");
    expect(
      evaluateShopItem(ship, { ...base, completedChapterKeys: new Set(["parrot-island"]) }).status,
    ).toBe("available");
  });

  it("items without a coin price are not for sale; bad config is ignored", () => {
    expect(isForSale({ key: "x", name: "x", maxQuantity: null, config: {} })).toBe(false);
    expect(isForSale({ key: "x", name: "x", maxQuantity: null, config: { costCoins: "a" } })).toBe(
      false,
    );
    expect(parseShopConfig(null)).toEqual({});
    expect(
      evaluateShopItem({ key: "x", name: "x", maxQuantity: null, config: {} }, base).status,
    ).toBe("locked");
  });

  it("finds the highest owned ship tier", () => {
    const tiers = { a: 1, b: 3, c: 2 };
    expect(highestShipTier({}, tiers)).toBe(0);
    expect(highestShipTier({ a: 1, c: 1 }, tiers)).toBe(2);
    expect(highestShipTier({ a: 1, b: 0 }, tiers)).toBe(1);
  });
});
