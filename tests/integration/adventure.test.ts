import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  claimChapterReward,
  getAdventureState,
  startAdventure,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { reviewOccurrence } from "@/server/services/approval.service";
import { inventoryByItemKey, purchaseItem } from "@/server/services/inventory.service";
import { getWallets } from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import {
  createChildFixture,
  createFamilyFixture,
  createOccurrenceFixture,
  createTaskFixture,
} from "../helpers/fixtures";

const db = testDb();

beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function setup() {
  const { family, ctx } = await createFamilyFixture(db);
  const { child, ctx: childCtx } = await createChildFixture(db, family.id);
  const task = await createTaskFixture(db, family.id, { points: 5 });
  await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
  let day = 1;
  const approveChore = async () => {
    day += 1;
    const localDate = `2026-11-${String(day).padStart(2, "0")}`;
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: family.id,
      childId: child.id,
      taskId: task.id,
      localDate,
    });
    return reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
  };
  return { family, ctx, child, childCtx, task, approveChore };
}

describe("pirate adventure progression", () => {
  it("starting an adventure unlocks Home Port, activates its quests and grants the starter ship (idempotently)", async () => {
    const { family, child, childCtx } = await setup();
    await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
    const state = await getAdventureState(db, childCtx, "pirate");
    expect(state.started).toBe(true);
    const homePort = state.chapters.find((c) => c.key === "home-port")!;
    expect(homePort.status).toBe("UNLOCKED");
    expect(homePort.quests.find((q) => q.key === "prepare-the-ship")?.status).toBe("ACTIVE");
    expect(state.chapters.find((c) => c.key === "parrot-island")?.status).toBe("LOCKED");
    expect(state.inventory["ship-starter"]).toBe(1);
    expect(await db.inventoryGrant.count({ where: { childId: child.id } })).toBe(1);
  });

  it("three approved chores earn three crates, complete Home Port and unlock Parrot Island", async () => {
    const { child, childCtx, approveChore } = await setup();
    for (let i = 0; i < 2; i += 1) await approveChore();
    let state = await getAdventureState(db, childCtx, "pirate");
    expect(state.inventory["supply-crate"]).toBe(2);
    expect(state.chapters.find((c) => c.key === "home-port")?.status).toBe("UNLOCKED");

    const third = await approveChore();
    expect(third.processing?.quests.some((q) => q.completed)).toBe(true);
    state = await getAdventureState(db, childCtx, "pirate");
    expect(state.inventory["supply-crate"]).toBe(3);
    expect(state.chapters.find((c) => c.key === "home-port")?.status).toBe("COMPLETED");
    expect(state.chapters.find((c) => c.key === "parrot-island")?.status).toBe("UNLOCKED");
    expect(state.chapters.find((c) => c.key === "parrot-island")?.quests[0].status).toBe("ACTIVE");
    // Drip rewards: 3 chores × 5 coins + quest 20 coins; achievements: first chore 10 + set sail 25
    const wallets = await getWallets(db, child.id);
    expect(wallets.COINS).toBe(3 * 5 + 20 + 10 + 25);
    expect(wallets.POINTS).toBe(15);
    expect(await db.earnedAchievement.count({ where: { childId: child.id } })).toBe(2);
  });

  it("the chapter reward can be claimed exactly once", async () => {
    const { child, childCtx, approveChore } = await setup();
    const homePort = await db.adventureChapter.findFirstOrThrow({ where: { key: "home-port" } });
    await expect(claimChapterReward(db, childCtx, homePort.id)).rejects.toThrow(
      /Finish the chapter/,
    );
    for (let i = 0; i < 3; i += 1) await approveChore();

    const coinsBefore = (await getWallets(db, child.id)).COINS;
    const first = await claimChapterReward(db, childCtx, homePort.id);
    expect(first.claimed).toBe(true);
    const results = await Promise.all([
      claimChapterReward(db, childCtx, homePort.id),
      claimChapterReward(db, childCtx, homePort.id),
    ]);
    expect(results.every((r) => r.claimed === false)).toBe(true);
    const wallets = await getWallets(db, child.id);
    expect(wallets.COINS).toBe(coinsBefore + 50);
    expect((await inventoryByItemKey(db, child.id))["map-fragment"]).toBe(1);
    expect(
      await db.inventoryGrant.count({ where: { childId: child.id, sourceType: "CHAPTER_REWARD" } }),
    ).toBe(2); // starter ship + fragment
  });

  it("Parrot Island: four feathers unlock the puzzle; solving it completes the chapter and the second map fragment follows", async () => {
    const { child, childCtx, approveChore } = await setup();
    for (let i = 0; i < 3; i += 1) await approveChore();
    const homePort = await db.adventureChapter.findFirstOrThrow({ where: { key: "home-port" } });
    await claimChapterReward(db, childCtx, homePort.id);
    const puzzle = await db.puzzleDefinition.findFirstOrThrow({ where: { key: "compass-puzzle" } });

    // Puzzle gated until feathers are collected.
    await expect(
      submitPuzzleAnswer(db, childCtx, puzzle.id, { sequence: ["N", "E", "S", "W"] }),
    ).rejects.toThrow(AppError);

    for (let i = 0; i < 4; i += 1) await approveChore();
    expect((await inventoryByItemKey(db, child.id))["compass-feather"]).toBe(4);

    const wrong = await submitPuzzleAnswer(db, childCtx, puzzle.id, { sequence: ["S", "N"] });
    expect(wrong.correct).toBe(false);
    const right = await submitPuzzleAnswer(db, childCtx, puzzle.id, {
      sequence: ["N", "E", "S", "W"],
    });
    expect(right.correct).toBe(true);
    const again = await submitPuzzleAnswer(db, childCtx, puzzle.id, {
      sequence: ["N", "E", "S", "W"],
    });
    expect(again.alreadyCompleted).toBe(true);
    expect(
      await db.puzzleAttempt.count({ where: { childId: child.id, status: "COMPLETED" } }),
    ).toBe(1);

    const state = await getAdventureState(db, childCtx, "pirate");
    const parrot = state.chapters.find((c) => c.key === "parrot-island")!;
    expect(parrot.status).toBe("COMPLETED");
    expect(state.inventory["magic-compass"]).toBe(1);
    expect(state.chapters.find((c) => c.key === "shipwreck-cove")?.status).toBe("UNLOCKED");

    await claimChapterReward(db, childCtx, parrot.id);
    expect((await inventoryByItemKey(db, child.id))["map-fragment"]).toBe(2);
    expect(
      await db.earnedAchievement.count({
        where: { childId: child.id, achievement: { key: "pirate.compass-found" } },
      }),
    ).toBe(1);
  });

  it("a purchase is idempotent and never overdraws coins", async () => {
    const { family, child } = await setup();
    await expect(
      purchaseItem(db, {
        familyId: family.id,
        childId: child.id,
        itemKey: "upgrade-patched-sail",
        idempotencyKey: "buy-1",
      }),
    ).rejects.toThrow(/Insufficient/);
    await db.$transaction(async (tx) => {
      const { postLedgerEntry } = await import("@/server/services/reward.service");
      await postLedgerEntry(tx, {
        familyId: family.id,
        childId: child.id,
        currency: "COINS",
        amount: 100,
        sourceType: "PARENT_ADJUSTMENT",
        sourceId: "seed",
        sourceKey: "adjustment:seed:COINS",
      });
    });
    await purchaseItem(db, {
      familyId: family.id,
      childId: child.id,
      itemKey: "upgrade-patched-sail",
      idempotencyKey: "buy-1",
    });
    await purchaseItem(db, {
      familyId: family.id,
      childId: child.id,
      itemKey: "upgrade-patched-sail",
      idempotencyKey: "buy-1",
    });
    expect((await getWallets(db, child.id)).COINS).toBe(60);
    expect((await inventoryByItemKey(db, child.id))["upgrade-patched-sail"]).toBe(1);
    await expect(
      purchaseItem(db, {
        familyId: family.id,
        childId: child.id,
        itemKey: "upgrade-patched-sail",
        idempotencyKey: "buy-2",
      }),
    ).rejects.toThrow(/already own/);
  });
});
