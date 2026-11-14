import { z } from "zod";

import type { PuzzleVerifier } from "./types";

/**
 * "sequence-match": the child must reproduce a short sequence of symbols
 * (e.g. compass directions). Used by the Parrot Island compass puzzle.
 */
const configSchema = z.object({
  symbols: z.array(z.string().min(1)).min(2).max(12),
  sequence: z.array(z.string().min(1)).min(2).max(12),
  hint: z.string().optional(),
});
export type SequenceMatchConfig = z.infer<typeof configSchema>;

/** What the browser may know about a sequence-match puzzle (never the sequence). */
export const sequenceMatchClientViewSchema = z.object({
  symbols: z.array(z.string()),
  hint: z.string().nullable(),
});
export type SequenceMatchClientView = z.infer<typeof sequenceMatchClientViewSchema>;

const answerSchema = z.object({ sequence: z.array(z.string()).max(12) });

export const sequenceMatchPuzzle: PuzzleVerifier<SequenceMatchConfig> = {
  type: "sequence-match",
  parseConfig(raw) {
    const config = configSchema.parse(raw);
    if (!config.sequence.every((s) => config.symbols.includes(s))) {
      throw new Error("sequence-match: sequence contains symbols not in the symbol set");
    }
    return config;
  },
  verify(config, answer) {
    const parsed = answerSchema.safeParse(answer);
    if (!parsed.success) return { correct: false, feedback: "Answer must be a list of symbols" };
    const given = parsed.data.sequence;
    const correct =
      given.length === config.sequence.length && given.every((s, i) => s === config.sequence[i]);
    return {
      correct,
      // Theme-neutral and deliberately vague: never say how many symbols or which positions were right.
      feedback: correct ? "You solved it!" : "Not quite. Try again.",
    };
  },
  toClientView(config) {
    // `sequence` (the answer) stays on the server.
    return { symbols: config.symbols, hint: config.hint ?? null };
  },
};
