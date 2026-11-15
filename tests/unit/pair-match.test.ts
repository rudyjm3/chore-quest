import { describe, expect, it } from "vitest";

import { getPuzzleVerifier, listPuzzleTypes, pairMatchClientViewSchema } from "@/game/puzzles";
import { itemGateMet, locationItemGate, puzzleItemGate } from "@/game/engine";
import { pirateAdventure } from "@/game/themes/pirate";

const raw = {
  parts: [
    { key: "a", label: "Part A" },
    { key: "b", label: "Part B" },
    { key: "c", label: "Part C" },
  ],
  tools: [
    { key: "t3", label: "Tool 3" },
    { key: "t1", label: "Tool 1" },
    { key: "t2", label: "Tool 2" },
  ],
  pairs: { a: "t2", b: "t3", c: "t1" },
  hint: "A hint",
};

const verifier = getPuzzleVerifier("pair-match");
const config = verifier.parseConfig(raw) as typeof raw;

describe("pair-match verifier", () => {
  it("is registered", () => {
    expect(listPuzzleTypes()).toContain("pair-match");
  });

  it("accepts the right matching, whatever the key order in the answer", () => {
    expect(verifier.verify(config, { pairs: { a: "t2", b: "t3", c: "t1" } }).correct).toBe(true);
    expect(verifier.verify(config, { pairs: { c: "t1", a: "t2", b: "t3" } }).correct).toBe(true);
  });

  it("rejects a wrong matching with vague, theme-neutral feedback", () => {
    const verdict = verifier.verify(config, { pairs: { a: "t1", b: "t2", c: "t3" } });
    expect(verdict.correct).toBe(false);
    expect(verdict.feedback).toBe("Not quite. Try again.");
  });

  it("gives the same feedback for one wrong pair as for all wrong (no partial credit leak)", () => {
    const oneWrong = verifier.verify(config, { pairs: { a: "t2", b: "t1", c: "t3" } });
    const allWrong = verifier.verify(config, { pairs: { a: "t1", b: "t2", c: "t3" } });
    expect(oneWrong).toEqual(allWrong);
  });

  it.each([
    ["partial", { pairs: { a: "t2", b: "t3" } }],
    ["empty", { pairs: {} }],
    ["extra part", { pairs: { a: "t2", b: "t3", c: "t1", d: "t1" } }],
    ["unknown tool", { pairs: { a: "t2", b: "t3", c: "nope" } }],
    ["duplicate tool", { pairs: { a: "t2", b: "t2", c: "t1" } }],
    ["wrong shape", { pairs: ["t1", "t2", "t3"] }],
    ["missing pairs key", { sequence: ["a"] }],
    ["null", null],
    ["a string", "t1"],
  ])("rejects a %s answer without throwing", (_name, answer) => {
    expect(verifier.verify(config, answer).correct).toBe(false);
  });

  it.each([
    ["too few parts", { ...raw, parts: [raw.parts[0]], tools: [raw.tools[0]], pairs: { a: "t3" } }],
    ["fewer tools than parts", { ...raw, tools: raw.tools.slice(0, 2) }],
    ["duplicate part key", { ...raw, parts: [raw.parts[0], raw.parts[0], raw.parts[2]] }],
    ["duplicate tool key", { ...raw, tools: [raw.tools[0], raw.tools[0], raw.tools[2]] }],
    ["answer misses a part", { ...raw, pairs: { a: "t2", b: "t3" } }],
    ["answer names an unknown part", { ...raw, pairs: { a: "t2", b: "t3", z: "t1" } }],
    ["answer reuses a tool", { ...raw, pairs: { a: "t2", b: "t2", c: "t1" } }],
    ["answer uses an unknown tool", { ...raw, pairs: { a: "t2", b: "t3", c: "zz" } }],
    [
      "parts listed in an order that spells out the sorted tools",
      {
        ...raw,
        parts: [raw.parts[0], raw.parts[1], raw.parts[2]],
        pairs: { a: "t1", b: "t2", c: "t3" },
      },
    ],
    ["not an object", "nope" as unknown as Record<string, unknown>],
    ["missing pairs", { parts: raw.parts, tools: raw.tools }],
  ])("rejects a malformed config: %s", (_name, bad) => {
    expect(() => verifier.parseConfig(bad as Record<string, unknown>)).toThrow();
  });

  it("toClientView never contains the answer", () => {
    const view = verifier.toClientView(config);
    expect(() => pairMatchClientViewSchema.parse(view)).not.toThrow();
    expect(Object.keys(view).sort()).toEqual(["hint", "parts", "tools"]);
    expect(JSON.stringify(view)).not.toContain("pairs");
    // The tool order is by key, not the config's order, and says nothing about which part it fixes.
    expect((view as { tools: Array<{ key: string }> }).tools.map((t) => t.key)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });
});

describe("the pirate repair puzzle", () => {
  const puzzle = pirateAdventure.chapters
    .find((c) => c.key === "shipwreck-cove")!
    .puzzles.find((p) => p.key === "repair-puzzle")!;
  const pirate = verifier.parseConfig(puzzle.config.data) as {
    parts: Array<{ key: string }>;
    pairs: Record<string, string>;
  };

  it("has five parts, so 120 possible answers", () => {
    expect(pirate.parts).toHaveLength(5);
  });

  it("the client view hides the answer and its tool order does not follow the parts' solution order", () => {
    const view = verifier.toClientView(pirate) as { tools: Array<{ key: string }> };
    const solutionOrder = pirate.parts.map((p) => pirate.pairs[p.key]);
    expect(view.tools.map((t) => t.key)).not.toEqual(solutionOrder);
    expect(JSON.stringify(view)).not.toContain('"pairs"');
  });

  it("accepts its own answer", () => {
    expect(verifier.verify(pirate, { pairs: pirate.pairs }).correct).toBe(true);
  });
});

describe("item-hold gates (never consumed)", () => {
  const locations = [
    { key: "yard", puzzleKey: undefined },
    { key: "wreck", puzzleKey: "p", requiresItemKey: "plank", requiresItemQuantity: 4 },
    { key: "cove", puzzleKey: "q", requiresItemKey: "pearl" },
  ];

  it("defaults the quantity to one and ignores locations without a gate", () => {
    expect(locationItemGate(locations[0]!)).toBeNull();
    expect(locationItemGate(locations[2]!)).toEqual({ itemKey: "pearl", quantity: 1 });
  });

  it("finds the gate by puzzle key", () => {
    expect(puzzleItemGate(locations, "p")).toEqual({ itemKey: "plank", quantity: 4 });
    expect(puzzleItemGate(locations, "unknown")).toBeNull();
  });

  it("is met only while enough are held", () => {
    const gate = puzzleItemGate(locations, "p");
    expect(itemGateMet(gate, { plank: 3 })).toBe(false);
    expect(itemGateMet(gate, {})).toBe(false);
    expect(itemGateMet(gate, { plank: 4 })).toBe(true);
    expect(itemGateMet(null, {})).toBe(true);
  });

  it("the pirate Wreck needs four salvage planks and the explorer gates the chapter", () => {
    const cove = pirateAdventure.chapters.find((c) => c.key === "shipwreck-cove")!;
    expect(puzzleItemGate(cove.config.locations, "repair-puzzle")).toEqual({
      itemKey: "salvage-plank",
      quantity: 4,
    });
    expect(cove.config.unlock.requires).toContainEqual({
      type: "ITEM",
      itemKey: "ship-explorer",
      quantity: 1,
    });
  });
});
