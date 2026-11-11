import { describe, expect, it } from "vitest";

import {
  advanceObjective,
  chapterComplete,
  chapterUnlocked,
  completionMatchesObjective,
  levelForXp,
  missingRequirements,
  parseObjectiveConfig,
} from "@/game/engine";
import { getPuzzleVerifier } from "@/game/puzzles";
import { adventureDefinitionSchema, assetManifestSchema } from "@/game/schemas";
import { pirateAdventure, pirateAssetManifest } from "@/game/themes/pirate";

describe("chapter unlock conditions", () => {
  const parrotIsland = pirateAdventure.chapters.find((c) => c.key === "parrot-island")!;
  const requires = parrotIsland.config.unlock.requires;

  it("stays locked until Home Port is complete AND three crates are held", () => {
    const base = {
      chapterStatusByKey: {},
      inventoryByItemKey: {},
      completedQuestKeys: new Set<string>(),
    };
    expect(chapterUnlocked(requires, base)).toBe(false);
    expect(
      chapterUnlocked(requires, { ...base, chapterStatusByKey: { "home-port": "COMPLETED" } }),
    ).toBe(false);
    expect(chapterUnlocked(requires, { ...base, inventoryByItemKey: { "supply-crate": 3 } })).toBe(
      false,
    );
    expect(
      chapterUnlocked(requires, {
        ...base,
        chapterStatusByKey: { "home-port": "COMPLETED" },
        inventoryByItemKey: { "supply-crate": 3 },
      }),
    ).toBe(true);
  });

  it("reports what is missing", () => {
    const missing = missingRequirements(requires, {
      chapterStatusByKey: { "home-port": "COMPLETED" },
      inventoryByItemKey: { "supply-crate": 1 },
      completedQuestKeys: new Set(),
    });
    expect(missing).toEqual([{ type: "ITEM", itemKey: "supply-crate", quantity: 3 }]);
  });

  it("a chapter completes when all required quests are done", () => {
    expect(chapterComplete(["a", "b"], new Set(["a"]))).toBe(false);
    expect(chapterComplete(["a", "b"], new Set(["a", "b"]))).toBe(true);
    expect(chapterComplete([], new Set())).toBe(true);
  });

  it("derives player level from thresholds", () => {
    expect(levelForXp(0, [100, 250])).toBe(1);
    expect(levelForXp(100, [100, 250])).toBe(2);
    expect(levelForXp(999, [100, 250])).toBe(3);
  });
});

describe("objectives", () => {
  it("clamps progress to the target", () => {
    expect(advanceObjective({ currentCount: 2, targetCount: 3 })).toEqual({ next: 3, applied: 1 });
    expect(advanceObjective({ currentCount: 3, targetCount: 3 })).toEqual({ next: 3, applied: 0 });
  });

  it("matches completions by source and category", () => {
    const anyChore = parseObjectiveConfig({ eligibility: {} });
    expect(
      completionMatchesObjective("APPROVED_ACTIVITIES", anyChore, {
        sourceType: "TASK_OCCURRENCE",
        taskCategory: "CHORE",
      }),
    ).toBe(true);
    const hygieneOnly = parseObjectiveConfig({ eligibility: { categories: ["HYGIENE"] } });
    expect(
      completionMatchesObjective("APPROVED_ACTIVITIES", hygieneOnly, {
        sourceType: "TASK_OCCURRENCE",
        taskCategory: "CHORE",
      }),
    ).toBe(false);
    expect(
      completionMatchesObjective("COMPLETE_ROUTINES", anyChore, {
        sourceType: "ROUTINE_RUN",
        taskCategory: null,
      }),
    ).toBe(true);
    expect(
      completionMatchesObjective("COMPLETE_PUZZLE", anyChore, {
        sourceType: "TASK_OCCURRENCE",
        taskCategory: "CHORE",
      }),
    ).toBe(false);
  });
});

describe("pirate theme data", () => {
  it("validates against the adventure definition schema", () => {
    expect(() => adventureDefinitionSchema.parse(pirateAdventure)).not.toThrow();
    expect(pirateAdventure.chapters.map((c) => c.key)).toEqual([
      "home-port",
      "parrot-island",
      "shipwreck-cove",
      "skull-reef",
      "whispering-jungle",
      "treasure-island",
    ]);
  });

  it("every item/puzzle referenced by chapters exists", () => {
    const itemKeys = new Set(pirateAdventure.items.map((i) => i.key));
    for (const chapter of pirateAdventure.chapters) {
      for (const reward of chapter.config.rewards.items)
        expect(itemKeys.has(reward.itemKey)).toBe(true);
      for (const req of chapter.config.unlock.requires) {
        if (req.type === "ITEM") expect(itemKeys.has(req.itemKey)).toBe(true);
      }
      const puzzleKeys = new Set(chapter.puzzles.map((p) => p.key));
      for (const quest of chapter.quests) {
        for (const objective of quest.objectives) {
          if (objective.config.grantItemKey)
            expect(itemKeys.has(objective.config.grantItemKey)).toBe(true);
          if (objective.config.puzzleKey)
            expect(puzzleKeys.has(objective.config.puzzleKey)).toBe(true);
        }
      }
    }
  });

  it("asset manifest validates and flags placeholders", () => {
    expect(() => assetManifestSchema.parse(pirateAssetManifest)).not.toThrow();
    expect(pirateAssetManifest.assets.every((a) => a.placeholder)).toBe(true);
  });
});

describe("puzzles", () => {
  it("verifies the compass sequence server-side", () => {
    const verifier = getPuzzleVerifier("sequence-match");
    const config = verifier.parseConfig({
      symbols: ["N", "E", "S", "W"],
      sequence: ["N", "E", "S", "W"],
    });
    expect(verifier.verify(config, { sequence: ["N", "E", "S", "W"] }).correct).toBe(true);
    expect(verifier.verify(config, { sequence: ["N", "E"] }).correct).toBe(false);
    expect(verifier.verify(config, "garbage").correct).toBe(false);
  });

  it("rejects unknown puzzle types", () => {
    expect(() => getPuzzleVerifier("nope")).toThrow();
  });
});
