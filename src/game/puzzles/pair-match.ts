import { z } from "zod";

import type { PuzzleVerifier } from "./types";

/**
 * "pair-match": the child matches every part to the one tool that fixes it (e.g. damaged ship parts to
 * tools). Every part has exactly one tool and every tool is used once, so five parts have 5! = 120 answers.
 * Theme-neutral: labels and flavour text come from the theme's puzzle config.
 */
const labelledKey = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
});

const configSchema = z.object({
  parts: z.array(labelledKey).min(2).max(8),
  tools: z.array(labelledKey).min(2).max(8),
  /** The answer: part key to tool key. Server only. */
  pairs: z.record(z.string(), z.string()),
  hint: z.string().optional(),
});
export type PairMatchConfig = z.infer<typeof configSchema>;

/** What the browser may know about a pair-match puzzle (never `pairs`). */
export const pairMatchClientViewSchema = z.object({
  parts: z.array(labelledKey),
  tools: z.array(labelledKey),
  hint: z.string().nullable(),
});
export type PairMatchClientView = z.infer<typeof pairMatchClientViewSchema>;

const answerSchema = z.object({ pairs: z.record(z.string(), z.string()) });

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

export const pairMatchPuzzle: PuzzleVerifier<PairMatchConfig> = {
  type: "pair-match",
  parseConfig(raw) {
    const config = configSchema.parse(raw);
    const partKeys = config.parts.map((p) => p.key);
    const toolKeys = config.tools.map((t) => t.key);
    if (hasDuplicates(partKeys) || hasDuplicates(toolKeys)) {
      throw new Error("pair-match: part and tool keys must be unique");
    }
    if (partKeys.length !== toolKeys.length) {
      throw new Error("pair-match: there must be exactly as many tools as parts");
    }
    const answerParts = Object.keys(config.pairs);
    if (
      answerParts.length !== partKeys.length ||
      !partKeys.every((key) => answerParts.includes(key))
    ) {
      throw new Error("pair-match: pairs must name every part exactly once");
    }
    const answerTools = Object.values(config.pairs);
    if (hasDuplicates(answerTools) || !answerTools.every((key) => toolKeys.includes(key))) {
      throw new Error("pair-match: pairs must use every tool exactly once");
    }
    // The client view lists tools sorted by key; that order must not spell out the answer.
    const sortedTools = [...toolKeys].sort((a, b) => a.localeCompare(b));
    if (config.parts.every((part, i) => config.pairs[part.key] === sortedTools[i])) {
      throw new Error(
        "pair-match: list the parts in an order that does not match the sorted tools",
      );
    }
    return config;
  },
  verify(config, answer) {
    const parsed = answerSchema.safeParse(answer);
    if (!parsed.success) return { correct: false, feedback: "Answer must be a list of pairs" };
    const given = parsed.data.pairs;
    const expectedParts = Object.keys(config.pairs);
    const correct =
      Object.keys(given).length === expectedParts.length &&
      expectedParts.every((part) => given[part] === config.pairs[part]);
    return {
      correct,
      // Theme-neutral and deliberately vague: never say how many pairs or which ones were right.
      feedback: correct ? "You solved it!" : "Not quite. Try again.",
    };
  },
  toClientView(config) {
    // `pairs` (the answer) stays on the server. Tools are sorted by key so list order cannot hint at it.
    const tools = [...config.tools].sort((a, b) => a.key.localeCompare(b.key));
    return { parts: config.parts, tools, hint: config.hint ?? null };
  },
};
