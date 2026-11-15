import { describe, expect, it } from "vitest";

import {
  getPuzzleVerifier,
  listPuzzleTypes,
  routePlanClientViewSchema,
  ROUTE_PLAN_MAX_MOVES,
  stepOnBoard,
} from "@/game/puzzles";
import { routePlanPuzzle } from "@/game/puzzles/route-plan";
import { pirateAdventure } from "@/game/themes/pirate";

/**
 * 5 x 5 board. S start (0,0), G goal (4,4), R reefs:
 *   S . . . .
 *   . R . R .
 *   . . . . .
 *   . R . R .
 *   . . . . G
 */
const raw = {
  width: 5,
  height: 5,
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 4 },
  reefs: [
    { x: 3, y: 3 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 3 },
  ],
  hint: "Mind the rocks!",
};

const verifier = routePlanPuzzle;
const config = verifier.parseConfig(raw);
const check = (moves: unknown) => verifier.verify(config, { moves });
const times = <T>(n: number, move: T) => Array.from({ length: n }, () => move);

describe("route-plan verifier: answers", () => {
  it("is registered", () => {
    expect(listPuzzleTypes()).toContain("route-plan");
    expect(getPuzzleVerifier("route-plan")).toBe(routePlanPuzzle);
  });

  it("accepts every valid route, checked by rules and not against one stored path", () => {
    const routes = [
      [...times(4, "right"), ...times(4, "down")], // along the top and the right edge
      [...times(4, "down"), ...times(4, "right")], // along the left edge and the bottom
      ["right", "right", ...times(4, "down"), "right", "right"], // straight down the middle column
      ["down", "down", "right", "right", "down", "down", "right", "right"], // a staircase through the centre
    ];
    for (const moves of routes) expect(check(moves).correct, moves.join(",")).toBe(true);
  });

  it("allows wandering: revisiting a cell, or reaching the goal and coming back to it", () => {
    expect(check(["right", "left", ...times(4, "right"), ...times(4, "down")]).correct).toBe(true);
    expect(check([...times(4, "right"), ...times(4, "down"), "left", "right"]).correct).toBe(true);
  });

  it("rejects a partial route and one that overshoots the goal", () => {
    expect(check(times(4, "right")).correct).toBe(false); // stops at (4,0)
    expect(check([...times(4, "right"), ...times(3, "down")]).correct).toBe(false); // one short
    expect(check([...times(4, "right"), ...times(4, "down"), "left"]).correct).toBe(false); // ends at (3,4)
    expect(check([]).correct).toBe(false);
  });

  it("rejects a route that touches a reef, even when it would otherwise reach the goal", () => {
    expect(
      check(["right", "down", "right", "right", "down", "down", "down", "right"]).correct,
    ).toBe(false); // (1,0) then (1,1) is a reef
    // Cross a reef and carry on: (0,0) down to (0,3), right onto the reef at (1,3).
    expect(check([...times(3, "down"), ...times(4, "right"), "down"]).correct).toBe(false);
  });

  it("rejects moves off the board, wherever they happen", () => {
    expect(check(["up", ...times(4, "right"), ...times(4, "down")]).correct).toBe(false);
    expect(check([...times(5, "right"), ...times(4, "down")]).correct).toBe(false); // (5,0) is off the right edge
    expect(check([...times(4, "down"), ...times(4, "right"), "down"]).correct).toBe(false);
    expect(check([...times(4, "right"), ...times(4, "down"), "right"]).correct).toBe(false);
  });

  it("rejects diagonals and any move that is not up, down, left or right", () => {
    expect(check(["down-right", "down-right", "down-right", "down-right"]).correct).toBe(false);
    expect(check(["diagonal"]).correct).toBe(false);
    expect(check(["UP"]).correct).toBe(false);
    expect(check([1, 2, 3]).correct).toBe(false);
    expect(check([{ x: 1, y: 0 }]).correct).toBe(false);
  });

  it("rejects malformed answers without throwing", () => {
    for (const bad of [
      null,
      undefined,
      "right",
      42,
      [],
      {},
      { moves: "right" },
      { moves: null },
      { cells: [] },
    ]) {
      expect(verifier.verify(config, bad).correct).toBe(false);
    }
  });

  it("rejects an answer longer than the move limit, even one that ends on the goal", () => {
    const wander = Array.from({ length: ROUTE_PLAN_MAX_MOVES }, (_, i) =>
      i % 2 === 0 ? "right" : "left",
    );
    const long = [...wander, ...times(4, "right"), ...times(4, "down")]; // valid by the rules, too long
    expect(long.length).toBeGreaterThan(ROUTE_PLAN_MAX_MOVES);
    expect(check(long).correct).toBe(false);
    // And a route of exactly the limit still works.
    const exact = [
      ...times((ROUTE_PLAN_MAX_MOVES - 8) / 2, ["right", "left"]).flat(),
      ...times(4, "right"),
      ...times(4, "down"),
    ];
    expect(exact).toHaveLength(ROUTE_PLAN_MAX_MOVES);
    expect(check(exact).correct).toBe(true);
  });

  it("gives the same vague, theme-neutral feedback for every wrong answer", () => {
    // Well-formed but wrong answers all get the same line; only a malformed one gets the shape message.
    for (const bad of [[], ["up"], ["right", "down"]]) {
      expect(check(bad).feedback).toBe("Not quite. Try again.");
    }
    expect(check([...times(4, "right"), ...times(4, "down")]).feedback).toBe("You solved it!");
  });
});

describe("route-plan verifier: config", () => {
  const parse = (over: Record<string, unknown>) => verifier.parseConfig({ ...raw, ...over });

  it("accepts a well-formed board", () => {
    expect(() => parse({})).not.toThrow();
  });

  it("rejects cells outside the board", () => {
    expect(() => parse({ goal: { x: 5, y: 4 } })).toThrow();
    expect(() => parse({ start: { x: 0, y: 5 } })).toThrow();
    expect(() => parse({ reefs: [{ x: 9, y: 9 }] })).toThrow();
    expect(() => parse({ start: { x: -1, y: 0 } })).toThrow();
  });

  it("rejects a start equal to the goal, a reef on either, and duplicate reefs", () => {
    expect(() => parse({ goal: { x: 0, y: 0 } })).toThrow(/different/);
    expect(() => parse({ reefs: [{ x: 0, y: 0 }] })).toThrow(/start or the goal/);
    expect(() => parse({ reefs: [{ x: 4, y: 4 }] })).toThrow(/start or the goal/);
    expect(() =>
      parse({
        reefs: [
          { x: 2, y: 2 },
          { x: 2, y: 2 },
        ],
      }),
    ).toThrow(/unique/);
  });

  it("rejects a board with no safe route", () => {
    // A wall of reefs across column 2.
    const wall = [0, 1, 2, 3, 4].map((y) => ({ x: 2, y }));
    expect(() => parse({ reefs: wall })).toThrow(/no safe route/);
    // The goal walled in.
    expect(() =>
      parse({
        reefs: [
          { x: 3, y: 4 },
          { x: 4, y: 3 },
        ],
      }),
    ).toThrow(/no safe route/);
  });

  it("rejects malformed config", () => {
    expect(() => verifier.parseConfig({})).toThrow();
    expect(() => parse({ width: 2 })).toThrow();
    expect(() => parse({ width: 9 })).toThrow();
    expect(() => parse({ reefs: "many" })).toThrow();
    expect(() => parse({ start: { x: 1.5, y: 0 } })).toThrow();
  });
});

describe("route-plan client view", () => {
  const view = verifier.toClientView(config);

  it("shows the whole board and nothing else: no route, no solution", () => {
    expect(Object.keys(view).sort()).toEqual(["goal", "height", "hint", "reefs", "start", "width"]);
    expect(routePlanClientViewSchema.parse(view)).toEqual(view);
    const text = JSON.stringify(view);
    for (const word of ["moves", "path", "route", "solution", "answer", "pairs", "sequence"]) {
      expect(text).not.toContain(`"${word}"`);
    }
  });

  it("lists reefs row by row, whatever order the config had", () => {
    expect(view.reefs).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it("does not mutate the stored config and gives a null hint when there is none", () => {
    expect(config.reefs[0]).toEqual({ x: 3, y: 3 });
    const noHint = verifier.parseConfig({ ...raw, hint: undefined });
    expect(verifier.toClientView(noHint).hint).toBeNull();
  });
});

describe("stepOnBoard", () => {
  it("moves one cell, and refuses edges and reefs", () => {
    expect(stepOnBoard(config, { x: 0, y: 0 }, "right")).toEqual({ x: 1, y: 0 });
    expect(stepOnBoard(config, { x: 0, y: 0 }, "up")).toBeNull();
    expect(stepOnBoard(config, { x: 0, y: 0 }, "left")).toBeNull();
    expect(stepOnBoard(config, { x: 4, y: 4 }, "down")).toBeNull();
    expect(stepOnBoard(config, { x: 1, y: 0 }, "down")).toBeNull(); // reef at (1,1)
  });
});

describe("route-plan puzzles in the pirate theme", () => {
  const puzzles = pirateAdventure.chapters
    .flatMap((chapter) => chapter.puzzles)
    .filter((p) => p.type === "route-plan");

  it("every one parses, the obvious straight route is blocked and the view hides any route", () => {
    for (const puzzle of puzzles) {
      const board = verifier.parseConfig(puzzle.config.data);
      const { start, goal } = board;
      const dx = goal.x - start.x;
      const dy = goal.y - start.y;
      const horizontal = times(Math.abs(dx), dx >= 0 ? "right" : "left");
      const vertical = times(Math.abs(dy), dy >= 0 ? "down" : "up");
      for (const direct of [
        [...horizontal, ...vertical],
        [...vertical, ...horizontal],
      ]) {
        expect(verifier.verify(board, { moves: direct }).correct, puzzle.key).toBe(false);
      }
      const text = JSON.stringify(verifier.toClientView(board));
      expect(text).not.toMatch(/"(moves|path|route|solution|answer)"/);
    }
  });
});
