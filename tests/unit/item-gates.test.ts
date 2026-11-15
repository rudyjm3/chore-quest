import { describe, expect, it } from "vitest";

import { itemGatesMet, locationItemGates, puzzleItemGates, unmetItemGates } from "@/game/engine";
import { chapterLocationSchema } from "@/game/schemas";

describe("multi-item gates (ADR 0021)", () => {
  const ruins = {
    key: "ruins",
    puzzleKey: "p",
    requiresItems: [
      { itemKey: "idol", quantity: 1 },
      { itemKey: "mask", quantity: 1 },
      { itemKey: "key", quantity: 1 },
    ],
  };

  it("needs every listed item at once, and says which are missing", () => {
    const gates = locationItemGates(ruins);
    expect(gates).toHaveLength(3);
    expect(itemGatesMet(gates, { idol: 1, mask: 1 })).toBe(false);
    expect(unmetItemGates(gates, { idol: 1, mask: 1 })).toEqual([{ itemKey: "key", quantity: 1 }]);
    expect(itemGatesMet(gates, { idol: 1, mask: 1, key: 1 })).toBe(true);
    expect(itemGatesMet(gates, { idol: 5, mask: 5, key: 0 })).toBe(false);
  });

  it("the single-item pair still counts and merges with the list, strictest quantity per item", () => {
    const location = {
      key: "x",
      requiresItemKey: "plank",
      requiresItemQuantity: 4,
      requiresItems: [
        { itemKey: "plank", quantity: 2 },
        { itemKey: "rope", quantity: 3 },
      ],
    };
    expect(locationItemGates(location)).toEqual([
      { itemKey: "plank", quantity: 4 },
      { itemKey: "rope", quantity: 3 },
    ]);
  });

  it("a puzzle opened from several places needs every item any of them needs", () => {
    const gates = puzzleItemGates(
      [
        { key: "a", puzzleKey: "p", requiresItemKey: "idol", requiresItemQuantity: 1 },
        {
          key: "b",
          puzzleKey: "p",
          requiresItems: [
            { itemKey: "idol", quantity: 2 },
            { itemKey: "mask", quantity: 1 },
          ],
        },
        { key: "c", puzzleKey: "other", requiresItemKey: "never" },
      ],
      "p",
    );
    expect(gates).toEqual([
      { itemKey: "idol", quantity: 2 },
      { itemKey: "mask", quantity: 1 },
    ]);
  });

  it("no gates means open; the config key defaults to an empty list", () => {
    expect(locationItemGates({ key: "free" })).toEqual([]);
    expect(itemGatesMet([], {})).toBe(true);
    const parsed = chapterLocationSchema.parse({
      key: "k",
      name: "K",
      kind: "decorative",
      position: { x: 1, y: 1 },
    });
    expect(parsed.requiresItems).toEqual([]);
    expect(
      chapterLocationSchema.parse({
        key: "k",
        name: "K",
        kind: "puzzle",
        position: { x: 1, y: 1 },
        requiresItems: [{ itemKey: "idol" }],
      }).requiresItems,
    ).toEqual([{ itemKey: "idol", quantity: 1 }]);
    expect(() =>
      chapterLocationSchema.parse({
        key: "k",
        name: "K",
        kind: "puzzle",
        position: { x: 1, y: 1 },
        requiresItems: [{ itemKey: "idol", quantity: 0 }],
      }),
    ).toThrow();
  });
});
