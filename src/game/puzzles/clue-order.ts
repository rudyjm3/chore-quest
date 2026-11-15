import { z } from "zod";

import type { PuzzleVerifier } from "./types";

/**
 * "clue-order": the child puts a few named things into numbered places (place 1 is the leftmost) using clues such
 * as "the idol is somewhere left of the mask". Theme-neutral: only things, places and rules exist here; the names
 * and the sentences come from the theme's puzzle config (ADR 0021).
 *
 * No answer is stored. The clues are rules and `parseConfig` enumerates every ordering and rejects a config that
 * does not have exactly one solution, so "satisfies every clue" and "is the answer" are the same thing.
 */
const MAX_ITEMS = 6;

const keyedLabel = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
});

const text = z.string().min(1).max(160);

const ruleSchema = z.discriminatedUnion("rule", [
  z.object({ rule: z.literal("left-of"), a: z.string(), b: z.string(), text }),
  z.object({ rule: z.literal("next-to"), a: z.string(), b: z.string(), text }),
  z.object({ rule: z.literal("not-next-to"), a: z.string(), b: z.string(), text }),
  z.object({ rule: z.literal("in-slot"), a: z.string(), slot: z.number().int().min(1), text }),
  z.object({ rule: z.literal("not-in-slot"), a: z.string(), slot: z.number().int().min(1), text }),
]);
export type ClueOrderClue = z.infer<typeof ruleSchema>;

const configSchema = z.object({
  items: z.array(keyedLabel).min(3).max(MAX_ITEMS),
  clues: z.array(ruleSchema).min(1).max(12),
  hint: z.string().optional(),
});
export type ClueOrderConfig = z.infer<typeof configSchema>;

/** What the browser may know: the things, how many places, the clue sentences. Never the order. */
export const clueOrderClientViewSchema = z.object({
  items: z.array(keyedLabel),
  slots: z.number().int(),
  clues: z.array(z.string()),
  hint: z.string().nullable(),
});
export type ClueOrderClientView = z.infer<typeof clueOrderClientViewSchema>;

const answerSchema = z.object({ order: z.array(z.string()).max(MAX_ITEMS) });

/** Does an ordering (item keys, place 1 first) satisfy one clue? Pure. */
function satisfies(order: string[], clue: ClueOrderClue): boolean {
  const at = (key: string) => order.indexOf(key) + 1; // 0 when absent: callers have validated the keys
  switch (clue.rule) {
    case "left-of":
      return at(clue.a) < at(clue.b);
    case "next-to":
      return Math.abs(at(clue.a) - at(clue.b)) === 1;
    case "not-next-to":
      return Math.abs(at(clue.a) - at(clue.b)) !== 1;
    case "in-slot":
      return at(clue.a) === clue.slot;
    case "not-in-slot":
      return at(clue.a) !== clue.slot;
  }
}

function* permutations(keys: string[]): Generator<string[]> {
  if (keys.length <= 1) {
    yield [...keys];
    return;
  }
  for (let i = 0; i < keys.length; i += 1) {
    const rest = [...keys.slice(0, i), ...keys.slice(i + 1)];
    for (const tail of permutations(rest)) yield [keys[i] as string, ...tail];
  }
}

/** Every ordering of the items that satisfies every clue. */
function solutions(config: ClueOrderConfig): string[][] {
  const found: string[][] = [];
  for (const order of permutations(config.items.map((i) => i.key))) {
    if (config.clues.every((clue) => satisfies(order, clue))) found.push(order);
  }
  return found;
}

export const clueOrderPuzzle: PuzzleVerifier<ClueOrderConfig> = {
  type: "clue-order",
  parseConfig(raw) {
    const config = configSchema.parse(raw);
    const keys = config.items.map((i) => i.key);
    if (new Set(keys).size !== keys.length) throw new Error("clue-order: item keys must be unique");
    for (const clue of config.clues) {
      const named =
        clue.rule === "in-slot" || clue.rule === "not-in-slot" ? [clue.a] : [clue.a, clue.b];
      if (!named.every((key) => keys.includes(key))) {
        throw new Error("clue-order: a clue names an item that does not exist");
      }
      if ("b" in clue && clue.a === clue.b) {
        throw new Error("clue-order: a clue cannot compare an item with itself");
      }
      if ("slot" in clue && clue.slot > keys.length) {
        throw new Error("clue-order: a clue names a place that does not exist");
      }
    }
    const count = solutions(config).length;
    if (count !== 1) {
      throw new Error(`clue-order: the clues must have exactly one solution (found ${count})`);
    }
    // The client view lists things sorted by key; that order must not spell out the answer.
    const solution = solutions(config)[0] as string[]; // exactly one, checked above
    const sorted = [...keys].sort((x, y) => x.localeCompare(y));
    if (solution.every((key, i) => key === sorted[i])) {
      throw new Error("clue-order: choose keys whose sorted order is not the solution");
    }
    return config;
  },
  verify(config, answer) {
    const parsed = answerSchema.safeParse(answer);
    if (!parsed.success) return { correct: false, feedback: "Answer must be a list of things" };
    const order = parsed.data.order;
    const keys = config.items.map((i) => i.key);
    const isPermutation =
      order.length === keys.length &&
      new Set(order).size === order.length &&
      order.every((key) => keys.includes(key));
    const correct = isPermutation && config.clues.every((clue) => satisfies(order, clue));
    return {
      correct,
      // Theme-neutral and deliberately vague: never say which clue or which place was wrong.
      feedback: correct ? "You solved it!" : "Not quite. Try again.",
    };
  },
  toClientView(config) {
    // Things sorted by key so list order says nothing about the places; clues in authored order (the puzzle itself).
    const items = [...config.items].sort((a, b) => a.key.localeCompare(b.key));
    return {
      items,
      slots: config.items.length,
      clues: config.clues.map((clue) => clue.text),
      hint: config.hint ?? null,
    };
  },
};

/** The unique solution of a valid config. For tests of theme data; never used at runtime. */
export function clueOrderSolution(config: ClueOrderConfig): string[] {
  return solutions(config)[0] ?? [];
}
