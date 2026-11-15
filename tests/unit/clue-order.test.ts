import { describe, expect, it } from "vitest";

import { getPuzzleVerifier, listPuzzleTypes, clueOrderClientViewSchema } from "@/game/puzzles";
import { clueOrderPuzzle, clueOrderSolution } from "@/game/puzzles/clue-order";
import { pirateAdventure } from "@/game/themes/pirate";

/** Solution: statue, idol, bowl, mask, key (see the clues). */
const raw = {
  items: [
    { key: "idol", label: "Idol" },
    { key: "mask", label: "Mask" },
    { key: "key", label: "Key" },
    { key: "statue", label: "Statue" },
    { key: "bowl", label: "Bowl" },
  ],
  clues: [
    { rule: "in-slot", a: "key", slot: 5, text: "The key is last." },
    { rule: "next-to", a: "idol", b: "statue", text: "The idol is next to the statue." },
    { rule: "left-of", a: "bowl", b: "mask", text: "The mask is after the bowl." },
    { rule: "not-in-slot", a: "idol", slot: 1, text: "The idol is not first." },
    { rule: "not-next-to", a: "bowl", b: "key", text: "The bowl is not next to the key." },
    { rule: "left-of", a: "statue", b: "bowl", text: "The statue is before the bowl." },
  ],
  hint: "Start with the clue that says where something goes.",
};
const verifier = clueOrderPuzzle;
const config = verifier.parseConfig(raw);
const SOLUTION = ["statue", "idol", "bowl", "mask", "key"];
const check = (order: unknown) => verifier.verify(config, { order });

describe("clue-order verifier: answers", () => {
  it("is registered", () => {
    expect(listPuzzleTypes()).toContain("clue-order");
    expect(getPuzzleVerifier("clue-order")).toBe(clueOrderPuzzle);
  });

  it("derives the one solution from the clues and accepts exactly that", () => {
    expect(clueOrderSolution(config)).toEqual(SOLUTION);
    expect(check(SOLUTION).correct).toBe(true);
    expect(check(SOLUTION).feedback).toBe("You solved it!");
  });

  it("rejects every other ordering of the same things", () => {
    const perms = (a: string[]): string[][] =>
      a.length <= 1
        ? [a]
        : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
    const all = perms(SOLUTION);
    expect(all).toHaveLength(120);
    expect(all.filter((order) => check(order).correct)).toEqual([SOLUTION]);
  });

  it("rejects partial, duplicated, unknown, extra and malformed answers without throwing", () => {
    expect(check(SOLUTION.slice(0, 4)).correct).toBe(false);
    expect(check([...SOLUTION, "idol"]).correct).toBe(false);
    expect(check(["statue", "statue", "bowl", "mask", "key"]).correct).toBe(false);
    expect(check(["statue", "idol", "bowl", "mask", "nope"]).correct).toBe(false);
    expect(check([]).correct).toBe(false);
    for (const bad of [
      null,
      undefined,
      "idol",
      7,
      {},
      { order: "idol" },
      { order: [1, 2, 3, 4, 5] },
      { slots: SOLUTION },
    ]) {
      expect(verifier.verify(config, bad).correct).toBe(false);
    }
  });

  it("gives the same vague line for every wrong ordering", () => {
    expect(check([...SOLUTION].reverse()).feedback).toBe("Not quite. Try again.");
    expect(check(["idol"]).feedback).toBe("Not quite. Try again.");
  });
});

describe("clue-order verifier: config", () => {
  const parse = (over: Record<string, unknown>) => verifier.parseConfig({ ...raw, ...over });

  it("accepts a well-formed puzzle", () => {
    expect(() => parse({})).not.toThrow();
  });

  it("rejects clues with no solution and clues with more than one", () => {
    expect(() =>
      parse({
        clues: [
          { rule: "in-slot", a: "key", slot: 1, text: "a" },
          { rule: "in-slot", a: "idol", slot: 1, text: "b" },
        ],
      }),
    ).toThrow(/exactly one solution \(found 0\)/);
    expect(() => parse({ clues: raw.clues.slice(0, 3) })).toThrow(/exactly one solution/);
  });

  it("rejects unknown items, impossible places, self comparisons and duplicate keys", () => {
    const clues = (clue: Record<string, unknown>) => [...raw.clues, clue];
    expect(() =>
      parse({ clues: clues({ rule: "left-of", a: "idol", b: "ghost", text: "x" }) }),
    ).toThrow(/does not exist/);
    expect(() =>
      parse({ clues: clues({ rule: "in-slot", a: "idol", slot: 9, text: "x" }) }),
    ).toThrow(/place that does not exist/);
    expect(() =>
      parse({ clues: clues({ rule: "next-to", a: "idol", b: "idol", text: "x" }) }),
    ).toThrow(/itself/);
    expect(() =>
      parse({ items: [...raw.items.slice(0, 4), { key: "idol", label: "Again" }] }),
    ).toThrow(/unique/);
  });

  it("rejects malformed config", () => {
    expect(() => verifier.parseConfig({})).toThrow();
    expect(() => parse({ items: raw.items.slice(0, 2) })).toThrow();
    expect(() => parse({ clues: [] })).toThrow();
    expect(() => parse({ clues: [{ rule: "diagonal", a: "idol", text: "x" }] })).toThrow();
  });

  it("rejects keys whose sorted order is the solution", () => {
    // Solution a < b < c when sorted, and the clues force a, b, c in that order.
    expect(() =>
      verifier.parseConfig({
        items: [
          { key: "c", label: "C" },
          { key: "a", label: "A" },
          { key: "b", label: "B" },
        ],
        clues: [
          { rule: "left-of", a: "a", b: "b", text: "a before b" },
          { rule: "left-of", a: "b", b: "c", text: "b before c" },
        ],
      }),
    ).toThrow(/sorted order/);
  });
});

describe("clue-order client view", () => {
  const view = clueOrderClientViewSchema.parse(verifier.toClientView(config));

  it("shows the things, the number of places and the clue sentences, and nothing about the order", () => {
    expect(Object.keys(view).sort()).toEqual(["clues", "hint", "items", "slots"]);
    expect(clueOrderClientViewSchema.parse(view)).toEqual(view);
    expect(view.slots).toBe(5);
    expect(view.clues).toEqual(raw.clues.map((c) => c.text));
    const text = JSON.stringify(view);
    for (const word of ["order", "solution", "answer", "rule", 'slot"'])
      expect(text).not.toContain(`"${word.replace('"', "")}"`);
  });

  it("lists the things sorted by key, which is not the solution", () => {
    expect(view.items.map((i) => i.key)).toEqual(["bowl", "idol", "key", "mask", "statue"]);
    expect(view.items.map((i) => i.key)).not.toEqual(SOLUTION);
  });
});

describe("clue-order puzzles in the pirate theme", () => {
  const puzzles = pirateAdventure.chapters
    .flatMap((chapter) => chapter.puzzles)
    .filter((p) => p.type === "clue-order");

  it("every one has exactly one solution that its sentences describe, and a view without it", () => {
    expect(puzzles.map((p) => p.key)).toEqual(["ruins-puzzle"]);
    for (const puzzle of puzzles) {
      const board = verifier.parseConfig(puzzle.config.data);
      const solution = clueOrderSolution(board);
      expect(solution).toHaveLength(board.items.length);
      expect(verifier.verify(board, { order: solution }).correct).toBe(true);
      const text = JSON.stringify(verifier.toClientView(board));
      expect(text).not.toMatch(/"(order|solution|rule|answer)"/);
    }
  });
});
