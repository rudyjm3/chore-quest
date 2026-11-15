import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  claimChapterReward,
  getAdventureState,
  getPuzzleForChild,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { ensureAdventureProgressForChild } from "@/server/services/chapter-unlock.service";
import { inventoryByItemKey } from "@/server/services/inventory.service";
import { getWallets } from "@/server/services/reward.service";

import { seedReferenceData } from "../../prisma/seed";
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

// ---------------------------------------------------------------------------------------------------------
// Playing the chapter
// ---------------------------------------------------------------------------------------------------------

/** Safe routes on the two boards in the theme data (see the layouts in adventure.ts). */
const CHART_ROUTE = ["right", "up", "up", "right", "up", "up", "right", "right"];
const CHART_ROUTE_TWO = ["right", "up", "up", "right", "right", "right", "up", "up"]; // along row 2, up the right edge
const ESCAPE_ROUTE = ["right", "up", "up", "up", "right", "right", "right", "right", "up", "up"];
const TENTACLES = { sequence: ["Coil", "Sweep", "Slam", "Sweep", "Snap"] };
const WEAK_POINTS = {
  pairs: { tentacle: "net", beak: "shield", eye: "glass", ink: "lantern", grip: "hook" },
};

type Household = Awaited<ReturnType<typeof household>>;
type Kid = Household["kids"][number];

async function atTheReef(names?: string[]) {
  const h = await household(names);
  for (const kid of h.kids) {
    await finishShipwreckCove(h, kid);
    await buyShip(h, kid, "ship-voyager");
  }
  return h;
}

const submit = async (kid: Kid, key: string, answer: unknown) =>
  submitPuzzleAnswer(db, kid.ctx, await puzzleId(key), answer);
const attemptsFor = async (kid: Kid, key: string) =>
  db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: await puzzleId(key) } });
const questStatus = async (kid: Kid, questKey: string) =>
  (await statusOf(kid.ctx, "skull-reef")).quests.find((q) => q.key === questKey)!;

/** Chart pieces earned, route planned: the Kraken quest is open. */
async function chartTheReef(h: Household, kid: Kid) {
  await h.approve(kid.child.id, "CHORE", 5);
  const verdict = await submit(kid, "reef-chart-puzzle", { moves: CHART_ROUTE });
  expect(verdict.correct).toBe(true);
}

describe("Skull Reef: chart pieces and the route puzzle", () => {
  it("unlocks with two main quests and a side quest, and the Kraken quest waits for the chart", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    const reef = await statusOf(kid.ctx, "skull-reef");
    expect(reef.definitionStatus).toBe("PLAYABLE");
    expect(reef.quests.map((q) => [q.key, q.status])).toEqual([
      ["navigate-the-reef", "ACTIVE"],
      ["defeat-the-kraken", "LOCKED"],
      ["reef-scavengers", "ACTIVE"],
    ]);
    const kraken = reef.quests.find((q) => q.key === "defeat-the-kraken")!;
    expect(kraken.requiresQuestKey).toBe("navigate-the-reef");
    expect(kraken.objectives.every((o) => !o.available)).toBe(true);
  });

  it("chart pieces come from any approved chore, and are held, never spent", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "HELPING", 2);
    await h.approve(kid.child.id, "PET_CARE", 3);
    expect((await inventoryByItemKey(db, kid.child.id))["chart-piece"]).toBe(5);
    await submit(kid, "reef-chart-puzzle", { moves: CHART_ROUTE });
    expect((await inventoryByItemKey(db, kid.child.id))["chart-piece"]).toBe(5);
  });

  it("the chart table is closed with fewer than five pieces: no attempt row, no progress", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 4);
    const view = await getPuzzleForChild(db, kid.ctx, {
      adventureKey: "pirate",
      chapterKey: "skull-reef",
      puzzleKey: "reef-chart-puzzle",
    });
    expect(view.gate).toEqual({ itemKey: "chart-piece", quantity: 5, met: false });
    await expect(submit(kid, "reef-chart-puzzle", { moves: CHART_ROUTE })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await attemptsFor(kid, "reef-chart-puzzle")).toBe(0);
  });

  it("accepts any safe route, refuses reefs, edges and partial routes, and the view hides every route", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 5);
    const params = {
      adventureKey: "pirate",
      chapterKey: "skull-reef",
      puzzleKey: "reef-chart-puzzle",
    };
    const view = await getPuzzleForChild(db, kid.ctx, params);
    expect(view.type).toBe("route-plan");
    expect(view.gate?.met).toBe(true);
    expect(Object.keys(view.view).sort()).toEqual([
      "goal",
      "height",
      "hint",
      "reefs",
      "start",
      "width",
    ]);
    expect(JSON.stringify(view)).not.toMatch(/"(moves|path|route|solution)"/);

    for (const bad of [
      { moves: ["right", "right"] }, // (2,4) is a reef
      { moves: ["up", "up"] }, // (0,2) is a reef
      { moves: ["left"] }, // off the board
      { moves: CHART_ROUTE.slice(0, 6) }, // partial
      { moves: ["up-right"] },
      { moves: [] },
      "nonsense",
      null,
    ]) {
      expect((await submit(kid, "reef-chart-puzzle", bad)).correct).toBe(false);
    }
    expect(await attemptsFor(kid, "reef-chart-puzzle")).toBe(8);
    expect((await submit(kid, "reef-chart-puzzle", { moves: CHART_ROUTE_TWO })).correct).toBe(true);
    expect((await getPuzzleForChild(db, kid.ctx, params)).solved).toBe(true);
    expect((await submit(kid, "reef-chart-puzzle", { moves: CHART_ROUTE })).alreadyCompleted).toBe(
      true,
    );
  });

  it("solving the chart finishes the first quest and opens the Kraken quest", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    const before = (await getWallets(db, kid.child.id)).COINS;
    await chartTheReef(h, kid);
    expect((await questStatus(kid, "navigate-the-reef")).status).toBe("CLAIMED");
    const kraken = await questStatus(kid, "defeat-the-kraken");
    expect(kraken.status).toBe("ACTIVE");
    expect(kraken.objectives.map((o) => [o.key, o.available])).toEqual([
      ["read-the-tentacles", true],
      ["find-the-weak-points", false],
      ["steer-to-safety", false],
    ]);
    // 5 chores (25), puzzle 20, quest 40.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 25 + 20 + 40);
  });
});

describe("Skull Reef: the Kraken's three stages", () => {
  it("a stage of the Kraken quest cannot be solved while the quest is still locked", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    // Regression for ADR 0020: this used to pay out and be marked solved without advancing any objective.
    for (const [key, answer] of [
      ["kraken-tentacles", TENTACLES],
      ["kraken-weak-points", WEAK_POINTS],
      ["kraken-escape", { moves: ESCAPE_ROUTE }],
    ] as const) {
      await expect(submit(kid, key, answer)).rejects.toMatchObject({
        code: "INVALID_STATE",
        message: expect.stringContaining("Navigate the Reef") as unknown as string,
      });
      expect(await attemptsFor(kid, key)).toBe(0);
    }
    const coins = (await getWallets(db, kid.child.id)).COINS;
    expect(coins).toBe(15);
  });

  it("later stages cannot be submitted early, and each stage pays once, in order", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await chartTheReef(h, kid);

    // Stage 2 and 3 are refused before stage 1: no attempt rows, no reward.
    const coins = (await getWallets(db, kid.child.id)).COINS;
    await expect(submit(kid, "kraken-weak-points", WEAK_POINTS)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(submit(kid, "kraken-escape", { moves: ESCAPE_ROUTE })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await attemptsFor(kid, "kraken-weak-points")).toBe(0);
    expect(await attemptsFor(kid, "kraken-escape")).toBe(0);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coins);

    // Stage 1: a wrong pattern first.
    expect((await submit(kid, "kraken-tentacles", { sequence: ["Snap", "Coil"] })).correct).toBe(
      false,
    );
    expect((await submit(kid, "kraken-tentacles", TENTACLES)).correct).toBe(true);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coins + 10);

    // Stage 3 still waits for stage 2.
    await expect(submit(kid, "kraken-escape", { moves: ESCAPE_ROUTE })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(
      (
        await submit(kid, "kraken-weak-points", {
          pairs: { ...WEAK_POINTS.pairs, eye: "net", tentacle: "glass" },
        })
      ).correct,
    ).toBe(false);
    expect((await submit(kid, "kraken-weak-points", WEAK_POINTS)).correct).toBe(true);
    expect((await questStatus(kid, "defeat-the-kraken")).status).toBe("ACTIVE");

    // Stage 3: a route through a reef fails, the real one wins and finishes the quest.
    expect((await submit(kid, "kraken-escape", { moves: ["right", "right"] })).correct).toBe(false);
    const verdict = await submit(kid, "kraken-escape", { moves: ESCAPE_ROUTE });
    expect(verdict.correct).toBe(true);
    const kraken = await questStatus(kid, "defeat-the-kraken");
    expect(kraken.status).toBe("CLAIMED");
    expect(kraken.objectives.every((o) => o.completed)).toBe(true);
    // 10 + 15 + 20 for the stages, 60 for the quest.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coins + 10 + 15 + 20 + 60);
    expect((await inventoryByItemKey(db, kid.child.id))["kraken-tooth"]).toBe(1);

    // Nothing was ever spent: the chart pieces are still in the hold.
    expect((await inventoryByItemKey(db, kid.child.id))["chart-piece"]).toBe(5);
    expect(
      await db.rewardLedgerEntry.count({
        where: { childId: kid.child.id, amount: { lt: 0 }, sourceType: { not: "PURCHASE" } },
      }),
    ).toBe(0);
  });

  it("views of the pair and sequence stages never carry their answers", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await chartTheReef(h, kid);
    for (const key of ["kraken-tentacles", "kraken-weak-points", "kraken-escape"]) {
      const view = await getPuzzleForChild(db, kid.ctx, {
        adventureKey: "pirate",
        chapterKey: "skull-reef",
        puzzleKey: key,
      });
      expect(JSON.stringify(view)).not.toMatch(/"(pairs|sequence|moves|solution)"/);
    }
  });
});

describe("Skull Reef: the whole chapter", () => {
  it("finishes, claims its reward once, and unlocks Whispering Jungle", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "HYGIENE");
    await h.approve(kid.child.id, "SCHOOL");
    await h.approve(kid.child.id, "CHORE", 3);
    expect((await questStatus(kid, "reef-scavengers")).status).toBe("CLAIMED");
    await submit(kid, "reef-chart-puzzle", { moves: CHART_ROUTE });
    expect((await statusOf(kid.ctx, "skull-reef")).status).toBe("UNLOCKED");
    await submit(kid, "kraken-tentacles", TENTACLES);
    await submit(kid, "kraken-weak-points", WEAK_POINTS);
    expect((await statusOf(kid.ctx, "whispering-jungle")).status).toBe("LOCKED");
    await submit(kid, "kraken-escape", { moves: ESCAPE_ROUTE });

    const reef = await statusOf(kid.ctx, "skull-reef");
    expect(reef.status).toBe("COMPLETED");
    // Whispering Jungle opens (it has its own content since ADR 0021; see whispering-jungle.test.ts).
    const jungle = await statusOf(kid.ctx, "whispering-jungle");
    expect(jungle.status).toBe("UNLOCKED");
    expect(jungle.definitionStatus).toBe("PLAYABLE");

    const before = await getWallets(db, kid.child.id);
    const fragments = (await inventoryByItemKey(db, kid.child.id))["map-fragment"] ?? 0;
    const results = await Promise.all([
      claimChapterReward(db, kid.ctx, reef.id),
      claimChapterReward(db, kid.ctx, reef.id),
      claimChapterReward(db, kid.ctx, reef.id),
    ]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before.COINS + 125);
    expect((await getWallets(db, kid.child.id)).XP).toBe(before.XP + 250);
    expect((await inventoryByItemKey(db, kid.child.id))["map-fragment"]).toBe(fragments + 1);
  });

  it("the side quest is optional: the chapter completes without it", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await chartTheReef(h, kid);
    await submit(kid, "kraken-tentacles", TENTACLES);
    await submit(kid, "kraken-weak-points", WEAK_POINTS);
    await submit(kid, "kraken-escape", { moves: ESCAPE_ROUTE });
    const reef = await statusOf(kid.ctx, "skull-reef");
    expect(reef.status).toBe("COMPLETED");
    expect(reef.quests.find((q) => q.key === "reef-scavengers")!.status).toBe("ACTIVE");
  });

  it("the side quest counts hygiene and school chores, not helping", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "HELPING");
    expect((await questStatus(kid, "reef-scavengers")).objectives[0]!.currentCount).toBe(0);
    await h.approve(kid.child.id, "HYGIENE");
    await h.approve(kid.child.id, "SCHOOL");
    expect((await questStatus(kid, "reef-scavengers")).status).toBe("CLAIMED");
  });
});

describe("Skull Reef: siblings and other households", () => {
  it("one child's chart pieces, attempts and stages never leak into a sibling's", async () => {
    const h = await atTheReef(["Ada", "Bo"]);
    const [a, b] = h.kids as [Kid, Kid];
    await chartTheReef(h, a);
    await submit(a, "kraken-tentacles", TENTACLES);

    // Bo holds none of Ada's pieces, cannot use the chart table, and the Kraken is still locked for Bo.
    expect((await inventoryByItemKey(db, b.child.id))["chart-piece"]).toBeUndefined();
    await expect(submit(b, "reef-chart-puzzle", { moves: CHART_ROUTE })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(submit(b, "kraken-tentacles", TENTACLES)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(
      await db.puzzleAttempt.count({
        where: { childId: b.child.id, puzzleId: await puzzleId("kraken-tentacles") },
      }),
    ).toBe(0);

    const bState = await statusOf(b.ctx, "skull-reef");
    expect(bState.quests.find((q) => q.key === "defeat-the-kraken")!.status).toBe("LOCKED");
    expect((await questStatus(a, "defeat-the-kraken")).objectives[0]!.completed).toBe(true);
    expect(
      (
        await getPuzzleForChild(db, b.ctx, {
          adventureKey: "pirate",
          chapterKey: "skull-reef",
          puzzleKey: "kraken-tentacles",
        })
      ).solved,
    ).toBe(false);
  });

  it("a child who has not reached Skull Reef cannot read or play its puzzles", async () => {
    const h = await atTheReef();
    const other = await household(["Eve"]);
    const eve = other.kids[0]!;
    expect(h.kids).toHaveLength(1);
    for (const key of ["reef-chart-puzzle", "kraken-tentacles", "kraken-escape"]) {
      await expect(
        getPuzzleForChild(db, eve.ctx, {
          adventureKey: "pirate",
          chapterKey: "skull-reef",
          puzzleKey: key,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(submit(eve, key, { moves: ESCAPE_ROUTE })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });
});

describe("Skull Reef: puzzle race", () => {
  it("parallel correct submissions of the route puzzle grant the reward exactly once", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 5);
    const id = await puzzleId("reef-chart-puzzle");
    const before = (await getWallets(db, kid.child.id)).COINS;

    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitPuzzleAnswer(db, kid.ctx, id, { moves: CHART_ROUTE })),
    );
    expect(results.every((r) => r.correct)).toBe(true);
    expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: id } })).toBe(
      1,
    );
    // Puzzle reward (20) and quest reward (40), once each.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 20 + 40);
    expect(
      await db.rewardLedgerEntry.count({
        where: {
          childId: kid.child.id,
          currency: "COINS",
          sourceKey: { startsWith: `puzzle:` },
          description: { contains: "Reef Chart" },
        },
      }),
    ).toBe(1);
  });

  it("parallel submissions of the first Kraken stage also pay once", async () => {
    const h = await atTheReef();
    const kid = h.kids[0]!;
    await chartTheReef(h, kid);
    const id = await puzzleId("kraken-tentacles");
    const before = (await getWallets(db, kid.child.id)).COINS;
    const results = await Promise.all(
      Array.from({ length: 6 }, () => submitPuzzleAnswer(db, kid.ctx, id, TENTACLES)),
    );
    expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 10);
  });
});

describe("ensure step: children who unlocked Skull Reef when it was a placeholder", () => {
  const url = () => process.env.TEST_DATABASE_URL as string;

  /** Put the database back to what the placeholder chapter looked like before this slice (unlocks on the cove alone). */
  async function revertToPlaceholder() {
    const chapter = await db.adventureChapter.findFirstOrThrow({ where: { key: "skull-reef" } });
    await db.adventureQuest.deleteMany({ where: { chapterId: chapter.id } });
    await db.puzzleDefinition.deleteMany({ where: { chapterId: chapter.id } });
    await db.adventureChapter.update({
      where: { id: chapter.id },
      data: {
        status: "PLACEHOLDER",
        config: {
          unlock: { requires: [{ type: "CHAPTER_COMPLETED", chapterKey: "shipwreck-cove" }] },
          completion: { requiresQuestKeys: [] },
          rewards: { coins: 125, xp: 250, items: [{ itemKey: "map-fragment", quantity: 1 }] },
          mapMarker: { x: 66, y: 40 },
          locations: [],
        },
      },
    });
    return chapter.id;
  }

  it("old data first, then the new theme data: they keep the chapter, get their rows, and can play it through", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const reefId = await revertToPlaceholder();
      await finishShipwreckCove(h, kid); // the placeholder opens on the cove alone: no voyager needed
      const cp = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: kid.child.id, chapterId: reefId },
      });
      expect(cp.status).toBe("UNLOCKED");
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: reefId } },
        }),
      ).toBe(0);

      await seedReferenceData(url()); // the new theme data arrives

      // Grandfathered: unlocked without the voyager, and not revoked by the new requirement.
      expect((await inventoryByItemKey(db, kid.child.id))["ship-voyager"]).toBeUndefined();
      expect((await statusOf(kid.ctx, "skull-reef")).status).toBe("UNLOCKED");
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: reefId } },
        }),
      ).toBe(0); // reading state invents nothing

      // The first quest and the side quest get rows; the Kraken quest waits for the chart, as for everyone.
      const first = await ensureAdventureProgressForChild(db, kid.ctx, "pirate");
      expect(first).toEqual({ questsActivated: 2, objectiveRows: 0 });
      expect(await ensureAdventureProgressForChild(db, kid.ctx, "pirate")).toEqual({
        questsActivated: 0,
        objectiveRows: 0,
      });
      const reef = await statusOf(kid.ctx, "skull-reef");
      expect(reef.quests.map((q) => [q.key, q.status])).toEqual([
        ["navigate-the-reef", "ACTIVE"],
        ["defeat-the-kraken", "LOCKED"],
        ["reef-scavengers", "ACTIVE"],
      ]);
      // Whispering Jungle was never reached by this child: untouched.
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapter: { key: "whispering-jungle" } } },
        }),
      ).toBe(0);

      // They can play it all the way through, and the voyager was never needed.
      await chartTheReef(h, kid);
      await submit(kid, "kraken-tentacles", TENTACLES);
      await submit(kid, "kraken-weak-points", WEAK_POINTS);
      await submit(kid, "kraken-escape", { moves: ESCAPE_ROUTE });
      expect((await statusOf(kid.ctx, "skull-reef")).status).toBe("COMPLETED");
    } finally {
      await seedReferenceData(url());
    }
  });

  it("the completion pipeline heals a child by itself, and the Kraken quest still waits for the chart", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const reefId = await revertToPlaceholder();
      await finishShipwreckCove(h, kid);
      await seedReferenceData(url());
      await h.approve(kid.child.id, "CHORE", 2);
      expect((await inventoryByItemKey(db, kid.child.id))["chart-piece"]).toBe(2);
      const rows = await db.questProgress.findMany({
        where: { childId: kid.child.id, quest: { chapterId: reefId } },
        include: { quest: { select: { key: true } } },
      });
      expect(rows.map((r) => [r.quest.key, r.status]).sort()).toEqual([
        ["navigate-the-reef", "ACTIVE"],
        ["reef-scavengers", "ACTIVE"],
      ]);
      // And the locked-quest rule holds for them too.
      await expect(submit(kid, "kraken-tentacles", TENTACLES)).rejects.toMatchObject({
        code: "INVALID_STATE",
      });
    } finally {
      await seedReferenceData(url());
    }
  });
});
