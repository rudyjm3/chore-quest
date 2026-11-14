import { describe, expect, it } from "vitest";

import {
  buildQuestBoard,
  describeReward,
  type BoardChapter,
} from "@/features/adventures/quest-board";

const quest = (key: string, status: string, kind: "MAIN" | "SIDE" = "MAIN") => ({
  key,
  kind,
  title: key,
  description: null,
  status,
  rewards: { coins: 0, xp: 0, items: [] },
  objectives: [],
});
const chapter = (
  key: string,
  sortOrder: number,
  status: string,
  quests = [quest("q", "ACTIVE")],
): BoardChapter => ({
  key,
  title: key,
  sortOrder,
  status,
  quests,
});

describe("buildQuestBoard", () => {
  it("includes only active quests of reached chapters, in chapter order", () => {
    const board = buildQuestBoard([
      chapter("two", 2, "IN_PROGRESS"),
      chapter("one", 1, "UNLOCKED", [
        quest("a", "ACTIVE"),
        quest("b", "COMPLETED"),
        quest("c", "LOCKED"),
      ]),
      chapter("locked", 3, "LOCKED"),
      chapter("done", 4, "COMPLETED", [quest("q", "COMPLETED")]),
    ]);
    expect(board.map((s) => s.chapterKey)).toEqual(["one", "two"]);
    expect(board[0]?.quests.map((q) => q.key)).toEqual(["a"]);
  });
  it("keeps an active side quest visible after its chapter completed", () => {
    const board = buildQuestBoard([
      chapter("done", 1, "COMPLETED", [
        quest("main", "COMPLETED"),
        quest("side", "ACTIVE", "SIDE"),
      ]),
    ]);
    expect(board).toHaveLength(1);
    expect(board[0]?.quests.map((q) => q.key)).toEqual(["side"]);
  });

  it("lists main quests before side missions and drops empty chapters", () => {
    const board = buildQuestBoard([
      chapter("one", 1, "UNLOCKED", [quest("side", "ACTIVE", "SIDE"), quest("main", "ACTIVE")]),
      chapter("empty", 2, "UNLOCKED", [quest("x", "COMPLETED")]),
    ]);
    expect(board).toHaveLength(1);
    expect(board[0]?.quests.map((q) => q.key)).toEqual(["main", "side"]);
  });
});

describe("describeReward", () => {
  it("formats coins, xp and items, and is empty for nothing", () => {
    expect(
      describeReward({ coins: 20, xp: 50, items: [{ itemKey: "map-fragment", quantity: 1 }] }),
    ).toBe("🪙 20 · ✨ 50 XP · 1× map fragment");
    expect(describeReward({ coins: 0, xp: 0, items: [] })).toBe("");
  });
});
