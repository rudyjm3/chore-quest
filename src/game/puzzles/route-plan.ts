import { z } from "zod";

import type { PuzzleVerifier } from "./types";

/**
 * "route-plan": a small grid with a start, a goal and hazards ("reefs" in the pirate theme). The child plans a
 * route of moves that gets from the start to the goal without leaving the board or touching a hazard.
 * Theme-neutral: only cells, hazards and moves exist here; names and flavour come from the theme's puzzle config.
 *
 * It is a planning puzzle: every hazard is visible, and the answer is the route the child builds. No route is
 * stored in the config or sent to the browser; the verifier checks any submitted route by the rules, so many
 * different routes are accepted (ADR 0020).
 */
const MAX_SIZE = 8;
/** Longest route accepted (a bound on the input, far above any sensible route on an 8 x 8 board). */
export const ROUTE_PLAN_MAX_MOVES = 64;

const cellSchema = z.object({
  x: z
    .number()
    .int()
    .min(0)
    .max(MAX_SIZE - 1),
  y: z
    .number()
    .int()
    .min(0)
    .max(MAX_SIZE - 1),
});
export type RoutePlanCell = z.infer<typeof cellSchema>;

export const routePlanMoveSchema = z.enum(["up", "down", "left", "right"]);
export type RoutePlanMove = z.infer<typeof routePlanMoveSchema>;

const configSchema = z.object({
  width: z.number().int().min(3).max(MAX_SIZE),
  height: z.number().int().min(3).max(MAX_SIZE),
  start: cellSchema,
  goal: cellSchema,
  reefs: z.array(cellSchema).max(MAX_SIZE * MAX_SIZE),
  hint: z.string().optional(),
});
export type RoutePlanConfig = z.infer<typeof configSchema>;

/** What the browser may know about a route-plan puzzle: the whole board, never a route. */
export const routePlanClientViewSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  start: cellSchema,
  goal: cellSchema,
  reefs: z.array(cellSchema),
  hint: z.string().nullable(),
});
export type RoutePlanClientView = z.infer<typeof routePlanClientViewSchema>;

const answerSchema = z.object({
  moves: z.array(routePlanMoveSchema).max(ROUTE_PLAN_MAX_MOVES),
});

const STEP: Record<RoutePlanMove, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const keyOf = (cell: RoutePlanCell) => `${cell.x},${cell.y}`;

/** The next cell for a move, or null when it would leave the board or land on a reef. Pure; used by verifier and UI. */
export function stepOnBoard(
  board: Pick<RoutePlanConfig, "width" | "height" | "reefs">,
  from: RoutePlanCell,
  move: RoutePlanMove,
): RoutePlanCell | null {
  const next = { x: from.x + STEP[move].dx, y: from.y + STEP[move].dy };
  if (next.x < 0 || next.y < 0 || next.x >= board.width || next.y >= board.height) return null;
  if (board.reefs.some((reef) => reef.x === next.x && reef.y === next.y)) return null;
  return next;
}

/** Is there at least one safe route from the start to the goal? Used to reject unusable layouts at parse time. */
function hasSafeRoute(config: RoutePlanConfig): boolean {
  const seen = new Set([keyOf(config.start)]);
  const queue: RoutePlanCell[] = [config.start];
  while (queue.length > 0) {
    const cell = queue.shift() as RoutePlanCell; // the loop condition guarantees an element
    if (cell.x === config.goal.x && cell.y === config.goal.y) return true;
    for (const move of Object.keys(STEP) as RoutePlanMove[]) {
      const next = stepOnBoard(config, cell, move);
      if (next && !seen.has(keyOf(next))) {
        seen.add(keyOf(next));
        queue.push(next);
      }
    }
  }
  return false;
}

export const routePlanPuzzle: PuzzleVerifier<RoutePlanConfig> = {
  type: "route-plan",
  parseConfig(raw) {
    const config = configSchema.parse(raw);
    const inBounds = (cell: RoutePlanCell) => cell.x < config.width && cell.y < config.height;
    if (![config.start, config.goal, ...config.reefs].every(inBounds)) {
      throw new Error("route-plan: every cell must be inside the board");
    }
    if (keyOf(config.start) === keyOf(config.goal)) {
      throw new Error("route-plan: the start and the goal must be different cells");
    }
    const reefKeys = config.reefs.map(keyOf);
    if (new Set(reefKeys).size !== reefKeys.length) {
      throw new Error("route-plan: reefs must be unique cells");
    }
    if (reefKeys.includes(keyOf(config.start)) || reefKeys.includes(keyOf(config.goal))) {
      throw new Error("route-plan: a reef cannot sit on the start or the goal");
    }
    if (!hasSafeRoute(config)) {
      throw new Error("route-plan: there is no safe route from the start to the goal");
    }
    return config;
  },
  verify(config, answer) {
    const parsed = answerSchema.safeParse(answer);
    if (!parsed.success) return { correct: false, feedback: "Answer must be a list of moves" };
    let at = config.start;
    for (const move of parsed.data.moves) {
      const next = stepOnBoard(config, at, move);
      if (!next) return { correct: false, feedback: "Not quite. Try again." };
      at = next;
    }
    const correct = at.x === config.goal.x && at.y === config.goal.y;
    return {
      correct,
      // Theme-neutral and deliberately vague: never say where the ship stopped or which move was bad.
      feedback: correct ? "You solved it!" : "Not quite. Try again.",
    };
  },
  toClientView(config) {
    // Reefs are part of the board the child plans around. Sorted row by row so list order says nothing.
    const reefs = [...config.reefs].sort((a, b) => a.y - b.y || a.x - b.x);
    return {
      width: config.width,
      height: config.height,
      start: config.start,
      goal: config.goal,
      reefs,
      hint: config.hint ?? null,
    };
  },
};
