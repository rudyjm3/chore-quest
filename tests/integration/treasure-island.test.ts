import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  claimChapterReward,
  getAdventureState,
  getPuzzleForChild,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { ensureAdventureProgressForChild } from "@/server/services/chapter-unlock.service";
import { equipCosmetic, getCrewCamp } from "@/server/services/crew-camp.service";
import { inventoryByItemKey } from "@/server/services/inventory.service";
import { listNotifications } from "@/server/services/notification.service";
import { getWallets } from "@/server/services/reward.service";

import { seedReferenceData } from "../../prisma/seed";
import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import {
  buyShip,
  chapterId,
  finishWhisperingJungle,
  household,
  puzzleId,
  type Household,
} from "../helpers/pirate";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

type Kid = Household["kids"][number];

const LOCK = { sequence: ["Anchor", "Skull", "Cannon", "Skull", "Compass"] };
const RUNES = { order: ["star", "skull", "crown", "flame", "wave"] };
const TRAPS = {
  moves: [
    ...["right", "right", "right", "up", "right", "up", "up"],
    ...["left", "left", "left", "up", "left", "up", "up", "up"],
    ...Array(7).fill("right"),
  ],
};

const statusOf = async (ctx: Parameters<typeof getAdventureState>[1], chapterKey: string) =>
  (await getAdventureState(db, ctx, "pirate")).chapters.find((c) => c.key === chapterKey)!;
const questOf = async (kid: Kid) =>
  (await statusOf(kid.ctx, "treasure-island")).quests.find((q) => q.key === "find-the-treasure")!;
const submit = async (kid: Kid, key: string, answer: unknown) =>
  submitPuzzleAnswer(db, kid.ctx, await puzzleId(key), answer);
const attemptsFor = async (kid: Kid, key: string) =>
  db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: await puzzleId(key) } });
const held = async (kid: Kid) => inventoryByItemKey(db, kid.child.id);

/** Whispering Jungle finished and claimed, legendary ship bought: Treasure Island is open. */
async function atTheIsland(names?: string[]) {
  const h = await household(names);
  for (const kid of h.kids) {
    await finishWhisperingJungle(h, kid);
    await buyShip(h, kid, "ship-legendary");
  }
  return h;
}

/** Six chores: the dig. */
const dig = (h: Household, kid: Kid) => h.approve(kid.child.id, "CHORE", 6);

describe("Treasure Island: the legendary ship gates the finale (ADR 0022)", () => {
  it("is locked until the legendary ship is bought, and the map says what is missing", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishWhisperingJungle(h, kid);
    const locked = await statusOf(kid.ctx, "treasure-island");
    expect(locked.status).toBe("LOCKED");
    expect(locked.missingRequirements).toEqual([
      { type: "ITEM", itemKey: "ship-legendary", quantity: 1 },
    ]);
    expect(locked.hint).toMatch(/Legendary Ship/);
    expect((await getAdventureState(db, kid.ctx, "pirate")).itemNames["ship-legendary"]).toBe(
      "Legendary Ship",
    );
    expect(
      await db.questProgress.count({
        where: { childId: kid.child.id, quest: { chapter: { key: "treasure-island" } } },
      }),
    ).toBe(0);
  });

  it("the ship cannot be bought before the jungle is completed", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 3);
    await expect(buyShip(h, kid, "ship-legendary")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("buying it unlocks the island in the same purchase and activates the finale quest", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    const island = await statusOf(kid.ctx, "treasure-island");
    expect(island.status).toBe("UNLOCKED");
    expect(island.definitionStatus).toBe("PLAYABLE");
    expect(island.missingRequirements).toEqual([]);
    expect(island.quests.map((q) => [q.key, q.status])).toEqual([["find-the-treasure", "ACTIVE"]]);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(100); // 1100 minus the 1000-coin ship
    expect((await held(kid))["map-fragment"]).toBe(5);
    expect((await buyShip(h, kid, "ship-legendary")).replayed).toBe(true);
  });
});

describe("Treasure Island: the dig and the three guards", () => {
  const params = {
    adventureKey: "pirate",
    chapterKey: "treasure-island",
    puzzleKey: "treasure-lock",
  };

  it("the dig site needs the map pieces held, now, and the stages wait for the dig", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    // Held, never spent: the pieces are all still there.
    expect((await getPuzzleForChild(db, kid.ctx, params)).gates).toEqual([
      { itemKey: "map-fragment", quantity: 5, met: true },
    ]);
    await db.childInventoryItem.updateMany({
      where: { childId: kid.child.id, item: { key: "map-fragment" } },
      data: { quantity: 4 },
    });
    const closed = await getPuzzleForChild(db, kid.ctx, params);
    expect(closed.gate).toEqual({ itemKey: "map-fragment", quantity: 5, met: false });
    await expect(submit(kid, "treasure-lock", LOCK)).rejects.toMatchObject({
      code: "INVALID_STATE",
      message: expect.stringContaining("Treasure Map Fragment") as unknown as string,
    });
    expect(await attemptsFor(kid, "treasure-lock")).toBe(0);

    await db.childInventoryItem.updateMany({
      where: { childId: kid.child.id, item: { key: "map-fragment" } },
      data: { quantity: 5 },
    });
    // Open, but the dig (6 chores) comes first.
    await expect(submit(kid, "treasure-lock", LOCK)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await attemptsFor(kid, "treasure-lock")).toBe(0);
  });

  it("the stages go in order, each pays once, nothing is spent, and the quest completes the chapter", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    await dig(h, kid);
    const coins = (await getWallets(db, kid.child.id)).COINS;

    for (const [key, answer] of [
      ["treasure-runes", RUNES],
      ["treasure-traps", TRAPS],
    ] as const) {
      await expect(submit(kid, key, answer)).rejects.toMatchObject({ code: "INVALID_STATE" });
      expect(await attemptsFor(kid, key)).toBe(0);
    }
    expect((await submit(kid, "treasure-lock", { sequence: ["Anchor", "Skull"] })).correct).toBe(
      false,
    );
    expect((await submit(kid, "treasure-lock", LOCK)).correct).toBe(true);

    await expect(submit(kid, "treasure-traps", TRAPS)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(
      (await submit(kid, "treasure-runes", { order: [...RUNES.order].reverse() })).correct,
    ).toBe(false);
    expect((await submit(kid, "treasure-runes", RUNES)).correct).toBe(true);

    expect(
      (await submit(kid, "treasure-traps", { moves: ["right", "right", "right", "right"] }))
        .correct,
    ).toBe(false);
    expect((await submit(kid, "treasure-traps", TRAPS)).correct).toBe(true);

    expect((await questOf(kid)).status).toBe("CLAIMED");
    expect((await statusOf(kid.ctx, "treasure-island")).status).toBe("COMPLETED");
    // 30 + 30 + 40 for the stages, 100 for the quest.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coins + 30 + 30 + 40 + 100);
    expect((await held(kid))["map-fragment"]).toBe(5);
    expect(
      await db.rewardLedgerEntry.count({
        where: { childId: kid.child.id, amount: { lt: 0 }, sourceType: { not: "PURCHASE" } },
      }),
    ).toBe(0);
  });

  it("the views of the lock, the runes and the traps never carry their answers", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    await dig(h, kid);
    await submit(kid, "treasure-lock", LOCK);
    for (const key of ["treasure-lock", "treasure-runes", "treasure-traps"]) {
      const view = await getPuzzleForChild(db, kid.ctx, { ...params, puzzleKey: key });
      expect(JSON.stringify(view.view)).not.toMatch(/"(order|solution|moves|path)"/);
    }
  });
});

describe("Treasure Island: the finale and the end of the campaign", () => {
  async function playIt(h: Household, kid: Kid) {
    await dig(h, kid);
    await submit(kid, "treasure-lock", LOCK);
    await submit(kid, "treasure-runes", RUNES);
    await submit(kid, "treasure-traps", TRAPS);
  }

  it("completing it ends the campaign, tells the parents once, and the reward pays once", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    expect((await getAdventureState(db, kid.ctx, "pirate")).campaignComplete).toBe(false);
    await playIt(h, kid);

    const state = await getAdventureState(db, kid.ctx, "pirate");
    expect(state.campaignComplete).toBe(true);
    const island = state.chapters.find((c) => c.key === "treasure-island")!;
    expect(island.status).toBe("COMPLETED");

    // One notification per parent, naming the child and the adventure and nothing else about them.
    const notes = (await listNotifications(db, h.ctx)).items.filter(
      (n) => n.kind === "ADVENTURE_COMPLETED",
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toBe("Ada finished The Lost Treasure of Blackbeard Bay!");

    const before = await getWallets(db, kid.child.id);
    const results = await Promise.all([
      claimChapterReward(db, kid.ctx, island.id),
      claimChapterReward(db, kid.ctx, island.id),
      claimChapterReward(db, kid.ctx, island.id),
    ]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    const after = await getWallets(db, kid.child.id);
    expect(after.COINS).toBe(before.COINS + 1000);
    expect(after.XP).toBe(before.XP + 2000); // the Legend achievement's XP was paid at completion
    const inventory = await held(kid);
    expect(inventory["map-fragment"]).toBe(6);
    expect(inventory["blackbeards-treasure"]).toBe(1);
    expect(inventory["cosmetic-blackbeards-flag"]).toBe(1);
    expect(
      await db.earnedAchievement.count({
        where: { childId: kid.child.id, achievement: { key: "pirate.legend" } },
      }),
    ).toBe(1);
  });

  it("parallel submissions of the last stage grant once and notify once", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    await dig(h, kid);
    await submit(kid, "treasure-lock", LOCK);
    await submit(kid, "treasure-runes", RUNES);
    const id = await puzzleId("treasure-traps");
    const before = (await getWallets(db, kid.child.id)).COINS;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitPuzzleAnswer(db, kid.ctx, id, TRAPS)),
    );
    expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: id } })).toBe(
      1,
    );
    // Puzzle (40) and quest (100) once each.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 40 + 100);
    expect(
      await db.notification.count({
        where: { familyId: h.family.id, kind: "ADVENTURE_COMPLETED" },
      }),
    ).toBe(1);
  });

  it("the flag can be worn on the ship once it is won", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    await playIt(h, kid);
    await claimChapterReward(db, kid.ctx, await chapterId("treasure-island"));
    await equipCosmetic(db, kid.ctx, {
      adventureKey: "pirate",
      slot: "flag",
      itemKey: "cosmetic-blackbeards-flag",
    });
    const camp = await getCrewCamp(db, kid.ctx, "pirate");
    expect(JSON.stringify(camp)).toContain("cosmetic-blackbeards-flag");
  });

  it("nobody is notified while the campaign is unfinished", async () => {
    const h = await household();
    await finishWhisperingJungle(h, h.kids[0]!);
    expect(
      await db.notification.count({
        where: { familyId: h.family.id, kind: "ADVENTURE_COMPLETED" },
      }),
    ).toBe(0);
  });
});

describe("Treasure Island: siblings and other households", () => {
  it("one child's progress never leaks into a sibling's, and only the finisher's parents hear", async () => {
    const h = await atTheIsland(["Ada", "Bo"]);
    const [a, b] = h.kids as [Kid, Kid];
    await dig(h, a);
    await submit(a, "treasure-lock", LOCK);
    await submit(a, "treasure-runes", RUNES);
    await submit(a, "treasure-traps", TRAPS);

    await expect(submit(b, "treasure-lock", LOCK)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await attemptsFor(b, "treasure-lock")).toBe(0);
    expect((await questOf(b)).status).toBe("ACTIVE");
    expect((await getAdventureState(db, b.ctx, "pirate")).campaignComplete).toBe(false);
    const notes = await db.notification.findMany({
      where: { familyId: h.family.id, kind: "ADVENTURE_COMPLETED" },
    });
    expect(notes.map((n) => n.title)).toEqual([
      "Ada finished The Lost Treasure of Blackbeard Bay!",
    ]);
  });

  it("a child who has not reached the island cannot read or play its puzzles", async () => {
    const h = await atTheIsland();
    const other = await household(["Eve"]);
    const eve = other.kids[0]!;
    expect(h.kids).toHaveLength(1);
    for (const key of ["treasure-lock", "treasure-runes", "treasure-traps"]) {
      await expect(
        getPuzzleForChild(db, eve.ctx, {
          adventureKey: "pirate",
          chapterKey: "treasure-island",
          puzzleKey: key,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(submit(eve, key, LOCK)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("Treasure Island: puzzle race", () => {
  it("parallel correct submissions of the lock grant its reward exactly once", async () => {
    const h = await atTheIsland();
    const kid = h.kids[0]!;
    await dig(h, kid);
    const id = await puzzleId("treasure-lock");
    const before = (await getWallets(db, kid.child.id)).COINS;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitPuzzleAnswer(db, kid.ctx, id, LOCK)),
    );
    expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: id } })).toBe(
      1,
    );
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 30);
  });
});

describe("ensure step: children who unlocked Treasure Island when it was a placeholder", () => {
  const url = () => process.env.TEST_DATABASE_URL as string;

  /** What the placeholder chapter looked like before this slice: it opened on the jungle and five fragments. */
  async function revertToPlaceholder() {
    const chapter = await db.adventureChapter.findFirstOrThrow({
      where: { key: "treasure-island" },
    });
    await db.adventureQuest.deleteMany({ where: { chapterId: chapter.id } });
    await db.puzzleDefinition.deleteMany({ where: { chapterId: chapter.id } });
    await db.adventureChapter.update({
      where: { id: chapter.id },
      data: {
        status: "PLACEHOLDER",
        config: {
          unlock: {
            requires: [
              { type: "CHAPTER_COMPLETED", chapterKey: "whispering-jungle" },
              { type: "ITEM", itemKey: "map-fragment", quantity: 5 },
            ],
          },
          completion: { requiresQuestKeys: [] },
          rewards: { coins: 500, xp: 1000, items: [{ itemKey: "map-fragment", quantity: 1 }] },
          mapMarker: { x: 90, y: 24 },
          locations: [],
        },
      },
    });
    return chapter.id;
  }

  it("old data first, then the new theme data: they keep the chapter without the ship, get their rows and can finish", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const islandId = await revertToPlaceholder();
      await finishWhisperingJungle(h, kid); // the placeholder opens with no ship
      const cp = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: kid.child.id, chapterId: islandId },
      });
      expect(cp.status).toBe("UNLOCKED");

      await seedReferenceData(url());

      expect((await held(kid))["ship-legendary"]).toBeUndefined();
      expect((await statusOf(kid.ctx, "treasure-island")).status).toBe("UNLOCKED");
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: islandId } },
        }),
      ).toBe(0); // reading state invents nothing

      expect(await ensureAdventureProgressForChild(db, kid.ctx, "pirate")).toEqual({
        questsActivated: 1,
        objectiveRows: 0,
      });
      expect(await ensureAdventureProgressForChild(db, kid.ctx, "pirate")).toEqual({
        questsActivated: 0,
        objectiveRows: 0,
      });
      expect((await questOf(kid)).status).toBe("ACTIVE");

      await dig(h, kid);
      await submit(kid, "treasure-lock", LOCK);
      await submit(kid, "treasure-runes", RUNES);
      await submit(kid, "treasure-traps", TRAPS);
      expect((await getAdventureState(db, kid.ctx, "pirate")).campaignComplete).toBe(true);
    } finally {
      await seedReferenceData(url());
    }
  });
});
