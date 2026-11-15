import { describe, expect, it } from "vitest";

import { getPuzzleVerifier } from "@/game/puzzles";
import { pirateAdventure, pirateAssetManifest } from "@/game/themes/pirate";
import {
  puzzleWaitingFor,
  type LocationObjective,
  type LocationQuest,
} from "@/features/adventures/location-view";

const reef = pirateAdventure.chapters.find((c) => c.key === "skull-reef")!;

describe("Skull Reef theme data", () => {
  it("is playable, gated on the cove and the voyager, and completes on both main quests", () => {
    expect(reef.status).toBe("PLAYABLE");
    expect(reef.config.unlock.requires).toEqual([
      { type: "CHAPTER_COMPLETED", chapterKey: "shipwreck-cove" },
      { type: "ITEM", itemKey: "ship-voyager", quantity: 1 },
    ]);
    expect(reef.config.completion.requiresQuestKeys).toEqual([
      "navigate-the-reef",
      "defeat-the-kraken",
    ]);
    // The chapter reward is the configured one.
    expect(reef.config.rewards).toEqual({
      coins: 125,
      xp: 250,
      items: [{ itemKey: "map-fragment", quantity: 1 }],
    });
  });

  it("every puzzle in the theme parses with its verifier, and every puzzle objective points at one", () => {
    for (const chapter of pirateAdventure.chapters) {
      const keys = new Set(chapter.puzzles.map((p) => p.key));
      for (const puzzle of chapter.puzzles) {
        expect(() => getPuzzleVerifier(puzzle.type).parseConfig(puzzle.config.data)).not.toThrow();
      }
      for (const quest of chapter.quests) {
        for (const objective of quest.objectives) {
          if (objective.type !== "COMPLETE_PUZZLE") continue;
          expect(
            keys.has(objective.config.puzzleKey ?? ""),
            `${chapter.key}/${objective.key}`,
          ).toBe(true);
        }
      }
    }
  });

  it("the Kraken is three puzzle stages chained in order, behind the chart quest, with no cost", () => {
    const kraken = reef.quests.find((q) => q.key === "defeat-the-kraken")!;
    expect(kraken.config.requiresQuestKey).toBe("navigate-the-reef");
    expect(kraken.objectives.map((o) => [o.type, o.config.requiresObjectiveKey ?? null])).toEqual([
      ["COMPLETE_PUZZLE", null],
      ["COMPLETE_PUZZLE", "read-the-tentacles"],
      ["COMPLETE_PUZZLE", "find-the-weak-points"],
    ]);
    const stageTypes = kraken.objectives.map(
      (o) => reef.puzzles.find((p) => p.key === o.config.puzzleKey)!.type,
    );
    expect(stageTypes).toEqual(["sequence-match", "pair-match", "route-plan"]);
    // No objective grants or debits items: rewards are the existing bundles only.
    expect(kraken.objectives.every((o) => !o.config.grantItemKey)).toBe(true);
  });

  it("the reef chart is gated by holding five chart pieces, and the pieces come from any chore", () => {
    const table = reef.config.locations.find((l) => l.puzzleKey === "reef-chart-puzzle")!;
    expect(table.requiresItemKey).toBe("chart-piece");
    expect(table.requiresItemQuantity).toBe(5);
    const collect = reef.quests
      .find((q) => q.key === "navigate-the-reef")!
      .objectives.find((o) => o.key === "collect-chart-pieces")!;
    expect(collect.targetCount).toBe(5);
    expect(collect.config.eligibility).toEqual({});
  });

  it("every board has a blocked straight route, so it is a planning puzzle", () => {
    const boards = reef.puzzles.filter((p) => p.type === "route-plan");
    expect(boards.map((p) => p.key)).toEqual(["reef-chart-puzzle", "kraken-escape"]);
    const verifier = getPuzzleVerifier("route-plan");
    for (const puzzle of boards) {
      const board = verifier.parseConfig(puzzle.config.data) as {
        start: { x: number; y: number };
        goal: { x: number; y: number };
      };
      const h = Array(Math.abs(board.goal.x - board.start.x)).fill(
        board.goal.x > board.start.x ? "right" : "left",
      );
      const v = Array(Math.abs(board.goal.y - board.start.y)).fill(
        board.goal.y > board.start.y ? "down" : "up",
      );
      expect(verifier.verify(board, { moves: [...h, ...v] }).correct, puzzle.key).toBe(false);
      expect(verifier.verify(board, { moves: [...v, ...h] }).correct, puzzle.key).toBe(false);
    }
  });

  it("a mandatory sequence stage can be solved from its hint: the hint names every step, in order", () => {
    // Regression for a review finding: a hint that named only the first symbol left 4^5 blind guesses.
    const puzzle = reef.puzzles.find((p) => p.key === "kraken-tentacles")!;
    const data = puzzle.config.data as { symbols: string[]; sequence: string[]; hint: string };
    const mentioned = [...data.hint.matchAll(new RegExp(data.symbols.join("|"), "gi"))].map((m) =>
      data.symbols.find((s) => s.toLowerCase() === m[0].toLowerCase()),
    );
    expect(mentioned).toEqual(data.sequence);
  });

  it("every item and scene it uses has a manifest entry", () => {
    const ids = new Set(pirateAssetManifest.assets.map((a) => a.id));
    expect(ids.has("scene.skull-reef")).toBe(true);
    for (const item of pirateAdventure.items.filter((i) =>
      ["chart-piece", "kraken-tooth"].includes(i.key),
    )) {
      expect(ids.has(item.iconKey ?? ""), item.key).toBe(true);
    }
  });

  it("Treasure Island stays an empty placeholder", () => {
    const island = pirateAdventure.chapters.find((c) => c.key === "treasure-island")!;
    expect(island.status).toBe("PLACEHOLDER");
    expect(island.quests).toEqual([]);
    expect(island.puzzles).toEqual([]);
    expect(island.config.locations).toEqual([]);
  });
});

describe("puzzleWaitingFor", () => {
  const objective = (over: Partial<LocationObjective>): LocationObjective => ({
    key: "o",
    title: "Objective",
    type: "COMPLETE_PUZZLE",
    currentCount: 0,
    targetCount: 1,
    completed: false,
    puzzleKey: "p",
    available: false,
    ...over,
  });
  const chart: LocationQuest = {
    key: "chart",
    kind: "MAIN",
    title: "Navigate the Reef",
    description: null,
    status: "ACTIVE",
    rewards: { coins: 0, xp: 0, items: [] },
    objectives: [],
  };

  it("names the quest a locked, chained quest is waiting for", () => {
    const stage = objective({ key: "s1", title: "Stage one" });
    const kraken: LocationQuest = {
      ...chart,
      key: "kraken",
      title: "Kraken",
      status: "LOCKED",
      requiresQuestKey: "chart",
      objectives: [stage],
    };
    expect(puzzleWaitingFor([chart, kraken], kraken, stage)).toBe("Navigate the Reef");
  });

  it("names the objective the engine chained it behind, not just any unfinished one", () => {
    const s1 = objective({ key: "s1", title: "Stage one", available: true, completed: true });
    const s2 = objective({ key: "s2", title: "Stage two", available: true });
    const s3 = objective({ key: "s3", title: "Stage three", requiresObjectiveKey: "s2" });
    const kraken: LocationQuest = { ...chart, key: "kraken", objectives: [s1, s2, s3] };
    expect(puzzleWaitingFor([kraken], kraken, s3)).toBe("Stage two");
  });

  it("is null when the puzzle is available, and falls back for data without hints", () => {
    const a = objective({ key: "a", title: "Collect", completed: false });
    const b = objective({ key: "b", title: "Solve" });
    const quest: LocationQuest = { ...chart, objectives: [a, b] };
    expect(puzzleWaitingFor([quest], quest, objective({ available: true }))).toBeNull();
    expect(puzzleWaitingFor([quest], quest, b)).toBe("Collect");
  });
});
