import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  claimChapterReward,
  getAdventureState,
  getPuzzleForChild,
  startAdventure,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { reviewOccurrence } from "@/server/services/approval.service";
import { ensureAdventureProgressForChild } from "@/server/services/chapter-unlock.service";
import { inventoryByItemKey, purchaseItem } from "@/server/services/inventory.service";
import { getWallets } from "@/server/services/reward.service";

import { seedReferenceData } from "../../prisma/seed";
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

type Category = "CHORE" | "HYGIENE" | "SCHOOL" | "PET_CARE" | "HELPING" | "OTHER";
const ANSWER = {
  pairs: { hull: "hammer", mast: "saw", sail: "needle", wheel: "wrench", anchor: "oil" },
};
const WRONG = {
  pairs: { hull: "saw", mast: "hammer", sail: "needle", wheel: "wrench", anchor: "oil" },
};

/** A household with one or more children enrolled in the pirate adventure and a helper that approves chores. */
async function household(names: string[] = ["Ada"]) {
  const { family, ctx } = await createFamilyFixture(db);
  const tasks: Record<string, Awaited<ReturnType<typeof createTaskFixture>>> = {};
  for (const category of ["CHORE", "HYGIENE", "SCHOOL", "PET_CARE", "HELPING"] as Category[]) {
    tasks[category] = await createTaskFixture(db, family.id, {
      points: 5,
      category,
      title: category,
    });
  }
  const kids = [];
  for (const name of names) {
    const { child, ctx: childCtx } = await createChildFixture(db, family.id, name);
    await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
    kids.push({ child, ctx: childCtx });
  }
  let day = 1;
  const approve = async (childId: string, category: Category = "CHORE", times = 1) => {
    for (let i = 0; i < times; i += 1) {
      day += 1;
      const { occurrence } = await createOccurrenceFixture(db, {
        familyId: family.id,
        childId,
        taskId: tasks[category]!.id,
        localDate: `2026-${String(10 + Math.floor(day / 28)).padStart(2, "0")}-${String((day % 28) + 1).padStart(2, "0")}`,
      });
      await reviewOccurrence(db, ctx, {
        familyId: family.id,
        occurrenceId: occurrence.id,
        decision: "APPROVED",
      });
    }
  };
  return { family, ctx, kids, approve };
}

const chapterId = async (key: string) =>
  (await db.adventureChapter.findFirstOrThrow({ where: { key } })).id;
const puzzleId = async (key: string) =>
  (await db.puzzleDefinition.findFirstOrThrow({ where: { key } })).id;
const statusOf = async (ctx: Parameters<typeof getAdventureState>[1], chapterKey: string) =>
  (await getAdventureState(db, ctx, "pirate")).chapters.find((c) => c.key === chapterKey)!;

/** Play Home Port and Parrot Island through, claiming every reward, buying nothing. */
async function finishParrotIsland(h: Awaited<ReturnType<typeof household>>, kid = h.kids[0]!) {
  await h.approve(kid.child.id, "CHORE", 3);
  await claimChapterReward(db, kid.ctx, await chapterId("home-port"));
  await h.approve(kid.child.id, "CHORE", 4);
  const right = await submitPuzzleAnswer(db, kid.ctx, await puzzleId("compass-puzzle"), {
    sequence: ["N", "E", "S", "W"],
  });
  expect(right.correct).toBe(true);
}

async function buyExplorer(h: Awaited<ReturnType<typeof household>>, kid = h.kids[0]!) {
  return purchaseItem(db, {
    familyId: h.family.id,
    childId: kid.child.id,
    itemKey: "ship-explorer",
    idempotencyKey: `buy-explorer-${kid.child.id}`,
  });
}

/** Parrot Island done, explorer bought: Shipwreck Cove is playable. */
async function atTheCove(names?: string[]) {
  const h = await household(names);
  for (const kid of h.kids) {
    await finishParrotIsland(h, kid);
    await buyExplorer(h, kid);
  }
  return h;
}

describe("Shipwreck Cove: the ship gates the chapter", () => {
  it("stays locked after Parrot Island until the explorer is bought, and says what is missing", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishParrotIsland(h, kid);

    const locked = await statusOf(kid.ctx, "shipwreck-cove");
    expect(locked.status).toBe("LOCKED");
    expect(locked.missingRequirements).toEqual([
      { type: "ITEM", itemKey: "ship-explorer", quantity: 1 },
    ]);
    const state = await getAdventureState(db, kid.ctx, "pirate");
    expect(state.itemNames["ship-explorer"]).toBe("Explorer Ship");
    // No quest rows exist for a chapter that is still locked.
    expect(
      await db.questProgress.count({
        where: { childId: kid.child.id, quest: { chapter: { key: "shipwreck-cove" } } },
      }),
    ).toBe(0);
  });

  it("buying the explorer unlocks the chapter in the same purchase and activates its quests", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishParrotIsland(h, kid);
    await buyExplorer(h, kid);

    const cove = await statusOf(kid.ctx, "shipwreck-cove");
    expect(cove.status).toBe("UNLOCKED");
    expect(cove.missingRequirements).toEqual([]);
    expect(cove.quests.map((q) => [q.key, q.status])).toEqual([
      ["salvage-the-wreck", "ACTIVE"],
      ["tide-pool-treasures", "ACTIVE"],
    ]);
    expect(
      await db.objectiveProgress.count({
        where: {
          questProgress: { childId: kid.child.id, quest: { chapter: { key: "shipwreck-cove" } } },
        },
      }),
    ).toBe(4); // 3 main + 1 side

    // A retried purchase changes nothing.
    const replay = await buyExplorer(h, kid);
    expect(replay.replayed).toBe(true);
    expect((await inventoryByItemKey(db, kid.child.id))["ship-explorer"]).toBe(1);
  });

  it("economy: a child who buys no cosmetics can afford the explorer ship by the end of Parrot Island", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 3);
    await claimChapterReward(db, kid.ctx, await chapterId("home-port"));
    await h.approve(kid.child.id, "CHORE", 4);
    await submitPuzzleAnswer(db, kid.ctx, await puzzleId("compass-puzzle"), {
      sequence: ["N", "E", "S", "W"],
    });
    const atCompletion = (await getWallets(db, kid.child.id)).COINS; // Parrot Island reward not yet claimed
    await claimChapterReward(db, kid.ctx, await chapterId("parrot-island"));
    const afterClaim = (await getWallets(db, kid.child.id)).COINS;
    const price = (
      (await db.itemDefinition.findUniqueOrThrow({ where: { key: "ship-explorer" } })).config as {
        costCoins: number;
      }
    ).costCoins;
    // Measured: 210 coins at completion (7 chores x 5 = 35, quests 20 + 30, compass puzzle 10, Home Port
    // chapter reward 50, achievements 10 + 25 + 30), 285 once the Parrot Island reward of 75 is claimed.
    // So the 150-coin ship is affordable with 60 to spare before any chapter reward is claimed.
    expect(price).toBe(150);
    expect(atCompletion).toBeGreaterThanOrEqual(price);
    expect(afterClaim).toBeGreaterThanOrEqual(price + 75);
  });
});

describe("Shipwreck Cove: salvage and repair", () => {
  it("salvage accrues from approvals, with planks from any chore and rope from other categories", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 2);
    let inv = await inventoryByItemKey(db, kid.child.id);
    expect(inv["salvage-plank"]).toBe(2);
    expect(inv["rope-coil"]).toBeUndefined();

    await h.approve(kid.child.id, "CHORE", 2);
    inv = await inventoryByItemKey(db, kid.child.id);
    expect(inv["salvage-plank"]).toBe(4);

    // Planks are done, so a hygiene chore now becomes rope; a plain chore does not.
    await h.approve(kid.child.id, "CHORE", 1);
    expect((await inventoryByItemKey(db, kid.child.id))["rope-coil"]).toBeUndefined();
    await h.approve(kid.child.id, "HYGIENE");
    await h.approve(kid.child.id, "SCHOOL");
    await h.approve(kid.child.id, "PET_CARE");
    inv = await inventoryByItemKey(db, kid.child.id);
    expect(inv["salvage-plank"]).toBe(4);
    expect(inv["rope-coil"]).toBe(3);

    const main = (await statusOf(kid.ctx, "shipwreck-cove")).quests.find(
      (q) => q.key === "salvage-the-wreck",
    )!;
    expect(main.objectives.map((o) => [o.key, o.currentCount, o.completed])).toEqual([
      ["gather-planks", 4, true],
      ["gather-rope", 3, true],
      ["repair-the-ship", 0, false],
    ]);
  });

  it("the side quest counts helping and pet care approvals and pays out once", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "HELPING");
    await h.approve(kid.child.id, "PET_CARE");
    const side = (await statusOf(kid.ctx, "shipwreck-cove")).quests.find(
      (q) => q.key === "tide-pool-treasures",
    )!;
    expect(side.status).toBe("CLAIMED");
  });

  it("the Wreck is closed until four planks are held: no attempt row, no progress", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    const id = await puzzleId("repair-puzzle");
    await h.approve(kid.child.id, "CHORE", 3);

    const view = await getPuzzleForChild(db, kid.ctx, {
      adventureKey: "pirate",
      chapterKey: "shipwreck-cove",
      puzzleKey: "repair-puzzle",
    });
    expect(view.gate).toEqual({ itemKey: "salvage-plank", quantity: 4, met: false });

    const error = await submitPuzzleAnswer(db, kid.ctx, id, ANSWER).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("INVALID_STATE");
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: id } })).toBe(
      0,
    );
  });

  it("repairing the ship needs a correct, complete matching; planks are held, never consumed", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    const id = await puzzleId("repair-puzzle");
    await h.approve(kid.child.id, "CHORE", 4);

    const view = await getPuzzleForChild(db, kid.ctx, {
      adventureKey: "pirate",
      chapterKey: "shipwreck-cove",
      puzzleKey: "repair-puzzle",
    });
    expect(view.gate?.met).toBe(true);
    expect(JSON.stringify(view)).not.toContain('"pairs"');

    for (const bad of [WRONG, { pairs: { hull: "hammer" } }, { pairs: {} }, "nonsense", null]) {
      const verdict = await submitPuzzleAnswer(db, kid.ctx, id, bad);
      expect(verdict.correct).toBe(false);
    }
    const coinsBefore = (await getWallets(db, kid.child.id)).COINS;
    const ok = await submitPuzzleAnswer(db, kid.ctx, id, ANSWER);
    expect(ok.correct).toBe(true);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coinsBefore + 15);
    expect((await inventoryByItemKey(db, kid.child.id))["salvage-plank"]).toBe(4);
    expect((await submitPuzzleAnswer(db, kid.ctx, id, ANSWER)).alreadyCompleted).toBe(true);
    expect(
      await db.puzzleAttempt.count({
        where: { childId: kid.child.id, puzzleId: id, status: "COMPLETED" },
      }),
    ).toBe(1);
  });

  it("the gate checks what is held now, not what was ever earned", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    const id = await puzzleId("repair-puzzle");
    await h.approve(kid.child.id, "CHORE", 4);
    await db.childInventoryItem.updateMany({
      where: { childId: kid.child.id, item: { key: "salvage-plank" } },
      data: { quantity: 3 },
    });
    await expect(submitPuzzleAnswer(db, kid.ctx, id, ANSWER)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id } })).toBe(1); // the compass only
  });

  it("full chapter: salvage, repair, complete, claim once, and Skull Reef unlocks", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 4);
    await h.approve(kid.child.id, "HYGIENE", 3);
    expect(
      (await statusOf(kid.ctx, "shipwreck-cove")).quests.find((q) => q.key === "salvage-the-wreck")!
        .status,
    ).toBe("ACTIVE");
    expect((await statusOf(kid.ctx, "skull-reef")).status).toBe("LOCKED");

    await submitPuzzleAnswer(db, kid.ctx, await puzzleId("repair-puzzle"), ANSWER);
    const cove = await statusOf(kid.ctx, "shipwreck-cove");
    expect(cove.status).toBe("COMPLETED");
    expect(cove.quests.find((q) => q.key === "salvage-the-wreck")!.status).toBe("CLAIMED");
    expect((await statusOf(kid.ctx, "skull-reef")).status).toBe("UNLOCKED");

    const before = await getWallets(db, kid.child.id);
    const fragments = (await inventoryByItemKey(db, kid.child.id))["map-fragment"] ?? 0;
    const results = await Promise.all([
      claimChapterReward(db, kid.ctx, cove.id),
      claimChapterReward(db, kid.ctx, cove.id),
    ]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before.COINS + 100);
    expect((await inventoryByItemKey(db, kid.child.id))["map-fragment"]).toBe(fragments + 1);
  });
});

describe("Shipwreck Cove: siblings", () => {
  it("one child's salvage, attempts and chapter never leak into a sibling's", async () => {
    const h = await atTheCove(["Ada", "Bo"]);
    const [a, b] = h.kids as [(typeof h.kids)[number], (typeof h.kids)[number]];
    const id = await puzzleId("repair-puzzle");
    await h.approve(a.child.id, "CHORE", 4);

    // Bo holds none of Ada's planks and cannot use the Wreck on the strength of them.
    expect((await inventoryByItemKey(db, b.child.id))["salvage-plank"]).toBeUndefined();
    await expect(submitPuzzleAnswer(db, b.ctx, id, ANSWER)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await db.puzzleAttempt.count({ where: { childId: b.child.id, puzzleId: id } })).toBe(0);

    const params = {
      adventureKey: "pirate",
      chapterKey: "shipwreck-cove",
      puzzleKey: "repair-puzzle",
    };
    expect((await getPuzzleForChild(db, b.ctx, params)).gate?.met).toBe(false);

    await submitPuzzleAnswer(db, a.ctx, id, ANSWER);
    expect((await getPuzzleForChild(db, a.ctx, params)).solved).toBe(true);
    expect((await getPuzzleForChild(db, b.ctx, params)).solved).toBe(false);

    // Bo's chapter state and quest rows are Bo's own.
    const bState = await statusOf(b.ctx, "shipwreck-cove");
    expect(bState.status).toBe("UNLOCKED");
    expect(
      bState.quests.find((q) => q.key === "salvage-the-wreck")!.objectives[0]!.currentCount,
    ).toBe(0);
  });

  it("a child from another household cannot reach a chapter they have not unlocked", async () => {
    const h = await atTheCove();
    const other = await household(["Eve"]);
    const params = {
      adventureKey: "pirate",
      chapterKey: "shipwreck-cove",
      puzzleKey: "repair-puzzle",
    };
    await expect(getPuzzleForChild(db, other.kids[0]!.ctx, params)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      submitPuzzleAnswer(db, other.kids[0]!.ctx, await puzzleId("repair-puzzle"), ANSWER),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.kids).toHaveLength(1);
  });
});

describe("Shipwreck Cove: puzzle race", () => {
  it("parallel correct submissions grant the reward exactly once", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    const id = await puzzleId("repair-puzzle");
    await h.approve(kid.child.id, "CHORE", 4);
    await h.approve(kid.child.id, "HYGIENE", 3);
    const coinsBefore = (await getWallets(db, kid.child.id)).COINS;

    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitPuzzleAnswer(db, kid.ctx, id, ANSWER)),
    );
    expect(results.every((r) => r.correct)).toBe(true);
    expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: id } })).toBe(
      1,
    );
    // Puzzle reward (15) plus quest reward (40) once each.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coinsBefore + 15 + 40);
    expect(
      await db.rewardLedgerEntry.count({
        where: { childId: kid.child.id, sourceKey: { startsWith: "puzzle:" }, currency: "COINS" },
      }),
    ).toBe(2); // the compass puzzle's and this one's, one each
  });
});

describe("ensure step: children who unlocked Shipwreck Cove before it had quests", () => {
  const url = () => process.env.TEST_DATABASE_URL as string;

  /** Put the database back to what the placeholder chapter looked like before this slice. */
  async function revertToPlaceholder() {
    const chapter = await db.adventureChapter.findFirstOrThrow({
      where: { key: "shipwreck-cove" },
    });
    await db.adventureQuest.deleteMany({ where: { chapterId: chapter.id } });
    await db.puzzleDefinition.deleteMany({ where: { chapterId: chapter.id } });
    await db.adventureChapter.update({
      where: { id: chapter.id },
      data: {
        status: "PLACEHOLDER",
        config: {
          unlock: { requires: [{ type: "CHAPTER_COMPLETED", chapterKey: "parrot-island" }] },
          completion: { requiresQuestKeys: [] },
          rewards: { coins: 100, xp: 200, items: [{ itemKey: "map-fragment", quantity: 1 }] },
          mapMarker: { x: 52, y: 66 },
          locations: [],
        },
      },
    });
    return chapter.id;
  }

  it("old data first, then the new theme data: rows appear, nothing is revoked, and re-running changes nothing", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const coveId = await revertToPlaceholder();
      await finishParrotIsland(h, kid); // placeholder unlocks on Parrot Island alone: no ship needed
      const cp = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: kid.child.id, chapterId: coveId },
      });
      expect(cp.status).toBe("UNLOCKED");
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: coveId } },
        }),
      ).toBe(0);

      await seedReferenceData(url()); // the new theme data arrives

      // Grandfathered: unlocked without owning the ship, and not revoked by the new requirement.
      expect((await inventoryByItemKey(db, kid.child.id))["ship-explorer"]).toBeUndefined();
      expect((await statusOf(kid.ctx, "shipwreck-cove")).status).toBe("UNLOCKED");
      // Read-only state does not invent rows.
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: coveId } },
        }),
      ).toBe(0);

      const first = await ensureAdventureProgressForChild(db, kid.ctx, "pirate");
      expect(first).toEqual({ questsActivated: 2, objectiveRows: 0 });
      const again = await ensureAdventureProgressForChild(db, kid.ctx, "pirate");
      expect(again).toEqual({ questsActivated: 0, objectiveRows: 0 });

      const cove = await statusOf(kid.ctx, "shipwreck-cove");
      expect(cove.status).toBe("UNLOCKED");
      expect(cove.quests.map((q) => q.status)).toEqual(["ACTIVE", "ACTIVE"]);
      // Quests of finished chapters were left alone (Home Port's side quest was never started: it stays as it was).
      expect(
        (await statusOf(kid.ctx, "home-port")).quests.find((q) => q.key === "prepare-the-ship")!
          .status,
      ).toBe("CLAIMED");
      expect(await db.questProgress.count({ where: { childId: kid.child.id } })).toBe(2 + 1 + 2);
      // Skull Reef is still locked: no rows for chapters the child has not reached.
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapter: { key: "skull-reef" } } },
        }),
      ).toBe(0);

      // The grandfathered child can play: an approval now yields a plank.
      await h.approve(kid.child.id, "CHORE");
      expect((await inventoryByItemKey(db, kid.child.id))["salvage-plank"]).toBe(1);
    } finally {
      await seedReferenceData(url());
    }
  });

  it("the completion pipeline heals a child by itself, with no page visit", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const coveId = await revertToPlaceholder();
      await finishParrotIsland(h, kid);
      await seedReferenceData(url());
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: coveId } },
        }),
      ).toBe(0);

      await h.approve(kid.child.id, "CHORE", 2);
      expect((await inventoryByItemKey(db, kid.child.id))["salvage-plank"]).toBe(2);
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: coveId }, status: "ACTIVE" },
        }),
      ).toBe(2);
    } finally {
      await seedReferenceData(url());
    }
  });

  it("adds a missing objective row to an active quest, but never reopens a claimed one or revives a locked one", async () => {
    const h = await atTheCove();
    const kid = h.kids[0]!;
    const main = await db.questProgress.findFirstOrThrow({
      where: { childId: kid.child.id, quest: { key: "salvage-the-wreck" } },
    });
    await db.objectiveProgress.deleteMany({
      where: { questProgressId: main.id, objective: { key: "gather-rope" } },
    });
    // A claimed quest (Home Port) with a deleted objective row must stay as it is.
    const claimedQuest = await db.questProgress.findFirstOrThrow({
      where: { childId: kid.child.id, quest: { key: "prepare-the-ship" } },
    });
    await db.objectiveProgress.deleteMany({ where: { questProgressId: claimedQuest.id } });

    expect(await ensureAdventureProgressForChild(db, kid.ctx, "pirate")).toEqual({
      questsActivated: 0,
      objectiveRows: 1,
    });
    expect(await db.objectiveProgress.count({ where: { questProgressId: main.id } })).toBe(3);
    expect(await db.objectiveProgress.count({ where: { questProgressId: claimedQuest.id } })).toBe(
      0,
    );
    expect(
      (await db.questProgress.findUniqueOrThrow({ where: { id: claimedQuest.id } })).status,
    ).toBe("CLAIMED");
  });
});
