import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { startAdventure } from "@/server/services/adventure.service";
import {
  getInventory,
  inventoryByItemKey,
  listShopItems,
  purchaseItem,
} from "@/server/services/inventory.service";
import { getWallets, postLedgerEntry } from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function setup(coins: number) {
  const { family } = await createFamilyFixture(db);
  const { child, ctx } = await createChildFixture(db, family.id);
  await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
  if (coins > 0) {
    await db.$transaction((tx) =>
      postLedgerEntry(tx, {
        familyId: family.id,
        childId: child.id,
        currency: "COINS",
        amount: coins,
        sourceType: "PARENT_ADJUSTMENT",
        sourceId: "seed",
        sourceKey: `adjustment:seed-${child.id}:COINS`,
      }),
    );
  }
  return { family, child, ctx };
}
const buy = (s: Awaited<ReturnType<typeof setup>>, itemKey: string, idempotencyKey: string) =>
  purchaseItem(db, { familyId: s.family.id, childId: s.child.id, itemKey, idempotencyKey });
const coins = async (childId: string) => (await getWallets(db, childId)).COINS;

describe("supply shop listing", () => {
  it("lists only priced items with availability states", async () => {
    const s = await setup(50);
    const { listings, coins: balance } = await listShopItems(db, s.ctx);
    expect(balance).toBe(50);
    const byKey = Object.fromEntries(listings.map((l) => [l.key, l.availability.status]));
    expect(byKey["upgrade-patched-sail"]).toBe("available"); // 40, needs tier 1 (starter ship)
    expect(byKey["cosmetic-captain-hat"]).toBe("cant-afford"); // 60
    expect(byKey["upgrade-brass-cannon"]).toBe("locked"); // needs tier 2
    expect(byKey["ship-explorer"]).toBe("locked"); // chapter not completed
    expect(byKey["ship-starter"]).toBeUndefined(); // not for sale
    expect(byKey["supply-crate"]).toBeUndefined();
  });

  it("shows max-owned after buying", async () => {
    const s = await setup(100);
    await buy(s, "upgrade-patched-sail", "key-aaaa-1");
    const { listings } = await listShopItems(db, s.ctx);
    const sail = listings.find((l) => l.key === "upgrade-patched-sail");
    expect(sail?.availability.status).toBe("max-owned");
    expect(sail?.owned).toBe(1);
  });
});

describe("purchasing", () => {
  it("a double submit with the same key debits once and grants once", async () => {
    const s = await setup(100);
    await Promise.all([
      buy(s, "upgrade-patched-sail", "same-key-1"),
      buy(s, "upgrade-patched-sail", "same-key-1"),
    ]);
    expect(await coins(s.child.id)).toBe(60);
    expect((await inventoryByItemKey(db, s.child.id))["upgrade-patched-sail"]).toBe(1);
    expect(await db.rewardLedgerEntry.count({ where: { sourceType: "PURCHASE" } })).toBe(1);
  });

  it("refuses an overdraft and leaves nothing behind", async () => {
    const s = await setup(30);
    await expect(buy(s, "upgrade-patched-sail", "key-bbbb-1")).rejects.toThrow(/Insufficient/);
    expect(await coins(s.child.id)).toBe(30);
    expect((await inventoryByItemKey(db, s.child.id))["upgrade-patched-sail"]).toBeUndefined();
  });

  it("refuses a second copy of a max-1 item with a different key", async () => {
    const s = await setup(200);
    await buy(s, "upgrade-patched-sail", "key-cccc-1");
    await expect(buy(s, "upgrade-patched-sail", "key-cccc-2")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await coins(s.child.id)).toBe(160);
  });

  it("racing purchases against one balance: exactly the affordable number succeed (looped)", async () => {
    for (let round = 0; round < 5; round++) {
      await resetHouseholdData(db);
      const s = await setup(100); // sail 40 + hat 60 = 100: only both-or-fewer fit; add a third race
      const results = await Promise.allSettled([
        buy(s, "upgrade-patched-sail", `race-${round}-a`),
        buy(s, "cosmetic-captain-hat", `race-${round}-b`),
        buy(s, "cosmetic-captain-hat", `race-${round}-c`), // a second hat key: max 1
      ]);
      const ok = results.filter((r) => r.status === "fulfilled").length;
      expect(ok).toBe(2); // sail and one hat; the other hat is refused
      expect(await coins(s.child.id)).toBe(0);
      const wallet = await db.rewardWallet.findFirstOrThrow({
        where: { childId: s.child.id, currency: "COINS" },
      });
      expect(wallet.balance).toBeGreaterThanOrEqual(0);
    }
  });

  it("two big purchases on a balance that covers one: one wins, balance never negative (looped)", async () => {
    for (let round = 0; round < 5; round++) {
      await resetHouseholdData(db);
      const s = await setup(70);
      const results = await Promise.allSettled([
        buy(s, "cosmetic-captain-hat", `big-${round}-a`), // 60
        buy(s, "upgrade-patched-sail", `big-${round}-b`), // 40
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await coins(s.child.id)).toBeGreaterThanOrEqual(10);
    }
  });

  it("enforces unlock requirements on the server (not only in the UI)", async () => {
    const s = await setup(5000);
    await expect(buy(s, "ship-explorer", "key-dddd-1")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(buy(s, "upgrade-brass-cannon", "key-dddd-2")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(buy(s, "supply-crate", "key-dddd-3")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await coins(s.child.id)).toBe(5000);
  });

  it("unknown or inactive items are NOT_FOUND", async () => {
    const s = await setup(100);
    await expect(buy(s, "does-not-exist", "key-eeee-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await db.itemDefinition.update({
      where: { key: "cosmetic-captain-hat" },
      data: { isActive: false },
    });
    await expect(buy(s, "cosmetic-captain-hat", "key-eeee-2")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await db.itemDefinition.update({
      where: { key: "cosmetic-captain-hat" },
      data: { isActive: true },
    });
  });

  it("a child cannot be charged through another family's id", async () => {
    const a = await setup(100);
    const b = await createFamilyFixture(db);
    await expect(
      purchaseItem(db, {
        familyId: b.family.id,
        childId: a.child.id,
        itemKey: "upgrade-patched-sail",
        idempotencyKey: "cross-family-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await coins(a.child.id)).toBe(100);
  });
});

describe("inventory scoping", () => {
  it("only returns the asking child's items", async () => {
    const a = await setup(100);
    const { child: sibling } = await createChildFixture(db, a.family.id);
    await buy(a, "upgrade-patched-sail", "key-ffff-1");
    expect((await getInventory(db, a.child.id)).map((r) => r.item.key)).toContain(
      "upgrade-patched-sail",
    );
    expect(await getInventory(db, sibling.id)).toHaveLength(0);
  });
});
