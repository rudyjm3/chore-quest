import { describe, expect, it } from "vitest";

import { adventureFinished, puzzleItemGates } from "@/game/engine";
import { getPuzzleVerifier } from "@/game/puzzles";
import { clueOrderPuzzle, clueOrderSolution } from "@/game/puzzles/clue-order";
import { pirateAdventure, pirateAssetManifest, pirateCrewCampScene } from "@/game/themes/pirate";

const island = pirateAdventure.chapters.find((c) => c.key === "treasure-island")!;

describe("adventureFinished", () => {
  it("needs at least one chapter and every one completed", () => {
    expect(adventureFinished([])).toBe(false);
    expect(adventureFinished(["COMPLETED", "COMPLETED"])).toBe(true);
    expect(adventureFinished(["COMPLETED", "UNLOCKED"])).toBe(false);
    expect(adventureFinished(["COMPLETED", "LOCKED"])).toBe(false);
    expect(adventureFinished(["COMPLETED", undefined])).toBe(false);
  });
});

describe("Treasure Island theme data", () => {
  it("is playable and needs the jungle, five map pieces and the legendary ship", () => {
    expect(island.status).toBe("PLAYABLE");
    expect(island.config.unlock.requires).toEqual([
      { type: "CHAPTER_COMPLETED", chapterKey: "whispering-jungle" },
      { type: "ITEM", itemKey: "map-fragment", quantity: 5 },
      { type: "ITEM", itemKey: "ship-legendary", quantity: 1 },
    ]);
    expect(island.config.completion.requiresQuestKeys).toEqual(["find-the-treasure"]);
  });

  it("the finale pays 1000 coins, 2000 XP, the sixth fragment, the treasure and the flag", () => {
    expect(island.config.rewards).toEqual({
      coins: 1000,
      xp: 2000,
      items: [
        { itemKey: "map-fragment", quantity: 1 },
        { itemKey: "blackbeards-treasure", quantity: 1 },
        { itemKey: "cosmetic-blackbeards-flag", quantity: 1 },
      ],
    });
  });

  it("the legendary ship is the top tier, costs 1000 and is sold after the jungle, needing no other ship", () => {
    const ships = pirateAdventure.items.filter((i) => i.type === "SHIP");
    const legendary = ships.find((i) => i.key === "ship-legendary")!;
    const tiers = ships.map((i) => (i.config as { tier: number }).tier);
    expect((legendary.config as { tier: number }).tier).toBe(Math.max(...tiers));
    expect(legendary.config).toMatchObject({
      costCoins: 1000,
      requiresChapterKey: "whispering-jungle",
    });
    expect(legendary.config).not.toHaveProperty("requiresShipTier");
  });

  it("the dig site needs the map pieces held; the other stages are chained, nothing is spent", () => {
    expect(puzzleItemGates(island.config.locations, "treasure-lock")).toEqual([
      { itemKey: "map-fragment", quantity: 5 },
    ]);
    const quest = island.quests.find((q) => q.key === "find-the-treasure")!;
    expect(
      quest.objectives.map((o) => [o.key, o.type, o.config.requiresObjectiveKey ?? null]),
    ).toEqual([
      ["dig-deep", "APPROVED_ACTIVITIES", null],
      ["crack-the-lock", "COMPLETE_PUZZLE", "dig-deep"],
      ["read-the-runes", "COMPLETE_PUZZLE", "crack-the-lock"],
      ["escape-the-traps", "COMPLETE_PUZZLE", "read-the-runes"],
    ]);
    expect(quest.objectives.every((o) => !o.config.grantItemKey)).toBe(true);
    expect(
      quest.objectives
        .filter((o) => o.type === "COMPLETE_PUZZLE")
        .map((o) => island.puzzles.find((p) => p.key === o.config.puzzleKey)!.type),
    ).toEqual(["sequence-match", "clue-order", "route-plan"]);
  });

  it("the lock's hint names every step in order, so the stage is never a blind guess", () => {
    const puzzle = island.puzzles.find((p) => p.key === "treasure-lock")!;
    const data = puzzle.config.data as { symbols: string[]; sequence: string[]; hint: string };
    const mentioned = [...data.hint.matchAll(new RegExp(data.symbols.join("|"), "g"))].map(
      (m) => m[0],
    );
    expect(mentioned).toEqual(data.sequence);
  });

  it("the runes have exactly one solution and the traps board blocks the straight routes", () => {
    const runes = island.puzzles.find((p) => p.key === "treasure-runes")!;
    const config = clueOrderPuzzle.parseConfig(runes.config.data);
    expect(clueOrderSolution(config)).toEqual(["star", "skull", "crown", "flame", "wave"]);
    const verifier = getPuzzleVerifier("route-plan");
    const board = verifier.parseConfig(
      island.puzzles.find((p) => p.key === "treasure-traps")!.config.data,
    );
    const right = Array(7).fill("right");
    const up = Array(7).fill("up");
    expect(verifier.verify(board, { moves: [...right, ...up] }).correct).toBe(false);
    expect(verifier.verify(board, { moves: [...up, ...right] }).correct).toBe(false);
  });

  it("has the achievement, the items, the flag slot and the manifest entries it needs", () => {
    const legend = pirateAdventure.achievements.find((a) => a.key === "pirate.legend")!;
    expect(legend.criteria).toEqual({ type: "CHAPTER_COMPLETED", chapterKey: "treasure-island" });
    const flag = pirateAdventure.items.find((i) => i.key === "cosmetic-blackbeards-flag")!;
    expect(flag.type).toBe("COSMETIC");
    expect(flag.config).toEqual({ slot: "flag" }); // not for sale: no costCoins
    expect(pirateCrewCampScene.slots).toHaveProperty("flag");
    const treasure = pirateAdventure.items.find((i) => i.key === "blackbeards-treasure")!;
    expect(treasure.rarity).toBe("LEGENDARY");
    expect(treasure.maxQuantity).toBe(1);
    const ids = new Set(pirateAssetManifest.assets.map((a) => a.id));
    for (const id of ["scene.treasure-island", treasure.iconKey, flag.iconKey]) {
      expect(ids.has(id ?? ""), String(id)).toBe(true);
    }
  });

  it("every chapter is playable now, so the adventure can be finished", () => {
    expect(pirateAdventure.chapters.map((c) => c.status)).toEqual(Array(6).fill("PLAYABLE"));
  });
});
