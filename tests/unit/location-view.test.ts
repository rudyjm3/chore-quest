import { describe, expect, it } from "vitest";

import {
  buildLocationView,
  locationHasPage,
  type LocationChapter,
  type LocationObjective,
} from "@/features/adventures/location-view";

const objective = (over: Partial<LocationObjective>): LocationObjective => ({
  key: "o",
  title: "Objective",
  type: "APPROVED_ACTIVITIES",
  currentCount: 0,
  targetCount: 4,
  completed: false,
  puzzleKey: null,
  available: true,
  ...over,
});

const chapter = (over: Partial<LocationChapter> = {}): LocationChapter => ({
  locations: [
    { key: "grove", name: "Grove", kind: "quest-board", questKey: "q" },
    { key: "shrine", name: "Shrine", kind: "puzzle", puzzleKey: "p" },
    { key: "beach", name: "Beach", kind: "decorative" },
    { key: "orphan", name: "Orphan", kind: "quest-board" },
  ],
  quests: [
    {
      key: "q",
      kind: "MAIN",
      title: "Quest",
      description: null,
      status: "ACTIVE",
      rewards: { coins: 0, xp: 0, items: [] },
      objectives: [
        objective({ key: "collect", title: "Collect 4", currentCount: 2 }),
        objective({
          key: "solve",
          title: "Solve",
          type: "COMPLETE_PUZZLE",
          targetCount: 1,
          puzzleKey: "p",
          available: false,
        }),
      ],
    },
  ],
  ...over,
});

describe("location pages", () => {
  it("only quest-board locations with a quest and puzzle locations with a puzzle have a page", () => {
    const c = chapter();
    expect(c.locations.map(locationHasPage)).toEqual([true, true, false, false]);
    expect(buildLocationView(c, "beach")).toBeNull();
    expect(buildLocationView(c, "orphan")).toBeNull();
    expect(buildLocationView(c, "nope")).toBeNull();
  });

  it("the grove shows progress slots only for count objectives", () => {
    const view = buildLocationView(chapter(), "grove");
    expect(view?.kind).toBe("quest-board");
    if (view?.kind !== "quest-board") return;
    expect(view.collections).toEqual([
      { key: "collect", title: "Collect 4", current: 2, target: 4, completed: false },
    ]);
  });

  it("clamps progress to the target", () => {
    const c = chapter();
    c.quests[0]!.objectives[0]!.currentCount = 9;
    const view = buildLocationView(c, "grove");
    expect(view?.kind === "quest-board" && view.collections[0]?.current).toBe(4);
  });

  it("the shrine says what to finish first while the puzzle objective is not available", () => {
    const view = buildLocationView(chapter(), "shrine");
    expect(view).toMatchObject({
      kind: "puzzle",
      available: false,
      waitingFor: "Collect 4",
      solved: false,
    });
  });

  it("the shrine is available and solved once the objective says so", () => {
    const c = chapter();
    const solve = c.quests[0]!.objectives[1]!;
    solve.available = true;
    solve.completed = true;
    expect(buildLocationView(c, "shrine")).toMatchObject({
      available: true,
      waitingFor: null,
      solved: true,
    });
  });

  it("a puzzle no quest uses falls back to the puzzle's own record", () => {
    expect(buildLocationView(chapter({ quests: [] }), "shrine")).toMatchObject({
      available: true,
      solved: null,
    });
  });
});
