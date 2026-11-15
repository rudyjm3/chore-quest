import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  claimChapterReward,
  getAdventureState,
  getPuzzleForChild,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { ensureAdventureProgressForChild } from "@/server/services/chapter-unlock.service";
import { inventoryByItemKey } from "@/server/services/inventory.service";
import { getLocationStatus, visitLocation } from "@/server/services/location.service";
import { getWallets } from "@/server/services/reward.service";

import { seedReferenceData } from "../../prisma/seed";
import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import {
  buyShip,
  chapterId,
  finishSkullReef,
  finishWhisperingJungle,
  household,
  puzzleId,
  type Household,
} from "../helpers/pirate";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

type Kid = Household["kids"][number];

/** The unique ordering the ruins' clues allow, the glyph meanings and a safe way through the maze. */
const RUINS = { order: ["statue", "idol", "bowl", "mask", "key"] };
const GLYPHS = {
  pairs: { sun: "day", moon: "night", snake: "danger", wave: "water", flame: "warmth" },
};
const MAZE = {
  moves: ["up", "up", "right", "up", "right", "right", "right", "right", "right", "up", "up", "up"],
};

const statusOf = async (ctx: Parameters<typeof getAdventureState>[1], chapterKey: string) =>
  (await getAdventureState(db, ctx, "pirate")).chapters.find((c) => c.key === chapterKey)!;
const questOf = async (kid: Kid, key: string) =>
  (await statusOf(kid.ctx, "whispering-jungle")).quests.find((q) => q.key === key)!;
const submit = async (kid: Kid, key: string, answer: unknown) =>
  submitPuzzleAnswer(db, kid.ctx, await puzzleId(key), answer);
const attemptsFor = async (kid: Kid, key: string) =>
  db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: await puzzleId(key) } });
const held = async (kid: Kid) => inventoryByItemKey(db, kid.child.id);

/** Skull Reef finished and claimed, so Whispering Jungle is open. */
async function atTheJungle(names?: string[]) {
  const h = await household(names);
  for (const kid of h.kids) await finishSkullReef(h, kid);
  return h;
}

/** Six chores: the three artifacts and the end of the last search. */
async function findArtifacts(h: Household, kid: Kid, chores = 6) {
  await h.approve(kid.child.id, "CHORE", chores);
}

describe("Whispering Jungle: unlock and economy (ADR 0021)", () => {
  it("opens when Skull Reef is completed, with no ship needed; the captain stays out of reach", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    const jungle = await statusOf(kid.ctx, "whispering-jungle");
    expect(jungle.status).toBe("UNLOCKED");
    expect(jungle.definitionStatus).toBe("PLAYABLE");
    expect(jungle.missingRequirements).toEqual([]);
    const config = (
      await db.adventureChapter.findFirstOrThrow({ where: { key: "whispering-jungle" } })
    ).config as { unlock: { requires: Array<{ type: string }> } };
    expect(config.unlock.requires).toEqual([
      { type: "CHAPTER_COMPLETED", chapterKey: "skull-reef" },
    ]);

    // Measured: 520 coins after buying the explorer (150) and voyager (400) and claiming every reward
    // (it was 330 before ADR 0022 raised the reef rewards). The jungle needs no ship (ADR 0021).
    const coins = (await getWallets(db, kid.child.id)).COINS;
    expect(coins).toBe(520);
    const captain = await db.itemDefinition.findUniqueOrThrow({ where: { key: "ship-captain" } });
    expect((captain.config as { costCoins: number }).costCoins).toBe(800);
    expect((await held(kid))["ship-captain"]).toBeUndefined();
  });

  it("starts with the first quest and the side quest active and the temple quest waiting", async () => {
    const h = await atTheJungle();
    const jungle = await statusOf(h.kids[0]!.ctx, "whispering-jungle");
    expect(jungle.quests.map((q) => [q.key, q.status])).toEqual([
      ["follow-the-clues", "ACTIVE"],
      ["open-the-temple", "LOCKED"],
      ["jungle-explorers", "ACTIVE"],
    ]);
  });
});

describe("Whispering Jungle: artifacts are held items found one after the other", () => {
  it("each artifact comes from its own chain of chores, once, and is never spent", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 1);
    expect(await held(kid)).toMatchObject({ "jade-idol": 1 });
    expect((await held(kid))["stone-mask"]).toBeUndefined();
    await h.approve(kid.child.id, "CHORE", 1);
    expect((await held(kid))["stone-mask"]).toBeUndefined(); // the second chore finishes the idol search
    await h.approve(kid.child.id, "CHORE", 1);
    expect((await held(kid))["stone-mask"]).toBe(1);
    await h.approve(kid.child.id, "CHORE", 3);
    const inventory = await held(kid);
    expect([inventory["jade-idol"], inventory["stone-mask"], inventory["sun-key"]]).toEqual([
      1, 1, 1,
    ]);

    const quest = await questOf(kid, "follow-the-clues");
    expect(quest.objectives.map((o) => [o.key, o.completed])).toEqual([
      ["find-the-idol", true],
      ["find-the-mask", true],
      ["find-the-key", true],
      ["read-the-ruins", false],
    ]);
    // More chores add no artifacts.
    await h.approve(kid.child.id, "CHORE", 2);
    expect((await held(kid))["jade-idol"]).toBe(1);
  });
});

describe("Whispering Jungle: the ruins need all three artifacts", () => {
  const params = {
    adventureKey: "pirate",
    chapterKey: "whispering-jungle",
    puzzleKey: "ruins-puzzle",
  };

  it("stays closed while any artifact is missing, naming it, and writes no attempt row", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await h.approve(kid.child.id, "CHORE", 4); // idol and mask
    const view = await getPuzzleForChild(db, kid.ctx, params);
    expect(view.gates).toEqual([
      { itemKey: "jade-idol", quantity: 1, met: true },
      { itemKey: "stone-mask", quantity: 1, met: true },
      { itemKey: "sun-key", quantity: 1, met: false },
    ]);
    expect(view.gate).toEqual({ itemKey: "sun-key", quantity: 1, met: false });
    await expect(submit(kid, "ruins-puzzle", RUINS)).rejects.toMatchObject({
      code: "INVALID_STATE",
      message: expect.stringContaining("Sun Key") as unknown as string,
    });
    expect(await attemptsFor(kid, "ruins-puzzle")).toBe(0);
  });

  it("the gate reads what is held now: losing one artifact closes it again", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await findArtifacts(h, kid, 5);
    await db.childInventoryItem.updateMany({
      where: { childId: kid.child.id, item: { key: "stone-mask" } },
      data: { quantity: 0 },
    });
    await expect(submit(kid, "ruins-puzzle", RUINS)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await attemptsFor(kid, "ruins-puzzle")).toBe(0);
  });

  it("opens with all three; the view hides the order; only the one right order is accepted", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await findArtifacts(h, kid, 5);
    const view = await getPuzzleForChild(db, kid.ctx, params);
    expect(view.type).toBe("clue-order");
    expect(view.gates.every((g) => g.met)).toBe(true);
    expect(Object.keys(view.view).sort()).toEqual(["clues", "hint", "items", "slots"]);
    expect(JSON.stringify(view)).not.toMatch(/"(order|solution|rule)"/);

    for (const bad of [
      { order: [...RUINS.order].reverse() },
      { order: RUINS.order.slice(0, 4) },
      { order: ["idol", "idol", "bowl", "mask", "key"] },
      { order: ["statue", "idol", "bowl", "mask", "nope"] },
      {},
      null,
      "nonsense",
    ]) {
      expect((await submit(kid, "ruins-puzzle", bad)).correct).toBe(false);
    }
    expect(await attemptsFor(kid, "ruins-puzzle")).toBe(7);
    const before = (await getWallets(db, kid.child.id)).COINS;
    expect((await submit(kid, "ruins-puzzle", RUINS)).correct).toBe(true);
    // Puzzle reward (25) and the Clue Reader achievement (50).
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 25 + 50);
    expect((await submit(kid, "ruins-puzzle", RUINS)).alreadyCompleted).toBe(true);
    // Held, not spent.
    const inventory = await held(kid);
    expect([inventory["jade-idol"], inventory["stone-mask"], inventory["sun-key"]]).toEqual([
      1, 1, 1,
    ]);
  });

  it("finishing the last search after the puzzle completes the first quest and opens the temple", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await findArtifacts(h, kid, 5);
    await submit(kid, "ruins-puzzle", RUINS);
    expect((await questOf(kid, "follow-the-clues")).status).toBe("ACTIVE");
    expect((await questOf(kid, "open-the-temple")).status).toBe("LOCKED");
    await h.approve(kid.child.id, "CHORE", 1);
    expect((await questOf(kid, "follow-the-clues")).status).toBe("CLAIMED");
    expect((await questOf(kid, "open-the-temple")).status).toBe("ACTIVE");
  });
});

describe("Whispering Jungle: the temple in two steps", () => {
  it("a temple stage cannot be solved while the temple quest has not started", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    for (const [key, answer] of [
      ["temple-glyphs", GLYPHS],
      ["temple-maze", MAZE],
    ] as const) {
      await expect(submit(kid, key, answer)).rejects.toMatchObject({
        code: "INVALID_STATE",
        message: expect.stringContaining("Follow the Clues") as unknown as string,
      });
      expect(await attemptsFor(kid, key)).toBe(0);
    }
  });

  it("stages go in order, each pays once, and nothing is ever spent", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await findArtifacts(h, kid);
    await submit(kid, "ruins-puzzle", RUINS);
    const coins = (await getWallets(db, kid.child.id)).COINS;

    await expect(submit(kid, "temple-maze", MAZE)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await attemptsFor(kid, "temple-maze")).toBe(0);
    const wrong = { pairs: { ...GLYPHS.pairs, sun: "night", moon: "day" } };
    expect((await submit(kid, "temple-glyphs", wrong)).correct).toBe(false);
    expect((await submit(kid, "temple-glyphs", GLYPHS)).correct).toBe(true);
    expect((await submit(kid, "temple-maze", { moves: ["right", "right"] })).correct).toBe(false);
    expect((await submit(kid, "temple-maze", MAZE)).correct).toBe(true);

    const temple = await questOf(kid, "open-the-temple");
    expect(temple.status).toBe("CLAIMED");
    // glyphs 20 + maze 25 + Temple Explorer 50 + temple quest 110
    expect((await getWallets(db, kid.child.id)).COINS).toBe(coins + 20 + 25 + 50 + 110);
    expect(
      await db.rewardLedgerEntry.count({
        where: { childId: kid.child.id, amount: { lt: 0 }, sourceType: { not: "PURCHASE" } },
      }),
    ).toBe(0);
  });
});

describe("Whispering Jungle: the whole chapter", () => {
  it("completes, pays its reward once, and Treasure Island then needs only the legendary ship", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await findArtifacts(h, kid);
    await submit(kid, "ruins-puzzle", RUINS);
    await submit(kid, "temple-glyphs", GLYPHS);
    await submit(kid, "temple-maze", MAZE);

    const jungle = await statusOf(kid.ctx, "whispering-jungle");
    expect(jungle.status).toBe("COMPLETED");
    expect(jungle.quests.find((q) => q.key === "jungle-explorers")!.status).toBe("ACTIVE"); // optional
    // Four map fragments so far (the jungle's own is paid on the claim): Treasure Island still needs one.
    expect((await held(kid))["map-fragment"]).toBe(4);
    const locked = await statusOf(kid.ctx, "treasure-island");
    expect(locked.status).toBe("LOCKED");
    expect(locked.missingRequirements).toEqual([
      { type: "ITEM", itemKey: "map-fragment", quantity: 5 },
      { type: "ITEM", itemKey: "ship-legendary", quantity: 1 },
    ]);

    const before = await getWallets(db, kid.child.id);
    const results = await Promise.all([
      claimChapterReward(db, kid.ctx, jungle.id),
      claimChapterReward(db, kid.ctx, jungle.id),
      claimChapterReward(db, kid.ctx, jungle.id),
    ]);
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    const after = await getWallets(db, kid.child.id);
    expect(after.COINS).toBe(before.COINS + 200);
    expect(after.XP).toBe(before.XP + 300);
    expect((await held(kid))["map-fragment"]).toBe(5);

    // The fifth fragment arrived with the claim; only the ship is still missing (ADR 0022).
    const island = await statusOf(kid.ctx, "treasure-island");
    expect(island.status).toBe("LOCKED");
    expect(island.missingRequirements).toEqual([
      { type: "ITEM", itemKey: "ship-legendary", quantity: 1 },
    ]);
  });
});

describe("Whispering Jungle: siblings and other households", () => {
  it("one child's artifacts, attempts and temple never leak into a sibling's", async () => {
    const h = await atTheJungle(["Ada", "Bo"]);
    const [a, b] = h.kids as [Kid, Kid];
    await findArtifacts(h, a);
    await submit(a, "ruins-puzzle", RUINS);
    await submit(a, "temple-glyphs", GLYPHS);

    expect((await held(b))["jade-idol"]).toBeUndefined();
    await expect(submit(b, "ruins-puzzle", RUINS)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(submit(b, "temple-glyphs", GLYPHS)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await attemptsFor(b, "ruins-puzzle")).toBe(0);
    expect(await attemptsFor(b, "temple-glyphs")).toBe(0);
    expect((await questOf(b, "open-the-temple")).status).toBe("LOCKED");
    expect(
      (
        await getPuzzleForChild(db, b.ctx, {
          adventureKey: "pirate",
          chapterKey: "whispering-jungle",
          puzzleKey: "ruins-puzzle",
        })
      ).solved,
    ).toBe(false);
  });

  it("a child who has not reached the jungle cannot read or play its puzzles", async () => {
    const h = await atTheJungle();
    const other = await household(["Eve"]);
    const eve = other.kids[0]!;
    expect(h.kids).toHaveLength(1);
    for (const key of ["ruins-puzzle", "temple-glyphs", "temple-maze"]) {
      await expect(
        getPuzzleForChild(db, eve.ctx, {
          adventureKey: "pirate",
          chapterKey: "whispering-jungle",
          puzzleKey: key,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(submit(eve, key, RUINS)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("Whispering Jungle: puzzle race", () => {
  it("parallel correct submissions of the ruins puzzle grant the reward exactly once", async () => {
    const h = await atTheJungle();
    const kid = h.kids[0]!;
    await findArtifacts(h, kid);
    const id = await puzzleId("ruins-puzzle");
    const before = (await getWallets(db, kid.child.id)).COINS;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitPuzzleAnswer(db, kid.ctx, id, RUINS)),
    );
    expect(results.every((r) => r.correct)).toBe(true);
    expect(results.filter((r) => !r.alreadyCompleted)).toHaveLength(1);
    expect(await db.puzzleAttempt.count({ where: { childId: kid.child.id, puzzleId: id } })).toBe(
      1,
    );
    // Puzzle reward (25), the first quest's reward (70) and the Clue Reader achievement (50), once each.
    expect((await getWallets(db, kid.child.id)).COINS).toBe(before + 25 + 70 + 50);
  });
});

describe("multi-item gates on a place with a one-time reward", () => {
  const url = () => process.env.TEST_DATABASE_URL as string;

  it("the hidden cove can need two things at once, read from what is held now", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    const params = { adventureKey: "pirate", chapterKey: "home-port", locationKey: "hidden-cove" };
    try {
      const chapter = await db.adventureChapter.findFirstOrThrow({ where: { key: "home-port" } });
      const config = chapter.config as { locations: Array<{ key: string }> };
      const changed = JSON.parse(
        JSON.stringify({
          ...config,
          locations: config.locations.map((l) =>
            l.key === "hidden-cove"
              ? { ...l, requiresItems: [{ itemKey: "supply-crate", quantity: 3 }] }
              : l,
          ),
        }),
      ) as Record<string, never>;
      await db.adventureChapter.update({ where: { id: chapter.id }, data: { config: changed } });

      await h.approve(kid.child.id, "CHORE", 3); // three crates, no map fragment yet
      expect(await getLocationStatus(db, kid.ctx, params)).toMatchObject({
        status: "locked",
        requiresItemKey: "map-fragment",
      });
      await claimChapterReward(db, kid.ctx, await chapterId("home-port")); // the fragment
      expect(await getLocationStatus(db, kid.ctx, params)).toMatchObject({ status: "available" });

      await db.childInventoryItem.updateMany({
        where: { childId: kid.child.id, item: { key: "supply-crate" } },
        data: { quantity: 2 },
      });
      expect(await getLocationStatus(db, kid.ctx, params)).toMatchObject({
        status: "locked",
        requiresItemKey: "supply-crate",
        requiresItemQuantity: 3,
      });
      await expect(visitLocation(db, kid.ctx, params)).rejects.toMatchObject({
        code: "INVALID_STATE",
      });
      await db.childInventoryItem.updateMany({
        where: { childId: kid.child.id, item: { key: "supply-crate" } },
        data: { quantity: 3 },
      });
      expect((await visitLocation(db, kid.ctx, params)).granted).toBe(true);
    } finally {
      await seedReferenceData(url());
    }
  });
});

describe("ensure step: children who unlocked Whispering Jungle when it was a placeholder", () => {
  const url = () => process.env.TEST_DATABASE_URL as string;

  /** Put the database back to what the placeholder chapter looked like before this slice (unlocks on the reef alone). */
  async function revertToPlaceholder() {
    const chapter = await db.adventureChapter.findFirstOrThrow({
      where: { key: "whispering-jungle" },
    });
    await db.adventureQuest.deleteMany({ where: { chapterId: chapter.id } });
    await db.puzzleDefinition.deleteMany({ where: { chapterId: chapter.id } });
    await db.adventureChapter.update({
      where: { id: chapter.id },
      data: {
        status: "PLACEHOLDER",
        config: {
          unlock: { requires: [{ type: "CHAPTER_COMPLETED", chapterKey: "skull-reef" }] },
          completion: { requiresQuestKeys: [] },
          rewards: { coins: 150, xp: 300, items: [{ itemKey: "map-fragment", quantity: 1 }] },
          mapMarker: { x: 80, y: 58 },
          locations: [],
        },
      },
    });
    return chapter.id;
  }

  it("old data first, then the new theme data: they keep the chapter, get their rows and can play it through", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const jungleId = await revertToPlaceholder();
      await finishSkullReef(h, kid);
      const cp = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: kid.child.id, chapterId: jungleId },
      });
      expect(cp.status).toBe("UNLOCKED");
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: jungleId } },
        }),
      ).toBe(0);

      await seedReferenceData(url());

      expect((await statusOf(kid.ctx, "whispering-jungle")).status).toBe("UNLOCKED");
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapterId: jungleId } },
        }),
      ).toBe(0); // reading state invents nothing

      expect(await ensureAdventureProgressForChild(db, kid.ctx, "pirate")).toEqual({
        questsActivated: 2,
        objectiveRows: 0,
      });
      expect(await ensureAdventureProgressForChild(db, kid.ctx, "pirate")).toEqual({
        questsActivated: 0,
        objectiveRows: 0,
      });
      const jungle = await statusOf(kid.ctx, "whispering-jungle");
      expect(jungle.quests.map((q) => [q.key, q.status])).toEqual([
        ["follow-the-clues", "ACTIVE"],
        ["open-the-temple", "LOCKED"],
        ["jungle-explorers", "ACTIVE"],
      ]);
      // Treasure Island was never reached by this child: untouched.
      expect(
        await db.questProgress.count({
          where: { childId: kid.child.id, quest: { chapter: { key: "treasure-island" } } },
        }),
      ).toBe(0);

      await findArtifacts(h, kid);
      await submit(kid, "ruins-puzzle", RUINS);
      await submit(kid, "temple-glyphs", GLYPHS);
      await submit(kid, "temple-maze", MAZE);
      expect((await statusOf(kid.ctx, "whispering-jungle")).status).toBe("COMPLETED");
    } finally {
      await seedReferenceData(url());
    }
  });

  it("the completion pipeline heals a child by itself, and the temple still waits for the clues", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    try {
      const jungleId = await revertToPlaceholder();
      await finishSkullReef(h, kid);
      await seedReferenceData(url());
      await h.approve(kid.child.id, "CHORE", 1);
      expect((await held(kid))["jade-idol"]).toBe(1);
      const rows = await db.questProgress.findMany({
        where: { childId: kid.child.id, quest: { chapterId: jungleId } },
        include: { quest: { select: { key: true } } },
      });
      expect(rows.map((r) => [r.quest.key, r.status]).sort()).toEqual([
        ["follow-the-clues", "ACTIVE"],
        ["jungle-explorers", "ACTIVE"],
      ]);
      await expect(submit(kid, "temple-glyphs", GLYPHS)).rejects.toMatchObject({
        code: "INVALID_STATE",
      });
    } finally {
      await seedReferenceData(url());
    }
  });
});

describe("the legendary ship is affordable by the end of Whispering Jungle (ADR 0022)", () => {
  it("a child who buys only the explorer and voyager holds enough coins once the jungle reward is claimed", async () => {
    const h = await household();
    const kid = h.kids[0]!;
    await finishWhisperingJungle(h, kid);
    const price = (
      (await db.itemDefinition.findUniqueOrThrow({ where: { key: "ship-legendary" } })).config as {
        costCoins: number;
      }
    ).costCoins;
    // Measured: 330 after the reef became 520, and the jungle then adds 580 (chores, puzzles, achievements,
    // quests and the 200-coin chapter reward) for 1100. The 1000-coin legendary ship leaves 100 to spare.
    expect(price).toBe(1000);
    const coins = (await getWallets(db, kid.child.id)).COINS;
    expect(coins).toBe(1100);
    expect(coins).toBeGreaterThanOrEqual(price);
    // It is sold once the jungle is completed, and buying it needs no other ship.
    const bought = await buyShip(h, kid, "ship-legendary");
    expect(bought.replayed).toBe(false);
    expect((await getWallets(db, kid.child.id)).COINS).toBe(100);
  });
});
