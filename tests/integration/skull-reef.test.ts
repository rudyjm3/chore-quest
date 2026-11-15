import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getAdventureState } from "@/server/services/adventure.service";
import { inventoryByItemKey } from "@/server/services/inventory.service";
import { getWallets } from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import {
  buyShip,
  finishParrotIsland,
  finishShipwreckCove,
  household,
  puzzleId,
  chapterId,
  COVE_ANSWER,
} from "../helpers/pirate";
import { claimChapterReward, submitPuzzleAnswer } from "@/server/services/adventure.service";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

const statusOf = async (ctx: Parameters<typeof getAdventureState>[1], chapterKey: string) =>
  (await getAdventureState(db, ctx, "pirate")).chapters.find((c) => c.key === chapterKey)!;

describe("Skull Reef: the voyager ship gates the chapter (ADR 0020)", () => {
  it("economy: a child who buys nothing but the explorer can afford the voyager once the cove reward is claimed", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishParrotIsland(h, kid);
    await buyShip(h, kid, "ship-explorer");
    await h.approve(kid.child.id, "CHORE", 7); // the minimum: 4 planks, then 3 rope
    await submitPuzzleAnswer(db, kid.ctx, await puzzleId("repair-puzzle"), COVE_ANSWER);
    const atCompletion = (await getWallets(db, kid.child.id)).COINS; // cove reward not yet claimed
    await claimChapterReward(db, kid.ctx, await chapterId("shipwreck-cove"));
    const afterClaim = (await getWallets(db, kid.child.id)).COINS;
    const price = (
      (await db.itemDefinition.findUniqueOrThrow({ where: { key: "ship-voyager" } })).config as {
        costCoins: number;
      }
    ).costCoins;
    // Measured: 285 after the Parrot Island claim, 135 after the 150-coin explorer, +75 for 7 chores and the
    // ten-chores achievement (210), +25 puzzle, +50 quest, +30 shipwright achievement (315, cove complete),
    // +100 chapter reward claimed (415). The 400-coin voyager is affordable with 15 to spare, side quest unplayed.
    expect(price).toBe(400);
    expect(atCompletion).toBe(315);
    expect(afterClaim).toBe(415);
    expect(afterClaim).toBeGreaterThanOrEqual(price);
  });

  it("is locked after the cove until the voyager is bought, and the map says what is missing", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishShipwreckCove(h, kid);

    const locked = await statusOf(kid.ctx, "skull-reef");
    expect(locked.status).toBe("LOCKED");
    expect(locked.missingRequirements).toEqual([
      { type: "ITEM", itemKey: "ship-voyager", quantity: 1 },
    ]);
    expect(locked.hint).toMatch(/Voyager Ship/);
    expect((await getAdventureState(db, kid.ctx, "pirate")).itemNames["ship-voyager"]).toBe(
      "Voyager Ship",
    );
    expect(
      await db.questProgress.count({
        where: { childId: kid.child.id, quest: { chapter: { key: "skull-reef" } } },
      }),
    ).toBe(0);
  });

  it("names both missing requirements before the cove is finished, and the ship cannot be bought early", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishParrotIsland(h, kid);
    await buyShip(h, kid, "ship-explorer");
    const early = await statusOf(kid.ctx, "skull-reef");
    expect(early.missingRequirements.map((r) => r.type)).toEqual(["CHAPTER_COMPLETED", "ITEM"]);
    await expect(buyShip(h, kid, "ship-voyager")).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect((await inventoryByItemKey(db, kid.child.id))["ship-voyager"]).toBeUndefined();
  });

  it("buying the voyager unlocks the chapter in the same purchase; a replay changes nothing", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishShipwreckCove(h, kid);
    await buyShip(h, kid, "ship-voyager");
    const reef = await statusOf(kid.ctx, "skull-reef");
    expect(reef.status).toBe("UNLOCKED");
    expect(reef.missingRequirements).toEqual([]);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(15);
    const replay = await buyShip(h, kid, "ship-voyager");
    expect(replay.replayed).toBe(true);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(15);
  });
});
